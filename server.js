/* ===========================================================
   SERVICE POINT SOLUTIONS — FULL BACKEND (CommonJS)
   Supabase + JWT Auth + Storage Upload + Telegram Routing
   =========================================================== */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

/* ===========================================================
   ENVIRONMENT VARIABLES
=========================================================== */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const MAIN_TELEGRAM_TOKEN = process.env.MAIN_TELEGRAM_TOKEN;
const MAIN_TELEGRAM_CHAT_ID = process.env.MAIN_TELEGRAM_CHAT_ID;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase environment variables.");
    process.exit(1);
}
if (!JWT_SECRET) {
    console.error("❌ Missing JWT_SECRET");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/* ===========================================================
   EXPRESS SETUP
=========================================================== */

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
const upload = multer({ storage: multer.memoryStorage() });

/* ===========================================================
   JWT HELPERS
=========================================================== */

function signToken(payload, expires = "30d") {
    return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256", expiresIn: expires });
}

function verifyToken(token) {
    try {
        if (!token) return null;
        if (token.startsWith("Bearer ")) token = token.slice(7);
        return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    } catch (err) {
        return null;
    }
}

function requireAuth(req, res, next) {
    const token = req.headers.authorization;
    const data = verifyToken(token);
    if (!data) return res.status(401).json({ ok: false, error: "Unauthorized" });

    req.auth = data;
    next();
}

function requireRole(role) {
    return (req, res, next) => {
        const token = req.headers.authorization;
        const data = verifyToken(token);
        if (!data) return res.status(401).json({ ok: false, error: "Unauthorized" });

        if (data.role !== role && data.role !== "admin")
            return res.status(403).json({ ok: false, error: "Forbidden" });

        req.auth = data;
        next();
    };
}

/* ===========================================================
   TELEGRAM
=========================================================== */

async function sendTelegram(token, chatId, text) {
    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: "HTML"
            })
        });

        return await res.json();
    } catch (err) {
        console.error("Telegram error:", err);
        return { ok: false };
    }
}

function leadMessage(lead, contractor = null) {
    return `
<b>New Lead Submitted</b>
${contractor ? `<b>Assigned To:</b> ${contractor.company_name || contractor.name}\n` : ""}
<b>Service:</b> ${lead.service}
<b>Name:</b> ${lead.customer_name}
<b>Phone:</b> ${lead.phone}
<b>Email:</b> ${lead.email || "-"}
<b>Message:</b> ${lead.message || ""}
    `;
}

/* ===========================================================
   STORAGE: UPLOAD LOGO TO SUPABASE
=========================================================== */

