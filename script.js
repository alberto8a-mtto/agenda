// ---------- CONFIGURACIÓN DE ACCESO ----------
const SESSION_STORAGE_KEY = "revisiones_active_session_v1";
const USER_ROLES = ["EMPRESA", "COORDINADOR", "ADMIN"];
const DEFAULT_COMPANY_OPTIONS = ["RAPIDO OCHOA", "ESPECIALES", "TRANSEGOVIA", "ARAUCA", "COLGAS", "TVS", "TRANSORIENTE"];
let companyOptions = [...DEFAULT_COMPANY_OPTIONS];

// ---------- ESTADO DE AUTENTICACIÓN ----------
let authenticatedUser = null;
let isAuthenticated = false;
let authConfig = { users: [] };

// ---------- DATOS DE CITAS ----------
let appointments = [];
const MAX_PDF_SIZE_BYTES = 600 * 1024;
const COORDINATOR_OPTIONS = [
    "Juan Carlos Gallego",
    "Mateo Garcia",
    "Jhon Bairon Chavarria",
    "Yermison Muriel",
    "Carlos Patiño",
    "Jorge Acosta",
    "Alejandro Gomez"
];
const STATUS_OPTIONS = ["Pendiente", "No se presenta", "habilitado", "inhabilitado", "condicionado"];
const TIME_SLOTS = ["07:00", "08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00"];
const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const TRANSEGOVIA_VEHICLES = [
    "INTERNO 1 - PLACA NNL 618",
    "INTERNO 2 - PLACA WPS926",
    "INTERNO 6 - PLACA SNZ 517",
    "INTERNO 8 - PLACA STE 513",
    "INTERNO 11 - PLACA LKL 069",
    "INTERNO 20 - PLACA JKX 824",
    "INTERNO 23 - PLACA GKV 562",
    "INTERNO 27 - PLACA TRN 940",
    "INTERNO 28 - PLACA TRN 899",
    "INTERNO 31 - PLACA GVU 918",
    "INTERNO 32 - PLACA WPT 044",
    "INTERNO 33 - PLACA LKK 076",
    "INTERNO 34 - PLACA LTL 395",
    "INTERNO 35 - PLACA SNX 847",
    "INTERNO 36 - PLACA EQW 417",
    "INTERNO 37 - PLACA LKK 780",
    "INTERNO 38 - PLACA EQO 119",
    "INTERNO 39 - PLACA TRN 916",
    "INTERNO 40 - PLACA SNW 549",
    "INTERNO 50 - PLACA EQO 025",
    "INTERNO 52 - PLACA STE 121",
    "INTERNO 54 - PLACA LKK 984",
    "INTERNO 56 - PLACA WLP 475",
    "INTERNO 57 - PLACA WLP 477",
    "INTERNO 61 - PLACA SNQ 445",
    "INTERNO 62 - PLACA SNW 868",
    "INTERNO 74 - PLACA TRM 518",
    "INTERNO 75 - PLACA TRM 105",
    "INTERNO 78 - PLACA SNW 313",
    "INTERNO 79 - PLACA LZM 050",
    "INTERNO 90 - PLACA TRN 898",
    "INTERNO 92 - PLACA TRN 475",
    "INTERNO 98 - PLACA TRN 577",
    "INTERNO 99 - PLACA SNZ 349",
    "INTERNO 301 - PLACA LXS 558",
    "INTERNO 302 - PLACA LKM 239",
    "INTERNO 303 - PLACA LKM 458",
    "INTERNO 304 - PLACA NNZ 263",
    "INTERNO 305 - PLACA STE 533",
    "INTERNO 306 - PLACA PUN 610"
];
let currentWeekStart = null;
let editingAppId = null;

async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
        method: options.method || "GET",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const isJson = (response.headers.get("content-type") || "").includes("application/json");
    const payload = isJson ? await response.json() : null;

    if (!response.ok) {
        const message = payload && payload.error ? payload.error : "Error de conexión con el servidor.";
        throw new Error(message);
    }

    return payload;
}

