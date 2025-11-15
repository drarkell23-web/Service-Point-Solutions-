/* ================================
   MAIN.JS — Service Point Solutions
   ================================ */

const API_BASE = "/api"; // backend routes

let allServices = [];
let categories = [];

/* ================================
   LOAD SERVICES FROM BACKEND
   ================================ */
async function loadServices() {
    try {
        const res = await fetch(`${API_BASE}/services`);
        const json = await res.json();
        allServices = json.services || [];

        // Build category list dynamically
        categories = [...new Set(allServices.map(s => s.category))];

        renderCategoryButtons();
    } catch (err) {
        console.error("Error loading services:", err);
    }
}

/* ================================
   RENDER CATEGORY BUTTONS IN SIDEBAR
   ================================ */
function renderCategoryButtons() {
    const box = document.getElementById("categoryButtons");
    box.innerHTML = "";

    categories.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = "category-btn";
        btn.textContent = cat;
        btn.onclick = () => showServicesByCategory(cat);
        box.appendChild(btn);
    });
}

/* ================================
   SHOW SERVICES BY CATEGORY
   ================================ */
function showServicesByCategory(category) {
    const container = document.getElementById("serviceContainer");
    container.innerHTML = "";

    const filtered = allServices.filter(s => s.category === category);

    const title = document.createElement("div");
    title.className = "category-title";
    title.textContent = category;
    container.appendChild(title);

    const list = document.createElement("div");
    list.className = "service-list";

    filtered.forEach(svc => {
        const btn = document.createElement("div");
        btn.className = "service-item";
        btn.textContent = svc.name;
        btn.onclick = () => selectService(svc.name);
        list.appendChild(btn);
    });

    container.appendChild(list);
}

/* ================================
   SELECT SERVICE → UPDATE FORM
   ================================ */
function selectService(serviceName) {
    const select = document.getElementById("serviceSelect");
    select.innerHTML = `<option selected>${serviceName}</option>`;
}

/* ================================
   SEND LEAD REQUEST
   ================================ */
async function sendLead() {
    const fullName = document.getElementById("fullName").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const service = document.getElementById("serviceSelect").value;
    const message = document.getElementById("message").value.trim();

    if (!fullName || !phone || !service) {
        alert("Please fill in required fields.");
        return;
    }

    const body = {
        customer_name: fullName,
        phone,
        email,
        service,
        message
    };

    try {
        const res = await fetch(`${API_BASE}/lead`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const json = await res.json();

        if (json.ok) {
            alert("Your request was successfully submitted!");
            document.getElementById("fullName").value = "";
            document.getElementById("phone").value = "";
            document.getElementById("email").value = "";
            document.getElementById("message").value = "";
        } else {
            alert("Error: " + json.error);
        }

    } catch (err) {
        console.error("Lead send failed:", err);
        alert("Something went wrong — try again.");
    }
}

/* ================================
   INIT
   ================================ */
loadServices();