async function uploadLogo(contractorId, file) {
    const bucket = "logos";
    const fileName = `${contractorId}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: true
        });

    if (uploadError) {
        console.error(uploadError);
        return null;
    }

    const { publicURL } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return publicURL;
}

/* ===========================================================
   AUTH ROUTES
=========================================================== */

app.post("/api/auth/admin-login", (req, res) => {
    if (req.body.password !== ADMIN_PASSWORD)
        return res.status(401).json({ ok: false, error: "Invalid password" });

    const token = signToken({ role: "admin", sub: "admin" }, "14d");
    res.json({ ok: true, token });
});

app.post("/api/auth/contractor-login", async (req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase
        .from("contractors")
        .select("*")
        .eq("email", email)
        .limit(1)
        .single();

    if (error || !data || data.password !== password)
        return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const token = signToken({ role: "contractor", sub: data.id }, "30d");
    res.json({ ok: true, token, contractorId: data.id });
});

/* ===========================================================
   SERVICES
=========================================================== */

app.get("/api/services", async (req, res) => {
    const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("name", { ascending: true });

    if (error) return res.status(500).json({ ok: false, error });

    res.json({ services: data });
});

/* ===========================================================
   CONTRACTORS
=========================================================== */

app.get("/api/contractors", requireRole("admin"), async (req, res) => {
    const { data, error } = await supabase
        .from("contractors")
        .select("*")
        .order("company_name", { ascending: true });

    if (error) return res.status(500).json({ ok: false, error });

    res.json({ contractors: data });
});

app.post("/api/contractor", requireAuth, upload.single("logo"), async (req, res) => {
    const body = req.body;

    const isContractor = req.auth.role === "contractor";

    if (isContractor && body.id !== req.auth.sub)
        return res.status(403).json({ ok: false, error: "Forbidden" });

    const contractor = {
        id: body.id,
        name: body.name,
        company_name: body.company_name,
        email: body.email,
        phone: body.phone,
        service: body.service,
        telegram_token: body.telegram_token,
        telegram_chat_id: body.telegram_chat_id,
        password: body.password,
        updated_at: new Date().toISOString()
    };

    // Upload logo
    if (req.file) {
        const url = await uploadLogo(contractor.id, req.file);
        if (url) contractor.logo_url = url;
    }

    const { data, error } = await supabase
        .from("contractors")
        .upsert(contractor, { onConflict: "id" })
        .select()
        .single();

    if (error) return res.status(500).json({ ok: false, error });

    res.json({ ok: true, contractor: data });
});

/* ===========================================================
   FETCH CONTRACTORS BY SERVICE
=========================================================== */

app.get("/api/contractors/by-service/:service", async (req, res) => {
    const svc = req.params.service;

    const { data, error } = await supabase
        .from("contractors")
        .select("*")
        .ilike("service", `%${svc}%`)
        .order("premium", { ascending: false });

    if (error) return res.status(500).json({ ok: false, error });

    res.json({ contractors: data });
});

/* ===========================================================
   LEADS
=========================================================== */

app.post("/api/lead", async (req, res) => {
    const body = req.body;

    const lead = {
        customer_name: body.customer_name,
        phone: body.phone,
        email: body.email,
        service: body.service,
        message: body.message,
        contractor_id: body.selected_contractor_id || null
    };

    // Save lead
    const { data: saved, error } = await supabase
        .from("leads")
        .insert([lead])
        .select()
        .single();

    if (error) return res.status(500).json({ ok: false, error });

    // Telegram routing
    let telegramTarget = "overflow";
    let telegramResult;

    if (lead.contractor_id) {
        const { data: contractor } = await supabase
            .from("contractors")
            .select("*")
            .eq("id", lead.contractor_id)
            .single();

        if (contractor && contractor.telegram_token && contractor.telegram_chat_id) {
            telegramTarget = "contractor";
            telegramResult = await sendTelegram(
                contractor.telegram_token,
                contractor.telegram_chat_id,
                leadMessage(lead, contractor)
            );
        }
    }

    if (telegramTarget === "overflow") {
        telegramResult = await sendTelegram(
            MAIN_TELEGRAM_TOKEN,
            MAIN_TELEGRAM_CHAT_ID,
            leadMessage(lead)
        );
    }

    res.json({
        ok: true,
        lead: saved,
        sentTo: telegramTarget,
        telegram: telegramResult
    });
});

/* ===========================================================
   LEAD LOGS
=========================================================== */

app.get("/api/logs/leads", requireAuth, async (req, res) => {
    const contractorId = req.query.contractor_id;

    if (req.auth.role === "contractor" && contractorId !== req.auth.sub)
        return res.status(403).json({ ok: false, error: "Forbidden" });

    const q = supabase.from("leads").select("*").order("created_at", { ascending: false });

    const { data } = contractorId ? await q.eq("contractor_id", contractorId) : await q;

    res.json(data || []);
});

/* ===========================================================
   REVIEWS
=========================================================== */

app.get("/api/reviews", requireAuth, async (req, res) => {
    const contractorId = req.query.contractor_id;

    if (req.auth.role === "contractor" && contractorId !== req.auth.sub)
        return res.status(403).json({ ok: false, error: "Forbidden" });

    let q = supabase.from("reviews").select("*").order("created_at", { ascending: false });

    if (contractorId) q = q.eq("contractor_id", contractorId);

    const { data } = await q;

    res.json(data || []);
});

/* ===========================================================
   STATIC FILE ROUTING
=========================================================== */

app.use(express.static(path.join(__dirname)));

function serve(file) {
    return (req, res) => res.sendFile(path.join(__dirname, file));
}

app.get("/", serve("index.html"));
app.get("/contractor-login", serve("contractor-login.html"));
app.get("/contractor-register", serve("contractor-register.html"));
app.get("/admin-login", serve("admin-login.html"));
app.get("/contractor-dashboard", serve("contractor/contractor-dashboard.html"));
app.get("/admin-dashboard", serve("admin/admin-dashboard.html"));

/* ===========================================================
   START SERVER
=========================================================== */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