function generateUserId() {
    return `u_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function getUserIndexById(userId) {
    return authConfig.users.findIndex(u => u.id === userId);
}

function findUserByUsername(username) {
    return authConfig.users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

function canManageRevisions() {
    return isAuthenticated && authenticatedUser && (authenticatedUser.role === "ADMIN" || authenticatedUser.role === "COORDINADOR");
}

function canManageUsers() {
    return isAuthenticated && authenticatedUser && authenticatedUser.role === "ADMIN";
}

function canUploadCoordinatorDocuments() {
    return isAuthenticated && authenticatedUser && (authenticatedUser.role === "COORDINADOR" || authenticatedUser.role === "ADMIN");
}

function canUploadOrderDocument() {
    return isAuthenticated && authenticatedUser && (authenticatedUser.role === "EMPRESA" || authenticatedUser.role === "ADMIN");
}

function setActiveSession(userId) {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ userId }));
}

function clearActiveSession() {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

function getUserById(userId) {
    return authConfig.users.find(u => u.id === userId) || null;
}

function normalizeCompanyName(value) {
    return String(value || "").trim().toUpperCase();
}

function normalizeCompanyList(items) {
    if (!Array.isArray(items)) return [...DEFAULT_COMPANY_OPTIONS];
    const unique = [];
    for (const item of items) {
        const normalized = normalizeCompanyName(item);
        if (!normalized) continue;
        if (unique.includes(normalized)) continue;
        unique.push(normalized);
    }
    return unique.length ? unique : [...DEFAULT_COMPANY_OPTIONS];
}

function getDefaultCompany() {
    return companyOptions.length ? companyOptions[0] : DEFAULT_COMPANY_OPTIONS[0];
}

function restoreSessionUser() {
    const rawSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!rawSession) return false;
    try {
        const parsed = JSON.parse(rawSession);
        const user = parsed && parsed.userId ? getUserById(parsed.userId) : null;
        if (!user || user.blocked === true) {
            clearActiveSession();
            return false;
        }
        authenticatedUser = { id: user.id, name: user.username, fullName: user.fullName || user.username, role: user.role, company: user.company };
        isAuthenticated = true;
        return true;
    } catch (e) {
        return false;
    }
}

function normalizeLoadedUsers(users) {
    if (!Array.isArray(users)) return [];
    const normalized = [];
    for (const rawUser of users) {
        if (!rawUser || typeof rawUser !== "object") continue;
        const fullName = typeof rawUser.fullName === "string" && rawUser.fullName.trim() ? rawUser.fullName.trim() : (typeof rawUser.username === "string" ? rawUser.username.trim() : "");
        const username = typeof rawUser.username === "string" ? rawUser.username.trim() : "";
        const role = USER_ROLES.includes(rawUser.role) ? rawUser.role : "EMPRESA";
        const companyFromUser = typeof rawUser.company === "string" ? normalizeCompanyName(rawUser.company) : "";
        const company = companyFromUser || (role === "EMPRESA" ? getDefaultCompany() : "TODAS");
        const blocked = rawUser.blocked === true;
        const password = typeof rawUser.password === "string" ? rawUser.password.trim() : "";
        if (!fullName || !username) continue;
        if (normalized.some(u => u.username.toLowerCase() === username.toLowerCase())) continue;
        normalized.push({ id: rawUser.id || generateUserId(), fullName, username, password, role, company, blocked });
    }
    return normalized;
}

async function loadAuthConfig() {
    const users = await apiRequest("/api/users");
    authConfig = { users: normalizeLoadedUsers(users) };
}

async function loadCompanyOptionsFromApi() {
    const companies = await apiRequest("/api/companies");
    companyOptions = normalizeCompanyList(companies);
}

function normalizeAppointments(items) {
    if (!Array.isArray(items)) return [];
    return items.map((app) => ({
        ...app,
        revisionType: app.revisionType || "REVISION",
        company: normalizeCompanyName(app.company) || getDefaultCompany(),
        vehicle: app.vehicle || "SIN DATOS",
        coordinator: app.coordinator || "",
        status: app.status || "Pendiente",
        email: app.email || "",
        pdfBase64: app.pdfBase64 || null,
        pdfName: app.pdfName || null,
        pdfUrl: app.pdfUrl || null,
        remisionBase64: app.remisionBase64 || null,
        remisionName: app.remisionName || null,
        remisionUrl: app.remisionUrl || null,
        ordenPedidoBase64: app.ordenPedidoBase64 || null,
        ordenPedidoName: app.ordenPedidoName || null,
        ordenPedidoUrl: app.ordenPedidoUrl || null,
        facturaBase64: app.facturaBase64 || null,
        facturaName: app.facturaName || null,
        facturaUrl: app.facturaUrl || null,
        storagePath: app.storagePath || null
    }));
}

async function loadAppointmentsFromApi() {
    const data = await apiRequest("/api/appointments");
    appointments = normalizeAppointments(data);
}

function hasConflict(date, time, excludeId = null) {
    return appointments.some(app => (excludeId !== null && app.id === excludeId) ? false : app.date === date && app.time === time);
}

async function addOrUpdateAppointment(data) {
    if (!data.vehicle || !data.company || !data.revisionType || !data.date || !data.time || !data.coordinator || !data.status) {
        return { success: false, message: "Todos los campos obligatorios deben estar completos." };
    }
    if (hasConflict(data.date, data.time, data.id)) {
        return { success: false, message: `Conflicto de agenda: ya existe una revisión el día ${data.date} a las ${data.time}.` };
    }
    if (data.id) {
        const idx = appointments.findIndex(a => a.id === data.id);
        if (idx === -1) return { success: false, message: "Cita no encontrada." };
        const payload = { ...appointments[idx], ...data };
        await apiRequest(`/api/appointments/${data.id}`, { method: "PATCH", body: payload });
        appointments[idx] = payload;
        return { success: true, message: `Cita actualizada para ${data.vehicle} - ${data.company}.`, appointmentId: data.id };
    } else {
        const newApp = {
            revisionType: data.revisionType,
            company: data.company,
            vehicle: data.vehicle,
            coordinator: data.coordinator,
            date: data.date,
            time: data.time,
            email: data.email || "",
            pdfBase64: null,
            pdfName: null,
            createdAt: new Date().toISOString(),
            status: data.status || "Pendiente"
        };
        const created = await apiRequest("/api/appointments", { method: "POST", body: newApp });
        appointments.push(created);
        return { success: true, message: `Cita reservada para ${data.vehicle} - ${data.company} el ${data.date} a las ${data.time}.`, appointmentId: created.id };
    }
}

function getAppointmentPdfUrl(app) {
    if (!app) return null;
    if (app.pdfUrl) return app.pdfUrl;
    if (app.pdfBase64 && app.pdfBase64.length > 50) return app.pdfBase64;
    return null;
}

function getDocumentConfig(docType) {
    switch (docType) {
        case "remision":
            return { urlField: "remisionUrl", nameField: "remisionName", base64Field: "remisionBase64", defaultFileName: "remision.pdf", label: "Remisión" };
        case "ordenPedido":
            return { urlField: "ordenPedidoUrl", nameField: "ordenPedidoName", base64Field: "ordenPedidoBase64", defaultFileName: "orden_pedido.pdf", label: "Orden de Pedido" };
        case "factura":
            return { urlField: "facturaUrl", nameField: "facturaName", base64Field: "facturaBase64", defaultFileName: "factura.pdf", label: "Factura" };
        default:
            return null;
    }
}

function getAppointmentDocumentUrl(app, docType) {
    const config = getDocumentConfig(docType);
    if (!app || !config) return null;
    if (app[config.urlField]) return app[config.urlField];
    const base64 = app[config.base64Field];
    if (base64 && base64.length > 50) return base64;
    return null;
}

function getAppointmentDocumentName(app, docType) {
    const config = getDocumentConfig(docType);
    if (!app || !config) return null;
    return app[config.nameField] || config.defaultFileName;
}

function createPdfDownloadLink(url, fileName, label = "Descargar PDF") {
    if (!url) return '<span class="badge">No cargado</span>';
    const safeUrl = escapeHtml(url);
    const safeName = escapeHtml(fileName || 'informe_revision.pdf');
    const safeLabel = escapeHtml(label);
    return `<a class="download-link pdf-download-link" href="#" data-url="${safeUrl}" data-filename="${safeName}">${safeLabel}</a>`;
}

async function triggerPdfDownload(url, fileName) {
    if (!url) {
        showTemporaryMessage("No hay PDF disponible para descargar.", "error");
        return;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error("No se pudo obtener el PDF.");
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = fileName || "informe_revision.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
    } catch (error) {
        showTemporaryMessage(error.message || "No se pudo descargar el PDF.", "error");
    }
}

function attachPdfDownloadHandlers(scope = document) {
    scope.querySelectorAll('.pdf-download-link').forEach(link => {
        link.addEventListener('click', async (event) => {
            event.preventDefault();
            await triggerPdfDownload(link.dataset.url, link.dataset.filename);
        });
    });
}

function readPdfAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.onerror = () => reject(new Error("No se pudo leer el archivo PDF."));
        reader.readAsDataURL(file);
    });
}

async function updateAppointmentDocument(appId, docType, filePayload) {
    const config = getDocumentConfig(docType);
    if (!config) throw new Error("Tipo de documento no soportado.");
    const idx = appointments.findIndex(a => a.id === appId);
    if (idx === -1) throw new Error("Cita no encontrada.");

    const patchPayload = {
        [config.nameField]: filePayload.name,
        [config.urlField]: null,
        [config.base64Field]: filePayload.base64
    };

    await apiRequest(`/api/appointments/${appId}`, {
        method: "PATCH",
        body: patchPayload
    });

    appointments[idx] = { ...appointments[idx], ...patchPayload };
}

async function uploadAppointmentDocument(appId, docType, file) {
    const config = getDocumentConfig(docType);
    if (!config) throw new Error("Tipo de documento no soportado.");
    if (!file) throw new Error(`Seleccione un PDF para ${config.label}.`);
    if (file.type !== "application/pdf") throw new Error(`Solo se permite ${config.label} en PDF.`);
    if (file.size > MAX_PDF_SIZE_BYTES) throw new Error(`El PDF de ${config.label} supera el límite de 600 KB.`);

    const pdfBase64 = await readPdfAsDataUrl(file);
    await updateAppointmentDocument(appId, docType, {
        name: file.name,
        base64: pdfBase64
    });
}

function buildDocumentCell(app, docType, canUpload) {
    const config = getDocumentConfig(docType);
    if (!config) return `<span class="badge">No disponible</span>`;
    const docUrl = getAppointmentDocumentUrl(app, docType);
    const docName = getAppointmentDocumentName(app, docType);
    const downloadHtml = docUrl
        ? createPdfDownloadLink(docUrl, docName, `Descargar ${config.label}`)
        : `<span class="badge">No cargado</span>`;

    if (!canUpload) {
        return `<div class="doc-cell-content">${downloadHtml}</div>`;
    }

    return `<div class="doc-cell-content">
                ${downloadHtml}
                <div class="upload-widget" style="justify-content:center;">
                <input type="file" class="doc-upload-input" data-doc-type="${docType}" data-id="${app.id}" accept="application/pdf">
                <button class="btn-small btn-upload-document" data-doc-type="${docType}" data-id="${app.id}">${docUrl ? "Reemplazar" : "Subir"}</button>
                </div>
            </div>`;
}

async function uploadPdfFile(appId, file) {
    if (!file) throw new Error("Seleccione un PDF.");
    if (file.type !== "application/pdf") throw new Error("Solo se permite informe en PDF.");
    if (file.size > MAX_PDF_SIZE_BYTES) throw new Error("El PDF supera el límite de 600 KB permitido por el plan actual.");

    const pdfBase64 = await readPdfAsDataUrl(file);

    await updateAppointmentPdf(appId, {
        pdfName: file.name,
        pdfUrl: null,
        storagePath: null,
        pdfBase64
    });
}

async function updateAppointmentPdf(appId, pdfData) {
    const idx = appointments.findIndex(a => a.id === appId);
    if (idx === -1) return false;
    await apiRequest(`/api/appointments/${appId}`, {
        method: "PATCH",
        body: pdfData
    });
    appointments[idx] = { ...appointments[idx], ...pdfData };
    return true;
}

async function updateAppointmentStatus(appId, newStatus) {
    const idx = appointments.findIndex(a => a.id === appId);
    if (idx === -1) return false;
    await apiRequest(`/api/appointments/${appId}`, {
        method: "PATCH",
        body: { status: newStatus }
    });
    appointments[idx] = { ...appointments[idx], status: newStatus };
    return true;
}

async function deleteAppointment(appId) {
    const len = appointments.length;
    await apiRequest(`/api/appointments/${appId}`, { method: "DELETE" });
    appointments = appointments.filter(a => a.id !== appId);
    if (appointments.length !== len) { return true; }
    return false;
}

// Utilidades de fecha
function getMonday(date) { const d = new Date(date); const day = d.getDay(); const diff = (day === 0 ? 6 : day - 1); d.setDate(d.getDate() - diff); d.setHours(0,0,0,0); return d; }
function formatDateYMD(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function formatDateDisplay(date) { return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`; }
function parseYmdAsLocalDate(dateString) {
    if (typeof dateString !== "string") return new Date(dateString);
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return new Date(dateString);
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
}
function getCoordinatorLabel(value) {
    return typeof value === "string" && value.trim() ? value.trim() : "Por asignar";
}
function getWeekDays(startMonday) { const days = []; for (let i = 0; i < 7; i++) { const d = new Date(startMonday); d.setDate(startMonday.getDate() + i); days.push(d); } return days; }

