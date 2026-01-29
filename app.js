const $ = (id) => document.getElementById(id);

const loginCard = $("loginCard");
const appCard = $("appCard");
const loginMsg = $("loginMsg");

let CURRENT_USER = null;

/* -----------------------
   UI helpers
----------------------- */
function showLogin(message = "") {
  loginCard?.classList.remove("hidden");
  appCard?.classList.add("hidden");
  if (loginMsg) loginMsg.textContent = message;
}

function showApp(user) {
  CURRENT_USER = user;

  loginCard?.classList.add("hidden");
  appCard?.classList.remove("hidden");
  if (loginMsg) loginMsg.textContent = "";

  initShell(user);
}

/* -----------------------
   API
----------------------- */
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function checkSession() {
  try {
    const data = await api("/api/auth/me");
    const user = data.user || data;
    showApp(user);
  } catch {
    showLogin("");
  }
}

/* -----------------------
   AUTH actions
----------------------- */
function doRegister() {
  if (loginMsg) {
    loginMsg.textContent =
      "Регистрация закрыта. Сотрудник может зарегистрироваться только по ссылке-приглашению (/invite/...).";
  }
}

async function doLogin() {
  if (loginMsg) loginMsg.textContent = "";

  const email = $("email")?.value.trim();
  const password = $("password")?.value;

  if (!email || !password) {
    if (loginMsg) loginMsg.textContent = "Введите email и пароль";
    return;
  }

  try {
    const data = await api("/api/auth/login", { method: "POST", body: { email, password } });
    const user = data.user || data;
    showApp(user);
  } catch (e) {
    if (loginMsg) loginMsg.textContent = `❌ ${e.message}`;
  }
}

async function doLogout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {}
  CURRENT_USER = null;
  showLogin("Вы вышли из системы.");
}

/* -----------------------
   SHELL
----------------------- */
function initShell(user) {
  // имя справа
  const avatarName = $("avatarName");
  if (avatarName) avatarName.textContent = user?.full_name || user?.email || "Профиль";

  // burger
  const btnSidebar = $("btnSidebar");
  const sidebar = $("sidebar");

  if (btnSidebar) {
    btnSidebar.onclick = () => {
      document.body.classList.toggle("sidebar-collapsed");

      if (window.matchMedia("(max-width: 980px)").matches && sidebar) {
        sidebar.classList.toggle("is-open");
      }
    };
  }

  // logout
  const btnLogout = $("btnLogout");
  if (btnLogout) btnLogout.onclick = doLogout;

  // profile
  const btnProfile = $("btnProfile");
  if (btnProfile) btnProfile.onclick = () => renderView("profile");

  // nav
  const nav = $("mainNav");
  if (nav) {
    nav.onclick = (e) => {
      const item = e.target.closest(".nav__item");
      if (!item) return;

      nav.querySelectorAll(".nav__item").forEach((b) => b.classList.remove("active"));
      item.classList.add("active");

      renderView(item.dataset.view);

      if (window.matchMedia("(max-width: 980px)").matches && sidebar) {
        sidebar.classList.remove("is-open");
      }
    };
  }

  renderView("tasks");
}

