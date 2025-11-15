/* ==========================================
   CONTRACTOR DASHBOARD JAVASCRIPT
========================================== */

const API = "/api";

function getToken() {
    return localStorage.getItem("contractorToken");
}

/* ==========================================
   INITIALIZATION
========================================== */

let contractorId = null;

async function init() {
    const token = getToken();
    if (!token) return (window.location.href = "/contractor-login");

    const payload = parseJwt(token);
    contractorId = payload.sub;

    loadProfile();
    loadLeads();
    loadReviews();
}
init();

/* ==========================================
   JWT PARSER
========================================== */
function parseJwt(token) {
    const base64 = token.split('.')[1];
    return JSON.parse(atob(base64));
}

/* ==========================================
   SECTION SWITCHING
========================================== */
function showSection(id) {
    document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");

    if (id === "overview") {
        loadLeads();
        loadReviews();
    }
    if (id === "leads") loadLeads();
    if (id === "reviews") loadReviews();
    if (id === "profile") loadProfile();
}

/* ==========================================
   LOAD PROFILE
========================================== */
async function loadProfile() {
    const res = await fetch(`/api/contractors?contractor_id=${contractorId}`, {
        headers: { "Authorization": "Bearer " + getToken() }
    });

    const json = await res.json();
    const c = json.contractors.find(x => x.id === contractorId);

    if (!c) return;

    document.getElementById("company_name").value = c.company_name || "";
    document.getElementById("name").value = c.name || "";
    document.getElementById("email").value = c.email || "";
    document.getElementById("phone").value = c.phone || "";
    document.getElementById("service").value = c.service || "";
    document.getElementById("telegram_token").value = c.telegram_token || "";
    document.getElementById("telegram_chat_id").value = c.telegram_chat_id || "";
}

/* ==========================================
   SAVE PROFILE
========================================== */
async function saveProfile() {
    const formData = new FormData();

    formData.append("id", contractorId);
    formData.append("company_name", document.getElementById("company_name").value);
    formData.append("name", document.getElementById("name").value);
    formData.append("email", document.getElementById("email").value);
    formData.append("phone", document.getElementById("phone").value);
    formData.append("service", document.getElementById("service").value);
    formData.append("telegram_token", document.getElementById("telegram_token").value);
    formData.append("telegram_chat_id", document.getElementById("telegram_chat_id").value);

    const logo = document.getElementById("logo").files[0];
    if (logo) formData.append("logo", logo);

    const res = await fetch("/api/contractor", {
        method: "POST",
        headers: { "Authorization": "Bearer " + getToken() },
        body: formData
    });

    const json = await res.json();

    if (json.ok) {
        alert("Profile updated successfully!");
    } else {
        alert("Error saving profile: " + json.error);
    }
}

/* ==========================================
   LOAD LEADS
========================================== */
async function loadLeads() {
    const res = await fetch(`/api/logs/leads?contractor_id=${contractorId}`, {
        headers: { "Authorization": "Bearer " + getToken() }
    });

    const list = document.getElementById("leadList");
    const json = await res.json();

    list.innerHTML = "";

    json.forEach(l => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${l.customer_name}</td>
            <td>${l.phone}</td>
            <td>${l.email || "-"}</td>
            <td>${l.service}</td>
            <td>${l.message}</td>
        `;
        list.appendChild(row);
    });

    document.getElementById("totalLeads").textContent = json.length;
}

/* ==========================================
   LOAD REVIEWS
========================================== */
async function loadReviews() {
    const res = await fetch(`/api/reviews?contractor_id=${contractorId}`, {
        headers: { "Authorization": "Bearer " + getToken() }
    });

    const list = document.getElementById("reviewList");
    const json = await res.json();

    list.innerHTML = "";

    json.forEach(r => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${r.reviewer_name}</td>
            <td>${r.rating}</td>
            <td>${r.comment}</td>
        `;
        list.appendChild(row);
    });

    document.getElementById("totalReviews").textContent = json.length;

    let avg = 0;
    if (json.length > 0) {
        avg = json.reduce((a,b)=>a+b.rating,0) / json.length;
    }
    document.getElementById("rating").textContent = avg.toFixed(1);
}

/* ==========================================
   LOGOUT
========================================== */
function logout() {
    localStorage.removeItem("contractorToken");
    window.location.href = "/contractor-login";
}