function getCompanyClass(company) {
    switch(company) {
        case "RAPIDO OCHOA": return "company-rapido-ochoa";
        case "ESPECIALES": return "company-especiales";
        case "TRANSEGOVIA": return "company-transegovia";
        default: return "company-default";
    }
}

function populateTransegoviaVehicleOptions(selectedValue = "") {
    const datalist = document.getElementById("modalVehicleTransegoviaList");
    const searchInput = document.getElementById("modalVehicleTransegovia");
    if (!datalist || !searchInput) return;
    let options = "";
    for (const vehicle of TRANSEGOVIA_VEHICLES) {
        options += `<option value="${escapeHtml(vehicle)}"></option>`;
    }
    // Conserva compatibilidad con citas antiguas que no estén en el listado base.
    if (selectedValue && !TRANSEGOVIA_VEHICLES.includes(selectedValue)) {
        options += `<option value="${escapeHtml(selectedValue)}"></option>`;
    }
    datalist.innerHTML = options;
    searchInput.value = selectedValue || "";
}

function populateCoordinatorOptions(selectedValue = "") {
    const coordinatorSelect = document.getElementById("modalCoordinator");
    if (!coordinatorSelect) return;
    const options = ['<option value="">Seleccione coordinador</option>'];
    for (const coordinator of COORDINATOR_OPTIONS) {
        options.push(`<option value="${escapeHtml(coordinator)}">${escapeHtml(coordinator)}</option>`);
    }
    if (selectedValue && !COORDINATOR_OPTIONS.includes(selectedValue)) {
        options.push(`<option value="${escapeHtml(selectedValue)}">${escapeHtml(selectedValue)}</option>`);
    }
    coordinatorSelect.innerHTML = options.join("");
    coordinatorSelect.value = selectedValue || "";
}