function renderView(view) {
  const root = $("viewRoot");
  if (!root) return;

  if (view === "tasks") {
    root.innerHTML = renderTasksHtml(CURRENT_USER);
    wireTasksHandlers();
    loadLogs().catch(() => {});
    return;
  }

  if (view === "profile") {
    root.innerHTML = `
      <div class="card">
        <h2 style="margin:0 0 8px 0;">Профиль</h2>
        <div class="muted">Пока заглушка. Дальше сделаем редактирование профиля.</div>
        <hr/>
        <div><b>Email:</b> ${escapeHtml(CURRENT_USER?.email || "")}</div>
        <div><b>Роль:</b> ${escapeHtml(CURRENT_USER?.role || "")}</div>
        <div><b>Имя:</b> ${escapeHtml(CURRENT_USER?.full_name || "")}</div>
      </div>
    `;
    return;
  }

  const titles = {
    drive: "Диск",
    board: "Доска",
    mail: "Почта",
    crm: "CRM",
    marketing: "Маркетинг",
    warehouse: "Складской учёт",
    sites: "Сайты и магазины",
    sign: "Подпись",
    employees: "Сотрудники",
    automation: "Автоматизация",
  };

  root.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 8px 0;">${titles[view] || "Раздел"}</h2>
      <div class="muted">Здесь будет функционал раздела. Сейчас заглушка.</div>
    </div>
  `;
}

/* -----------------------
   TASKS view
----------------------- */
function renderTasksHtml(user) {
  const isOwner = user?.role === "owner";

  return `
    <div class="grid" style="grid-template-columns: 1fr; gap: 12px;">
      ${isOwner ? `
        <div class="card">
          <h2 style="margin:0 0 10px 0;">Создать приглашение</h2>
          <div class="row" style="gap:10px; flex-wrap:wrap;">
            <input id="invEmail" type="email" placeholder="Email сотрудника (необязательно)" style="min-width:260px;">
            <select id="invRole" style="min-width:160px;">
              <option value="worker">worker</option>
              <option value="manager">manager</option>
            </select>
            <input id="invTtl" type="number" value="72" min="1" style="width:120px;" title="Срок (часов)">
            <button id="btnCreateInvite" class="btn primary" type="button">Создать приглашение</button>
          </div>
          <div id="invOut" class="small" style="margin-top:10px;"></div>
        </div>
      ` : ""}

      <div class="card">
        <h2 style="margin:0 0 10px 0;">Добавить запись обслуживания</h2>

        <div class="grid">
          <input id="object_name" placeholder="Объект (например: Magdacesti)" />
          <input id="task_type" placeholder="Тип работ (например: Газон / Полив / Уборка)" />
          <input id="project_id" placeholder="Project ID (необязательно)" />
          <textarea id="notes" placeholder="Заметки"></textarea>
        </div>

        <div class="row" style="margin-top:10px;">
          <button id="btnAddLog" class="btn primary" type="button">Сохранить</button>
          <button id="btnReload" class="btn secondary" type="button">Обновить список</button>
        </div>

        <p id="appMsg" class="msg"></p>

        <h2 style="margin-top:16px;">Последние 200 записей</h2>
        <div id="logs" class="logs"></div>
      </div>
    </div>
  `;
}

function wireTasksHandlers() {
  $("btnAddLog") && ($("btnAddLog").onclick = addLog);
  $("btnReload") && ($("btnReload").onclick = () => loadLogs());
  $("btnCreateInvite") && ($("btnCreateInvite").onclick = createInvite);
}

/* -----------------------
   INVITES
----------------------- */
async function createInvite() {
  const out = $("invOut");
  if (out) out.textContent = "Создаём...";

  const email = $("invEmail")?.value.trim();
  const role = $("invRole")?.value || "worker";
  const ttl_hours = Number($("invTtl")?.value || 72);

  try {
    const data = await api("/api/invites", {
      method: "POST",
      body: { email: email || null, role, ttl_hours },
    });

    const link = data.inviteLink;

    if (out) {
      out.innerHTML = `
        ✅ Ссылка создана (до ${escapeHtml(data.expires_at || "")})<br/>
        <div style="margin-top:6px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <input id="inviteLinkField" value="${escapeHtml(link)}" style="min-width:420px;" readonly />
          <button id="btnCopyInvite" class="btn" type="button">Скопировать</button>
          <a class="btn" href="${escapeHtml(link)}" target="_blank" rel="noreferrer">Открыть</a>
        </div>
      `;
    }

    const btnCopy = $("btnCopyInvite");
    if (btnCopy) {
      btnCopy.onclick = async () => {
        const field = $("inviteLinkField");
        if (!field) return;
        field.select();
        field.setSelectionRange(0, 99999);
        try {
          await navigator.clipboard.writeText(field.value);
          alert("Ссылка скопирована ✅");
        } catch {
          document.execCommand("copy");
          alert("Ссылка скопирована ✅");
        }
      };
    }
  } catch (e) {
    if (out) out.textContent = `❌ ${e.message}`;
  }
}

/* -----------------------
   SERVICE LOGS
----------------------- */
async function addLog() {
  const msg = $("appMsg");
  if (msg) msg.textContent = "";

  const object_name = $("object_name")?.value.trim();
  const task_type = $("task_type")?.value.trim();
  const project_id = $("project_id")?.value.trim();
  const notes = $("notes")?.value.trim();

  if (!object_name || !task_type) {
    if (msg) msg.textContent = "❌ Заполни object_name и task_type";
    return;
  }

  try {
    await api("/api/service-log", {
      method: "POST",
      body: {
        object_name,
        task_type,
        project_id: project_id || null,
        notes: notes || null,
        photo_base64: null,
      },
    });

    $("notes") && ($("notes").value = "");
    if (msg) msg.textContent = "✅ Сохранено";
    await loadLogs();
  } catch (e) {
    if (msg) msg.textContent = `❌ ${e.message}`;
  }
}

async function loadLogs() {
  const data = await api("/api/service-log");
  renderLogs(data.rows || []);
}

function renderLogs(rows) {
  const root = $("logs");
  if (!root) return;

  root.innerHTML = "";
  for (const r of rows || []) {
    const el = document.createElement("div");
    el.className = "logitem";
    el.innerHTML = `
      <div class="loghead">
        <div>#${r.id} — ${escapeHtml(r.object_name)} / ${escapeHtml(r.task_type)}</div>
        <div class="small">${escapeHtml(r.created_at || "")}</div>
      </div>
      <div class="small">project_id: ${escapeHtml(String(r.project_id ?? ""))} | user_id: ${escapeHtml(String(r.user_id ?? ""))}</div>
      <div>${escapeHtml(r.notes || "")}</div>
    `;
    root.appendChild(el);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* -----------------------
   Bind login events
----------------------- */
$("btnRegister")?.addEventListener("click", doRegister);
$("btnLogin")?.addEventListener("click", doLogin);

// auto-check session
checkSession();
