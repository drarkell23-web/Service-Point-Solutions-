/* ======================================
   ADMIN DASHBOARD JS
   ====================================== */

const API = "/api";

function getToken() {
    return localStorage.getItem("adminToken");
}

/* ============================
   SECTION SWITCHING
============================ */
function showSection(id) {
    document.querySelectorAll(".section").forEach(sec => sec.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");

    if (id === "contractors") loadContractors();
    if (id === "leads") loadLeads();
    if (id === "reviews") loadReviews();
}

/* ============================
   LOAD CONTRACTORS
============================ */
async function loadContractors() {
    const list = document.getElementById("contractorList");
    list.innerHTML = "<tr><td colspan='5'>Loading...</td></tr>";

    const res = await fetch(`${API}/contractors`, {
        headers: { "Authorization": "Bearer " + getToken() }
    });

    const json = await res.json();

    if (!json.contractors) {
        list.innerHTML = "<tr><td colspan='5'>No data</td></tr>";
        return;
    }

    list.innerHTML = "";

    json.contractors.forEach(c => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${c.company_name || "N/A"}</td>
            <td>${c.name || "N/A"}</td>
            <td>${c.email || "N/A"}</td>
            <td>${c.service || "-"}</td>
            <td>${c.premium ? "Yes" : "No"}</td>
        `;
        list.appendChild(row);
    });
}

/* ============================
   LOAD LEADS
============================ */
async function loadLeads() {
    const list = document.getElementById("leadList");
    list.innerHTML = "<tr><td colspan='5'>Loading...</td></tr>";

    const res = await fetch(`${API}/logs/leads`, {
        headers: { "Authorization": "Bearer " + getToken() }
    });

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
}

/* ============================
   LOAD REVIEWS
============================ */
async function loadReviews() {
    const list = document.getElementById("reviewList");
    list.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";

    const res = await fetch(`${API}/reviews`, {
        headers: { "Authorization": "Bearer " + getToken() }
    });

    const json = await res.json();
    list.innerHTML = "";

    json.forEach(r => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${r.contractor_id}</td>
            <td>${r.reviewer_name}</td>
            <td>${r.rating}</td>
            <td>${r.comment}</td>
        `;
        list.appendChild(row);
    });
}

/* ============================
   LOGOUT
============================ */
function logout() {
    localStorage.removeItem("adminToken");
    window.location.href = "/admin-login";
}

showSection("contractors");