function updateVehicleFieldVisibility(prefillValue = "") {
    const company = document.getElementById("modalCompany")?.value || "";
    const vehicleInput = document.getElementById("modalVehicle");
    const vehicleSearchInput = document.getElementById("modalVehicleTransegovia");
    if (!vehicleInput || !vehicleSearchInput) return;

    if (company === "TRANSEGOVIA") {
        populateTransegoviaVehicleOptions(prefillValue);
        vehicleInput.style.display = "none";
        vehicleSearchInput.style.display = "block";
    } else {
        vehicleSearchInput.style.display = "none";
        vehicleInput.style.display = "block";
        if (prefillValue) vehicleInput.value = prefillValue;
    }
}

function getModalVehicleValue() {
    const company = document.getElementById("modalCompany")?.value || "";
    if (company === "TRANSEGOVIA") {
        return (document.getElementById("modalVehicleTransegovia")?.value || "").trim();
    }
    return (document.getElementById("modalVehicle")?.value || "").trim();
}

function shouldMaskAppointmentInCalendar(app) {
    if (!authenticatedUser || authenticatedUser.role !== "EMPRESA") return false;
    if (!authenticatedUser.company || authenticatedUser.company === "TODAS") return false;
    return app.company !== authenticatedUser.company;
}

function renderCalendar() {
    const container = document.getElementById("calendarGrid");
    if (!container) return;
    const weekDays = getWeekDays(currentWeekStart);
    const rangeLabel = `${formatDateDisplay(weekDays[0])} - ${formatDateDisplay(weekDays[6])}`;
    document.getElementById("weekRangeLabel").innerText = rangeLabel;

    let html = `<div class="calendar-time-header"></div>${weekDays.map(day => `<div class="calendar-day-header">${DAYS[day.getDay()===0?6:day.getDay()-1]}<br>${formatDateDisplay(day)}</div>`).join('')}`;
    for (let slot of TIME_SLOTS) {
        html += `<div class="calendar-time-label">${slot}</div>`;
        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
            const currentDate = weekDays[dayIdx];
            const dateStr = formatDateYMD(currentDate);
            const app = appointments.find(a => a.date === dateStr && a.time === slot);
            if (app) {
                if (shouldMaskAppointmentInCalendar(app)) {
                    html += `<div class="calendar-cell unavailable-slot">No disponible</div>`;
                    continue;
                }
                let statusText = app.status || "Pendiente";
                let statusClass = "";
                switch(statusText) {
                    case "No se presenta": statusClass = "status-no-show"; break;
                    case "habilitado": statusClass = "status-habilitado"; break;
                    case "inhabilitado": statusClass = "status-inhabilitado"; break;
                    case "condicionado": statusClass = "status-condicionado"; break;
                    default: statusClass = "status-pendiente";
                }
                const companyClass = getCompanyClass(app.company);
                const coordinatorDisplay = getCoordinatorLabel(app.coordinator);
                html += `<div class="calendar-cell appointment-block ${companyClass}" style="cursor: pointer;" data-id="${app.id}">
                            <strong>${escapeHtml(app.vehicle)}</strong>
                            <div style="font-size:0.65rem;">${escapeHtml(app.company)}</div>
                            <div style="font-size:0.65rem;">Coord: ${escapeHtml(coordinatorDisplay)}</div>
                            <span class="status-badge ${statusClass}" style="font-size:0.6rem;">${statusText}</span>
                        </div>`;
            } else {
                html += `<div class="calendar-cell" data-date="${dateStr}" data-time="${slot}"></div>`;
            }
        }
    }
    container.innerHTML = html;
    // Los eventos existentes siempre son clicables (ver detalles aunque no esté autenticado)
    document.querySelectorAll('.appointment-block[data-id]').forEach(block => {
        block.addEventListener('click', (e) => { e.stopPropagation(); const appId = block.getAttribute('data-id'); const app = appointments.find(a => a.id === appId); if (app) openModal(appId, app.date, app.time); });
    });
    // Las celdas vacías siempre son clicables para agendar
    document.querySelectorAll('.calendar-cell[data-date]').forEach(cell => {
        cell.addEventListener('click', (e) => { const date = cell.getAttribute('data-date'); const time = cell.getAttribute('data-time'); openModal(null, date, time); });
    });
}

function openModal(appId, date, time) {
    const coordRow = document.getElementById('coordinatorRow');
    const coordField = document.getElementById('modalCoordinator');
    const outcomeSection = document.getElementById('reviewOutcomeSection');
    const statusField = document.getElementById('modalStatus');
    const pdfInput = document.getElementById('modalPdfFile');
    const pdfCurrent = document.getElementById('modalPdfCurrent');
    const pdfDownload = document.getElementById('modalPdfDownload');
    const deleteBtn = document.getElementById('modalDeleteBtn');
    const managerMode = canManageRevisions();
    if (appId) {
        // Visualizar / editar cita existente
        const app = appointments.find(a => a.id === appId);
        if (!app) return;
        editingAppId = appId;
        document.getElementById("modalTitle").innerText = managerMode ? "Editar revisión" : "Detalle de revisión";
        document.getElementById("modalType").value = app.revisionType;
        populateAppointmentCompanyOptions(app.company);
        document.getElementById("modalCompany").value = app.company;
        document.getElementById("modalVehicle").value = app.vehicle;
        updateVehicleFieldVisibility(app.vehicle);
        populateCoordinatorOptions(app.coordinator || "");
        document.getElementById("modalDate").value = formatDateDisplay(parseYmdAsLocalDate(app.date));
        document.getElementById("modalTime").value = app.time;
        if (statusField) statusField.value = app.status || "";
        if (pdfInput) pdfInput.value = "";
        if (pdfCurrent) pdfCurrent.innerText = app.pdfName ? `Informe actual: ${app.pdfName}` : "Sin informe cargado.";
        if (pdfDownload) {
            const pdfUrl = getAppointmentPdfUrl(app);
            pdfDownload.innerHTML = pdfUrl
                ? createPdfDownloadLink(pdfUrl, app.pdfName || 'informe_revision.pdf', 'Descargar informe PDF')
                : '<span class="badge">Sin informe cargado</span>';
            attachPdfDownloadHandlers(pdfDownload);
        }
        if (outcomeSection) outcomeSection.style.display = '';
        if (coordRow) coordRow.style.display = '';
        if (coordField) coordField.disabled = !managerMode;
        if (deleteBtn) deleteBtn.style.display = managerMode ? '' : 'none';
    } else {
        // Nueva cita por tercero o coordinador
        editingAppId = null;
        document.getElementById("modalTitle").innerText = "Nueva revisión";
        document.getElementById("modalType").value = "REVISION";
        populateAppointmentCompanyOptions(getDefaultCompany());
        document.getElementById("modalCompany").value = getDefaultCompany();
        document.getElementById("modalVehicle").value = "";
        updateVehicleFieldVisibility("");
        populateCoordinatorOptions("");
        if (coordRow) coordRow.style.display = '';
        if (coordField) coordField.disabled = false;
        document.getElementById("modalDate").value = formatDateDisplay(parseYmdAsLocalDate(date));
        document.getElementById("modalTime").value = time;
        if (statusField) statusField.value = "";
        if (pdfInput) pdfInput.value = "";
        if (pdfCurrent) pdfCurrent.innerText = "";
        if (pdfDownload) pdfDownload.innerHTML = "";
        if (outcomeSection) outcomeSection.style.display = '';
        if (deleteBtn) deleteBtn.style.display = 'none';
    }
    // Resto de campos: solo lectura al ver cita sin autenticación
    const readOnly = !managerMode && !!appId;
    ['modalType','modalCompany','modalVehicle','modalVehicleTransegovia','modalStatus','modalPdfFile'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = readOnly; });
    document.getElementById('modalConfirmBtn').style.display = readOnly ? 'none' : '';
    document.getElementById("appointmentModal").style.display = "flex";
}

function closeModal() { ['modalType','modalCompany','modalVehicle','modalVehicleTransegovia','modalCoordinator','modalStatus','modalPdfFile'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = false; }); const coordRow = document.getElementById('coordinatorRow'); if (coordRow) coordRow.style.display = ''; const outcomeSection = document.getElementById('reviewOutcomeSection'); if (outcomeSection) outcomeSection.style.display = 'none'; const pdfCurrent = document.getElementById('modalPdfCurrent'); if (pdfCurrent) pdfCurrent.innerText = ''; const pdfDownload = document.getElementById('modalPdfDownload'); if (pdfDownload) pdfDownload.innerHTML = ''; const deleteBtn = document.getElementById('modalDeleteBtn'); if (deleteBtn) deleteBtn.style.display = 'none'; document.getElementById('modalConfirmBtn').style.display = ''; document.getElementById("appointmentModal").style.display = "none"; editingAppId = null; }

async function confirmModal() {
    const type = document.getElementById("modalType").value;
    const company = document.getElementById("modalCompany").value;
    const vehicle = getModalVehicleValue();
    // Si el tercero no asigna coordinador, queda como "Por asignar"
    const coordinator = (document.getElementById("modalCoordinator")?.value || "").trim();
    const status = (document.getElementById("modalStatus")?.value || "").trim();
    const pdfFile = document.getElementById("modalPdfFile")?.files?.[0] || null;
    const managerMode = canManageRevisions();
    let date, time;
    if (editingAppId) {
        const app = appointments.find(a => a.id === editingAppId);
        if (app) { date = app.date; time = app.time; }
        else { showTemporaryMessage("Error: cita no encontrada.", "error"); return; }
    } else {
        const dateStr = document.getElementById("modalDate").value;
        const timeStr = document.getElementById("modalTime").value;
        const parts = dateStr.split('/');
        if (parts.length === 3) date = `${parts[2]}-${parts[1]}-${parts[0]}`;
        else { showTemporaryMessage("Fecha inválida.", "error"); return; }
        time = timeStr;
    }
    if (!vehicle || !company || !type || !coordinator || !status) {
        showTemporaryMessage("Complete los campos obligatorios: tipo, empresa, vehículo, coordinador y resultado.", "error");
        return;
    }
    if (pdfFile && pdfFile.type !== 'application/pdf') {
        showTemporaryMessage("Solo se permite informe en PDF.", "error");
        return;
    }
    if (pdfFile && pdfFile.size > MAX_PDF_SIZE_BYTES) {
        showTemporaryMessage("El PDF supera el límite de 600 KB permitido por el plan actual.", "error");
        return;
    }
    try {
        const result = await addOrUpdateAppointment({ id: editingAppId, revisionType: type, company, vehicle, coordinator, date, time, status });
        if (!result.success) {
            showTemporaryMessage(result.message, "error");
            return;
        }

        const appId = result.appointmentId;
        if (managerMode && appId) {
            await updateAppointmentStatus(appId, status);
            if (pdfFile) {
                try {
                    await uploadPdfFile(appId, pdfFile);
                } catch (e) {
                    showTemporaryMessage(e.message || "No se pudo cargar el PDF seleccionado.", "error");
                    return;
                }
            }
        }

        showTemporaryMessage(result.message, "success");
        closeModal();
        renderCalendar();
        renderConsolidatedTable();
    } catch (error) {
        showTemporaryMessage(error.message || "No fue posible guardar la cita.", "error");
    }
}

function navigateWeek(delta) { const newStart = new Date(currentWeekStart); newStart.setDate(currentWeekStart.getDate() + delta * 7); currentWeekStart = getMonday(newStart); renderCalendar(); }

function renderConsolidatedTable() {
    const tbody = document.getElementById("appointmentsTbody");
    const adminActionsHeader = document.getElementById("adminActionsHeader");
    const canManageAppointments = canManageRevisions();
    const canUploadCoordinatorDocs = canUploadCoordinatorDocuments();
    const canUploadOrderDocs = canUploadOrderDocument();
    const isCompanyUser = authenticatedUser && authenticatedUser.role === "EMPRESA" && authenticatedUser.company && authenticatedUser.company !== "TODAS";
    const visibleAppointments = isCompanyUser ? appointments.filter(app => app.company === authenticatedUser.company) : appointments;
    if (!tbody) return;
    if (adminActionsHeader) adminActionsHeader.style.display = canManageAppointments ? "table-cell" : "none";
    if (!visibleAppointments.length) {
        tbody.innerHTML = `<tr><td colspan="${canManageAppointments ? 12 : 11}" style="text-align:center;">No hay revisiones agendadas.</td></tr>`;
        return;
    }
    const sorted = [...visibleAppointments].sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    let html = "";
    for (const app of sorted) {
        const pdfUrl = getAppointmentPdfUrl(app);
        const pdfInfo = pdfUrl ? createPdfDownloadLink(pdfUrl, app.pdfName || 'informe_revision.pdf') : `<span class="badge">No cargado</span>`;
        const remisionCell = buildDocumentCell(app, "remision", canUploadCoordinatorDocs);
        const ordenPedidoCell = buildDocumentCell(app, "ordenPedido", canUploadOrderDocs);
        const facturaCell = buildDocumentCell(app, "factura", canUploadCoordinatorDocs);
        let statusCell = `<span class="status-badge ${getStatusClass(app.status)}">${app.status||"Pendiente"}</span>`;
        html += `<tr data-id="${app.id}">
                     <td>${escapeHtml(app.revisionType)}</td>
                     <td>${escapeHtml(app.company)}</td>
                     <td>${escapeHtml(app.vehicle)}</td>
                     <td>${escapeHtml(getCoordinatorLabel(app.coordinator))}</td>
                     <td>${app.date}</td>
                     <td>${app.time}</td>
                     <td class="doc-cell"><div class="doc-cell-content">${pdfInfo}</div></td>
                     <td class="doc-cell">${remisionCell}</td>
                     <td class="doc-cell">${ordenPedidoCell}</td>
                     <td class="doc-cell">${facturaCell}</td>
                     <td>${statusCell}</td>`;
        if (canManageAppointments) {
            html += `<td><button class="btn-small danger btn-delete-appointment" data-id="${app.id}">Eliminar</button></td>`;
        }
        html += `</tr>`;
    }
    tbody.innerHTML = html;
    attachPdfDownloadHandlers(tbody);
}

function getStatusClass(status) { switch(status) { case "No se presenta": return "status-no-show"; case "habilitado": return "status-habilitado"; case "inhabilitado": return "status-inhabilitado"; case "condicionado": return "status-condicionado"; default: return "status-pendiente"; } }
async function handleDocumentUploadClick(buttonElement) {
    const appId = buttonElement.getAttribute("data-id");
    const docType = buttonElement.getAttribute("data-doc-type");
    const row = buttonElement.closest("tr");
    if (!appId || !docType || !row) return;

    if (docType === "ordenPedido" && !canUploadOrderDocument()) {
        showTemporaryMessage("No tiene permisos para cargar orden de pedido.", "error");
        return;
    }
    if ((docType === "remision" || docType === "factura") && !canUploadCoordinatorDocuments()) {
        showTemporaryMessage("No tiene permisos para cargar este documento.", "error");
        return;
    }

    const fileInput = row.querySelector(`.doc-upload-input[data-id="${appId}"][data-doc-type="${docType}"]`);
    if (!fileInput) {
        showTemporaryMessage("No fue posible abrir el selector de archivo.", "error");
        return;
    }

    fileInput.value = "";
    fileInput.click();
}

async function handleDocumentUploadFileInput(inputElement) {
    const appId = inputElement.getAttribute("data-id");
    const docType = inputElement.getAttribute("data-doc-type");
    const file = inputElement.files && inputElement.files[0] ? inputElement.files[0] : null;

    if (!appId || !docType || !file) return;

    if (docType === "ordenPedido" && !canUploadOrderDocument()) {
        showTemporaryMessage("No tiene permisos para cargar orden de pedido.", "error");
        return;
    }
    if ((docType === "remision" || docType === "factura") && !canUploadCoordinatorDocuments()) {
        showTemporaryMessage("No tiene permisos para cargar este documento.", "error");
        return;
    }

    try {
        await uploadAppointmentDocument(appId, docType, file);
        const label = getDocumentConfig(docType)?.label || "Documento";
        showTemporaryMessage(`${label} cargado correctamente.`, "success");
        renderConsolidatedTable();
        renderCalendar();
    } catch (error) {
        showTemporaryMessage(error.message || "No fue posible cargar el documento.", "error");
    } finally {
        inputElement.value = "";
    }
}
async function handleDeleteClick(e) { const id = e.currentTarget.getAttribute('data-id'); const app = appointments.find(a => a.id === id); if (!app) return; if (confirm(`Eliminar ${app.vehicle} - ${app.company} el ${app.date} a las ${app.time}?`)) { try { await deleteAppointment(id); renderCalendar(); renderConsolidatedTable(); showTemporaryMessage("Cita eliminada.", "success"); } catch (error) { showTemporaryMessage(error.message || "No fue posible eliminar la cita.", "error"); } } }
async function handleModalDeleteClick() { if (!editingAppId) return; const app = appointments.find(a => a.id === editingAppId); if (!app) { showTemporaryMessage("Cita no encontrada.", "error"); return; } if (!confirm(`Eliminar ${app.vehicle} - ${app.company} el ${app.date} a las ${app.time}?`)) return; try { await deleteAppointment(editingAppId); closeModal(); renderCalendar(); renderConsolidatedTable(); showTemporaryMessage("Cita eliminada.", "success"); } catch (error) { showTemporaryMessage(error.message || "No fue posible eliminar la cita.", "error"); } }
function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m])); }
let globalMsgTimeout = null;
function showTemporaryMessage(msg, type) { const div = document.getElementById("calendarMessage"); if (div) { div.innerHTML = msg; div.className = `msg ${type==="error"?"error-msg":type==="success"?"success-msg":""}`; div.style.display = "block"; if (globalMsgTimeout) clearTimeout(globalMsgTimeout); globalMsgTimeout = setTimeout(() => { div.style.display = "none"; div.innerHTML = ""; }, 4000); } else alert(msg); }

function populateAppointmentCompanyOptions(selectedValue = "") {
    const companySelect = document.getElementById("modalCompany");
    if (!companySelect) return;
    const options = [...companyOptions];
    const normalizedSelected = normalizeCompanyName(selectedValue);
    if (normalizedSelected && !options.includes(normalizedSelected)) {
        options.push(normalizedSelected);
    }
    companySelect.innerHTML = options.map(company => `<option value="${company}">${company}</option>`).join("");
    companySelect.value = normalizedSelected || getDefaultCompany();
}

function populateUserCompanyOptions() {
    const companySelect = document.getElementById("newUserCompany");
    if (!companySelect) return;
    companySelect.innerHTML = companyOptions.map(company => `<option value="${company}">${company}</option>`).join("");
}

function updateNewUserCompanyState() {
    const roleSelect = document.getElementById("newUserRole");
    const companySelect = document.getElementById("newUserCompany");
    if (!roleSelect || !companySelect) return;
    companySelect.disabled = roleSelect.value !== "EMPRESA";
}

function renderUsersTable() {
    const tbody = document.getElementById("usersTbody");
    if (!tbody) return;
    if (!canManageUsers()) {
        tbody.innerHTML = "<tr><td colspan=\"5\">Sin permisos.</td></tr>";
        return;
    }
    if (!authConfig.users.length) {
        tbody.innerHTML = "<tr><td colspan=\"5\">No hay usuarios creados.</td></tr>";
        return;
    }

    let html = "";
    for (const user of authConfig.users) {
        const companyOptionsForUser = ["TODAS", ...companyOptions]
            .map(company => `<option value="${company}" ${company === user.company ? "selected" : ""}>${company}</option>`)
            .join("");
        const companyDisabled = user.role === "EMPRESA" ? "" : "disabled";
        const blockBadge = user.blocked ? `<span class="status-badge status-inhabilitado" style="margin-left:6px;">BLOQUEADO</span>` : "";
        const blockButtonClass = user.blocked ? "secondary" : "danger";
        const blockButtonText = user.blocked ? "Desbloquear" : "Bloquear";
        html += `<tr data-user-id="${user.id}">
                    <td>${escapeHtml(user.fullName || user.username)}</td>
                    <td>${escapeHtml(user.username)} ${blockBadge}</td>
                    <td>${escapeHtml(user.role)}</td>
                    <td>
                        <select class="user-company-select" data-user-id="${user.id}" ${companyDisabled}>${companyOptionsForUser}</select>
                    </td>
                    <td>
                        <button class="btn-small secondary btn-assign-company" data-user-id="${user.id}">Asignar empresa</button>
                        <button class="btn-small btn-reset-password" data-user-id="${user.id}">Restablecer clave</button>
                        <button class="btn-small ${blockButtonClass} btn-toggle-block-user" data-user-id="${user.id}">${blockButtonText}</button>
                        <button class="btn-small danger btn-delete-user" data-user-id="${user.id}">Eliminar</button>
                    </td>
                 </tr>`;
    }
    tbody.innerHTML = html;
}

function renderUserManagementSection() {
    const card = document.getElementById("userManagementCard");
    if (!card) return;
    if (!canManageUsers()) {
        card.style.display = "none";
        return;
    }
    card.style.display = "block";
    populateUserCompanyOptions();
    populateAppointmentCompanyOptions();
    updateNewUserCompanyState();
    renderUsersTable();
}

async function createUser() {
    if (!canManageUsers()) {
        showTemporaryMessage("No tiene permisos para crear usuarios.", "error");
        return;
    }
    const fullNameInput = document.getElementById("newUserFullName");
    const usernameInput = document.getElementById("newUserName");
    const passwordInput = document.getElementById("newUserPassword");
    const roleInput = document.getElementById("newUserRole");
    const companyInput = document.getElementById("newUserCompany");
    const fullName = (fullNameInput?.value || "").trim();
    const username = (usernameInput?.value || "").trim();
    const password = (passwordInput?.value || "").trim();
    const role = roleInput?.value || "EMPRESA";
    const company = role === "EMPRESA" ? normalizeCompanyName(companyInput?.value || getDefaultCompany()) : "TODAS";

    if (!fullName || !username || !password) {
        showTemporaryMessage("Ingrese nombre, usuario y clave para crear el registro.", "error");
        return;
    }
    if (password.length < 4) {
        showTemporaryMessage("La clave debe tener al menos 4 caracteres.", "error");
        return;
    }
    if (findUserByUsername(username)) {
        showTemporaryMessage("Ese nombre de usuario ya existe.", "error");
        return;
    }

    try {
        const createdUser = await apiRequest("/api/users", {
            method: "POST",
            body: { fullName, username, password, role, company }
        });
        authConfig.users.push(createdUser);
        if (fullNameInput) fullNameInput.value = "";
        if (usernameInput) usernameInput.value = "";
        if (passwordInput) passwordInput.value = "";
        renderUsersTable();
        showTemporaryMessage("Usuario creado correctamente.", "success");
    } catch (error) {
        showTemporaryMessage(error.message || "No fue posible crear el usuario.", "error");
    }
}

async function createCompany() {
    if (!canManageUsers()) {
        showTemporaryMessage("No tiene permisos para crear empresas.", "error");
        return;
    }
    const companyInput = document.getElementById("newCompanyName");
    const companyName = normalizeCompanyName(companyInput?.value || "");
    if (!companyName) {
        showTemporaryMessage("Ingrese el nombre de la empresa.", "error");
        return;
    }
    if (companyOptions.includes(companyName)) {
        showTemporaryMessage("Esa empresa ya existe.", "error");
        return;
    }
    try {
        const created = await apiRequest("/api/companies", {
            method: "POST",
            body: { name: companyName }
        });
        companyOptions = normalizeCompanyList([...(companyOptions || []), created.name]);
        if (companyInput) companyInput.value = "";
        populateUserCompanyOptions();
        populateAppointmentCompanyOptions();
        renderUsersTable();
        updateNewUserCompanyState();
        showTemporaryMessage(`Empresa ${created.name} creada correctamente.`, "success");
    } catch (error) {
        showTemporaryMessage(error.message || "No fue posible crear la empresa.", "error");
    }
}

async function assignUserCompany(userId) {
    const user = getUserById(userId);
    if (!user) {
        showTemporaryMessage("Usuario no encontrado.", "error");
        return;
    }
    if (user.role !== "EMPRESA") {
        showTemporaryMessage("Solo los usuarios EMPRESA requieren asignación específica.", "error");
        return;
    }
    const select = document.querySelector(`.user-company-select[data-user-id="${userId}"]`);
    if (!select) return;
    try {
        await apiRequest(`/api/users/${userId}`, {
            method: "PATCH",
            body: { company: select.value }
        });
        user.company = select.value;
        showTemporaryMessage(`Empresa asignada a ${user.username}.`, "success");
        if (authenticatedUser && authenticatedUser.id === user.id) {
            authenticatedUser.company = user.company;
        }
    } catch (error) {
        showTemporaryMessage(error.message || "No fue posible asignar la empresa.", "error");
    }
}

async function resetUserPassword(userId) {
    const user = getUserById(userId);
    if (!user) {
        showTemporaryMessage("Usuario no encontrado.", "error");
        return;
    }
    const newPasswordInput = prompt(`Nueva clave para ${user.username} (mínimo 4 caracteres):`);
    if (newPasswordInput === null) return;
    const newPassword = newPasswordInput.trim();
    if (newPassword.length < 4) {
        showTemporaryMessage("La nueva clave debe tener al menos 4 caracteres.", "error");
        return;
    }
    try {
        await apiRequest(`/api/users/${userId}/password`, {
            method: "PATCH",
            body: { password: newPassword }
        });
        user.password = newPassword;
        user.blocked = false;
        showTemporaryMessage(`Clave restablecida y usuario desbloqueado para ${user.username}.`, "success");
        renderUsersTable();
    } catch (error) {
        showTemporaryMessage(error.message || "No fue posible restablecer la clave.", "error");
    }
}

async function toggleUserBlocked(userId) {
    const user = getUserById(userId);
    if (!user) {
        showTemporaryMessage("Usuario no encontrado.", "error");
        return;
    }
    if (authenticatedUser && user.id === authenticatedUser.id) {
        showTemporaryMessage("No puede bloquear su propio usuario.", "error");
        return;
    }
    try {
        const nextBlocked = !user.blocked;
        await apiRequest(`/api/users/${userId}/block`, {
            method: "PATCH",
            body: { blocked: nextBlocked }
        });
        user.blocked = nextBlocked;
        renderUsersTable();
        showTemporaryMessage(user.blocked ? `Usuario ${user.username} bloqueado.` : `Usuario ${user.username} desbloqueado.`, "success");
    } catch (error) {
        showTemporaryMessage(error.message || "No fue posible cambiar el estado del usuario.", "error");
    }
}

async function deleteUser(userId) {
    const user = getUserById(userId);
    if (!user) {
        showTemporaryMessage("Usuario no encontrado.", "error");
        return;
    }
    if (authenticatedUser && user.id === authenticatedUser.id) {
        showTemporaryMessage("No puede eliminar su propio usuario.", "error");
        return;
    }
    const confirmed = confirm(`Eliminar el usuario ${user.username}?`);
    if (!confirmed) return;
    try {
        await apiRequest(`/api/users/${userId}`, { method: "DELETE" });
        authConfig.users = authConfig.users.filter(existingUser => existingUser.id !== userId);
        renderUsersTable();
        showTemporaryMessage(`Usuario ${user.username} eliminado.`, "success");
    } catch (error) {
        showTemporaryMessage(error.message || "No fue posible eliminar el usuario.", "error");
    }
}

function handleUsersTableClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const userId = target.getAttribute("data-user-id");
    if (!userId) return;
    if (target.classList.contains("btn-assign-company")) assignUserCompany(userId);
    if (target.classList.contains("btn-reset-password")) resetUserPassword(userId);
    if (target.classList.contains("btn-toggle-block-user")) toggleUserBlocked(userId);
    if (target.classList.contains("btn-delete-user")) deleteUser(userId);
}

function handleAppointmentsTableClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.classList.contains("btn-upload-document")) {
        handleDocumentUploadClick(target);
        return;
    }
    const appointmentId = target.getAttribute("data-id");
    if (!appointmentId) return;
    if (target.classList.contains("btn-delete-appointment")) handleDeleteClick(event);
}

function handleAppointmentsTableChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.classList.contains("doc-upload-input")) {
        handleDocumentUploadFileInput(target);
    }
}

function updateUIForAuth(loggedIn) {
    const statusSpan = document.getElementById("userStatusText");
    const logoutBtn = document.getElementById("logoutBtn");
    if (loggedIn && authenticatedUser) {
        const assignedCompany = authenticatedUser.company && authenticatedUser.company.trim() ? authenticatedUser.company : "SIN EMPRESA";
        statusSpan.innerHTML = `${authenticatedUser.name} (${assignedCompany})`;
        if (logoutBtn) logoutBtn.style.display = "inline-flex";
    } else {
        statusSpan.innerHTML = "No autenticado";
        if (logoutBtn) logoutBtn.style.display = "none";
        authenticatedUser = null;
        isAuthenticated = false;
    }
    renderUserManagementSection();
}

function logoutUser() {
    clearActiveSession();
    authenticatedUser = null;
    isAuthenticated = false;
    window.location.href = "login.html";
}

function bindGlobalEvents() {
    document.getElementById("logoutBtn").addEventListener("click", logoutUser);
    document.getElementById("createUserBtn").addEventListener("click", createUser);
    document.getElementById("createCompanyBtn").addEventListener("click", createCompany);
    document.getElementById("newUserRole").addEventListener("change", updateNewUserCompanyState);
    document.getElementById("usersTbody").addEventListener("click", handleUsersTableClick);
    document.getElementById("appointmentsTbody").addEventListener("click", handleAppointmentsTableClick);
    document.getElementById("appointmentsTbody").addEventListener("change", handleAppointmentsTableChange);
    document.getElementById("prevWeekBtn").addEventListener("click", () => navigateWeek(-1));
    document.getElementById("nextWeekBtn").addEventListener("click", () => navigateWeek(1));
    document.getElementById("modalCompany").addEventListener("change", () => updateVehicleFieldVisibility(""));
    document.getElementById("modalDeleteBtn").addEventListener("click", handleModalDeleteClick);
    document.getElementById("modalCancelBtn").addEventListener("click", closeModal);
    document.getElementById("modalConfirmBtn").addEventListener("click", confirmModal);
    window.addEventListener("click", (e) => { if (e.target === document.getElementById("appointmentModal")) closeModal(); });
}

async function init() {
    try {
        await loadCompanyOptionsFromApi();
        await loadAuthConfig();
        if (!restoreSessionUser()) {
            window.location.href = "login.html";
            return;
        }
        await loadAppointmentsFromApi();
        currentWeekStart = getMonday(new Date());
        populateTransegoviaVehicleOptions();
        populateUserCompanyOptions();
        populateAppointmentCompanyOptions();
        bindGlobalEvents();
        updateVehicleFieldVisibility("");
        updateUIForAuth(true);
        renderCalendar();
        renderConsolidatedTable();
    } catch (error) {
        showTemporaryMessage(error.message || "No fue posible conectar con el servidor.", "error");
    }
}
init();