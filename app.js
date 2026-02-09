/* =====================================
   Garden Industry Control — app.js
   INVITES + STRUCTURE (tree like Bitrix) + EMPLOYEES
   Permissions:
   - Invites: owner OR can_invite
   - Structure: owner OR can_manage_structure OR department manager (for sub-deps)
   - Employees: owner (for now)
===================================== */

const $ = (id) => document.getElementById(id);

const loginCard = $("loginCard");
const appCard = $("appCard");
const loginMsg = $("loginMsg");

let CURRENT_USER = null;

/* ================= API ================= */
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function tryApi(paths, options = {}) {
  let lastErr = null;
  for (const p of paths) {
    try {
      return await api(p, options);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Request failed");
}

/* ================= UI ================= */
function showLogin(message = "") {
  loginCard?.classList.remove("hidden");
  appCard?.classList.add("hidden");
  if (loginMsg) loginMsg.textContent = message;
}

function showApp(user) {
  CURRENT_USER = user;

  const avatarName = $("avatarName");
  if (avatarName && CURRENT_USER) {
    avatarName.textContent = CURRENT_USER.full_name || CURRENT_USER.email || "Профиль";
  }

  loginCard?.classList.add("hidden");
  appCard?.classList.remove("hidden");
  if (loginMsg) loginMsg.textContent = "";
  initShell();
}

function isInviteAllowed() {
  return !!CURRENT_USER && (CURRENT_USER.role === "owner" || !!CURRENT_USER.can_invite);
}

function canManageStructure() {
  return !!CURRENT_USER && (CURRENT_USER.role === "owner" || !!CURRENT_USER.can_manage_structure);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/* ================= AUTH ================= */
async function doLogin() {
  if (loginMsg) loginMsg.textContent = "";

  const email = $("email")?.value?.trim();
  const password = $("password")?.value;

  if (!email || !password) {
    if (loginMsg) loginMsg.textContent = "Введите email и пароль";
    return;
  }

  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const meData = await api("/api/auth/me");
    showApp(meData.user || meData);
  } catch (e) {
    if (loginMsg) loginMsg.textContent = "❌ " + e.message;
  }
}

async function doLogout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {}
  CURRENT_USER = null;
  showLogin("Вы вышли из системы");
}

async function checkSession() {
  try {
    const data = await api("/api/auth/me");
    showApp(data.user || data);
  } catch {
    showLogin("");
  }
}

/* ================= SHELL ================= */
function initShell() {
  // sidebar collapse
  const btnSidebar = $("btnSidebar");
  if (btnSidebar) {
    btnSidebar.onclick = () => document.body.classList.toggle("sidebar-collapsed");
  }

  const btnLogout = $("btnLogout");
  if (btnLogout) btnLogout.onclick = doLogout;

  const btnProfile = $("btnProfile");
  if (btnProfile) {
    btnProfile.onclick = () => {
      const name = (CURRENT_USER?.full_name || "").trim() || "Без имени";
      const email = CURRENT_USER?.email || "";
      alert(`${name}\n${email}`);
    };
  }

  // nav clicks
  const nav = $("mainNav");
  if (nav) {
    nav.onclick = (e) => {
      const btn = e.target.closest(".nav__item");
      if (!btn) return;

      nav.querySelectorAll(".nav__item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      renderView(btn.dataset.view);
    };
  }

  applyRoleUi();

  // default
  renderView("tasks");
}

function applyRoleUi() {
  const nav = $("mainNav");
  if (!nav) return;

  const invitesBtn = nav.querySelector('.nav__item[data-view="invites"]');
  if (invitesBtn) invitesBtn.style.display = isInviteAllowed() ? "" : "none";

  // Структура видна всем (чтобы видеть дерево), но кнопки редактирования будут по правам
  const structureBtn = nav.querySelector('.nav__item[data-view="structure"]');
  if (structureBtn) structureBtn.style.display = "";

  // Employees: только owner (пока)
  const employeesBtn = nav.querySelector('.nav__item[data-view="employees"]');
  if (employeesBtn) employeesBtn.style.display = CURRENT_USER?.role === "owner" ? "" : "none";
}

/* ================= VIEWS ================= */
function renderView(view) {
  const root = $("viewRoot");
  if (!root) return;

  if (view === "invites") return renderInvitesView(root);
  if (view === "structure") return renderStructureView(root);
  if (view === "employees") return renderEmployeesView(root);

  const titles = {
    tasks: "Задачи",
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
      <h2 style="margin-top:0;">${titles[view] || "Раздел"}</h2>
      <p class="muted">
        Раздел <b>${titles[view] || escapeHtml(view)}</b>.<br>
        Контент будет добавлен позже.
      </p>
    </div>
  `;
}

/* ================= EMPLOYEES VIEW ================= */
async function renderEmployeesView(root) {
  if (!CURRENT_USER || CURRENT_USER.role !== "owner") {
    root.innerHTML = `
      <div class="card">
        <h2 style="margin-top:0;">Сотрудники</h2>
        <p class="muted">Нет доступа.</p>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0;">Сотрудники</h2>
      <p class="muted" style="margin-top:4px;">
        Здесь ты управляешь правами: кто может приглашать новых сотрудников (can_invite).
      </p>

      <div style="display:flex; gap:10px; align-items:center; margin-top:12px;">
        <button class="btn" id="btnEmpRefresh">Обновить</button>
        <span class="muted" id="empStatus"></span>
      </div>

      <div style="overflow:auto; margin-top:12px;">
        <table class="table" style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left; padding:10px 8px;">ID</th>
              <th style="text-align:left; padding:10px 8px;">Имя</th>
              <th style="text-align:left; padding:10px 8px;">Email</th>
              <th style="text-align:left; padding:10px 8px;">Роль</th>
              <th style="text-align:left; padding:10px 8px;">Получили разрещение</th>
              <th style="text-align:left; padding:10px 8px;">Действие</th>
            </tr>
          </thead>
          <tbody id="empRows">
            <tr><td class="muted" style="padding:10px 8px;" colspan="6">Загрузка...</td></tr>
          </tbody>
        </table>
      </div>

      
    </div>
  `;

  const statusEl = $("empStatus");
  const rowsEl = $("empRows");

  async function loadUsers() {
    statusEl.textContent = "";
    rowsEl.innerHTML = `<tr><td class="muted" style="padding:10px 8px;" colspan="6">Загрузка...</td></tr>`;

    // пробуем несколько возможных эндпоинтов, чтобы ничего не ломать
    const data = await tryApi(
      ["/api/users", "/api/users-list", "/api/employees", "/api/structure/employees"],
      { method: "GET" }
    );

    // нормализуем разные форматы
    const users =
      data.users ||
      data.rows ||
      data.employees ||
      data.list ||
      (Array.isArray(data) ? data : []);

    if (!Array.isArray(users) || users.length === 0) {
      rowsEl.innerHTML = `<tr><td class="muted" style="padding:10px 8px;" colspan="6">Пока нет данных.</td></tr>`;
      return;
    }

    rowsEl.innerHTML = users
      .map((u) => {
        const id = u.id;
        const name = u.full_name || u.name || "";
        const email = u.email || "";
        const role = u.role || "";
        const can_invite = Number(u.can_invite || 0);

        const isSelf = CURRENT_USER?.id === id;
        const isOwner = String(role).toLowerCase() === "owner";

        // owner не меняем, себя тоже лучше не трогать
        const disabled = isOwner || isSelf ? "disabled" : "";

        const btnLabel = can_invite ? "Забрать право" : "Дать право";
        const nextVal = can_invite ? 0 : 1;

        return `
          <tr style="border-top:1px solid rgba(255,255,255,.08);">
            <td style="padding:10px 8px;">${escapeHtml(id)}</td>
            <td style="padding:10px 8px;">${escapeHtml(name)}</td>
            <td style="padding:10px 8px;">${escapeHtml(email)}</td>
            <td style="padding:10px 8px;">${escapeHtml(role)}</td>
            <td style="padding:10px 8px;">${can_invite ? "✅" : "—"}</td>
            <td style="padding:10px 8px;">
              <button class="btn" data-action="toggle-invite" data-id="${escapeHtml(id)}" data-val="${escapeHtml(
          nextVal
        )}" ${disabled}>${btnLabel}</button>
            </td>
          </tr>
        `;
      })
      .join("");

    // events
    rowsEl.querySelectorAll('button[data-action="toggle-invite"]').forEach((btn) => {
      btn.onclick = async () => {
        const id = Number(btn.dataset.id);
        const val = Number(btn.dataset.val);

        statusEl.textContent = "";
        try {
          // пробуем разные возможные пути обновления прав
          await tryApi(
            ["/api/users/can-invite", "/api/users/set-can-invite", "/api/users/permissions", "/api/employees/permissions"],
            {
              method: "POST",
              body: JSON.stringify({ user_id: id, can_invite: val }),
            }
          );

          statusEl.textContent = "✅ Сохранено";
          await loadUsers();
        } catch (e) {
          statusEl.textContent = "❌ " + e.message;
        }
      };
    });
  }

  $("btnEmpRefresh").onclick = loadUsers;

  await loadUsers();
}

/* ================= INVITES VIEW ================= */
async function renderInvitesView(root) {
  if (!isInviteAllowed()) {
    root.innerHTML = `
      <div class="card">
        <h2 style="margin-top:0;">Приглашения</h2>
        <p class="muted">Нет доступа.</p>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0;">Приглашения</h2>
      <p class="muted">Создай приглашение для сотрудника. Ссылка одноразовая.</p>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; max-width:720px;">
        <div>
          <label class="muted">Email (необязательно)</label>
          <input id="invEmail" type="email" placeholder="worker@garden.md" />
        </div>

        <div>
          <label class="muted">Роль</label>
          <select id="invRole">
            <option value="worker">worker</option>
            <option value="manager">manager</option>
          </select>
        </div>

        <div>
          <label class="muted">Срок действия (часов)</label>
          <input id="invTtl" type="number" min="1" value="72" />
        </div>

        <div style="display:flex; align-items:flex-end; gap:10px;">
          <button id="btnMakeInvite" class="btn primary" style="min-width:180px;">Создать приглашение</button>
          <span id="invStatus" class="muted"></span>
        </div>
      </div>

      <div id="invResult" class="hidden" style="margin-top:14px;">
        <label class="muted">Ссылка приглашения (скопируй и отправь)</label>
        <div style="display:flex; gap:10px; align-items:center;">
          <input id="invLink" type="text" readonly />
          <button id="btnCopyInvite" class="btn">Копировать</button>
        </div>
        <p class="muted" style="margin-top:8px;">После использования ссылка станет недействительной.</p>
      </div>
    </div>
  `;

  const statusEl = $("invStatus");
  const resultEl = $("invResult");
  const linkEl = $("invLink");

  $("btnMakeInvite").onclick = async () => {
    statusEl.textContent = "";
    resultEl.classList.add("hidden");

    const email = $("invEmail").value.trim();
    const role = $("invRole").value;
    const ttl_hours = Number($("invTtl").value || 72);

    try {
      const data = await api("/api/invites", {
        method: "POST",
        body: JSON.stringify({
          email: email || null,
          role,
          ttl_hours: Number.isFinite(ttl_hours) ? ttl_hours : 72,
        }),
      });

      const fullLink = `${location.origin}${data.inviteLink || ""}`;
      linkEl.value = fullLink;
      resultEl.classList.remove("hidden");
      statusEl.textContent = "✅ Готово";
    } catch (e) {
      statusEl.textContent = "❌ " + e.message;
    }
  };

  $("btnCopyInvite").onclick = async () => {
    try {
      await navigator.clipboard.writeText(linkEl.value);
      statusEl.textContent = "✅ Скопировано";
    } catch {
      linkEl.select();
      document.execCommand("copy");
      statusEl.textContent = "✅ Скопировано";
    }
  };
}

/* ================= STRUCTURE VIEW (Tree like Bitrix) ================= */
function injectStructureCssOnce() {
  const css = `
  /* ===== FULL WIDTH STRUCTURE (no right panel) ===== */
.gi-structure-full{
  width:100%;
  min-height: calc(100vh - 120px);
}

.gi-structure-canvas--full{
  width:100%;
  height: calc(100vh - 120px);
  overflow: hidden; /* важно: теперь камера управляет обзором, а не скролл */
}

/* =========================
   STRUCTURE — STABLE FIX
   (tree like Bitrix + modal)
   ========================= */

.gi-structure-wrap{
  display:flex;
  gap:16px;
  width:100%;
  min-height: calc(100vh - 120px);
  align-items:stretch;
}

.gi-structure-canvas{
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding:20px;
  border-radius:16px;
  background: rgba(255,255,255,0.04);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
  overflow:auto;
  scrollbar-color: rgba(255,255,255,.25) transparent;
  scrollbar-width: thin;
}

.gi-structure-side{
  flex: 0 0 360px;
  width:360px;
  min-width:360px;
  min-height: 0;
  display:flex;
  flex-direction:column;
  gap:14px;
}

/* ============ ORG TREE (flex, no overlap) ============ */

.gi-org{
  display:flex;
  justify-content:flex-start;
  width:100%;
  padding: 10px 30px 30px 30px;
}

/* корневой ul растёт по контенту — появится горизонтальный скролл */
.gi-org > ul{
  width: max-content;
  max-width: none;
}

/* ВАЖНО:
   UL = flex-row, без wrap, чтобы элементы не “падали” в столбик
*/
.gi-org ul{
  margin:0;
  padding: 46px 0 0 0;            /* было 26px — увеличили вертикальный шаг уровня */
  position:relative;

  display:flex;
  flex-direction:row;
  flex-wrap:nowrap;
  justify-content:center;
  align-items:flex-start;

  white-space:nowrap;
}

/* LI не сжимается — поэтому нет налезания */
.gi-org li{
  list-style:none;
  position:relative;
  flex: 0 0 auto;

  padding: 78px 48px 0 48px;      /* было 58px 28px — больше расстояние между соседями и уровнями */
  text-align:center;
}

/* линии */
.gi-org li::before,
.gi-org li::after{
  content:'';
  position:absolute;
  top:0;
  right:50%;
  width:50%;
  height:30px;
  border-top:1px solid rgba(255,255,255,0.16);
}

.gi-org li::after{
  right:auto;
  left:50%;
  border-left:1px solid rgba(255,255,255,0.16);
}

.gi-org li:only-child::before,
.gi-org li:only-child::after{ display:none; }

.gi-org li:only-child{ padding-top:0; }

.gi-org li:first-child::before{ border:0 none; }
.gi-org li:last-child::after{ border:0 none; }

.gi-org li:last-child::before{
  border-right:1px solid rgba(255,255,255,0.16);
  border-radius:0 6px 0 0;
}

.gi-org li:first-child::after{
  border-radius:6px 0 0 0;
}

.gi-org ul ul::before{
  content:'';
  position:absolute;
  top:0;
  left:50%;
  width:0;
  height:30px;
  border-left:1px solid rgba(255,255,255,0.16);
}

/* ============ NODE ============ */

.gi-node{
  display:inline-block;
  width:300px;                    /* было 260px — чтобы карточки были одинаковые и не “съезжали” */
  max-width:300px;

  padding:12px;
  border-radius:14px;
  background: rgba(17,20,26,0.78);
  border:1px solid rgba(255,255,255,0.08);
  box-shadow:0 10px 30px rgba(0,0,0,.25);

  text-align:left;
  cursor:pointer;
}

.gi-node__title{ font-weight:700; }
.gi-node__meta{
  margin-top:6px;
  font-size:12px;
  opacity:.75;
}

.gi-node__tools{
  margin-top:10px;
  display:flex;
  gap:8px;
  position:relative; /* для выпадающего меню */
}

/* кнопки */
.gi-plus,
.gi-more{
  width:30px;
  height:30px;
  border-radius:10px;
  border:1px solid rgba(255,255,255,0.14);
  background:rgba(255,255,255,0.06);
  display:inline-flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
}
.gi-plus:hover,
.gi-more:hover{ background:rgba(255,255,255,0.12); }

/* меню ⋯ */
.gi-menu{
  position:absolute;
  top:38px;
  right:0;
  min-width:260px;
  background:rgba(15,20,26,.98);
  border:1px solid rgba(255,255,255,.1);
  border-radius:14px;
  padding:8px;
  z-index:2000;
}
.gi-menu__item{
  width:100%;
  padding:10px 12px;
  border-radius:10px;
  background:transparent;
  border:0;
  color:#fff;
  text-align:left;
  cursor:pointer;
  font-size:13px;
}
.gi-menu__item:hover{ background:rgba(255,255,255,.08); }
.gi-menu__item.danger{ color:#ff6b6b; }
.gi-menu__sep{
  height:1px;
  background:rgba(255,255,255,.1);
  margin:6px 0;
}

/* ============ MODAL (ВОЗВРАЩАЕМ КАК БЫЛО) ============ */
.gi-modal-backdrop{
  position:fixed;
  inset:0;
  background:rgba(0,0,0,.55);
  display:flex;
  align-items:center;
  justify-content:center;
  z-index:9999;
  padding: 24px;
}

.gi-modal{
  width:min(860px, 92vw);
  max-height: calc(100vh - 80px);
  overflow:auto;
  border-radius:16px;
  background:#0f141a;
  border:1px solid rgba(255,255,255,.10);
  box-shadow:0 30px 80px rgba(0,0,0,.45);
}

.gi-modal__head{
  padding:14px 16px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  background:rgba(255,255,255,.03);
  border-bottom:1px solid rgba(255,255,255,.08);
  position: sticky;
  top: 0;
  z-index: 2;
}

.gi-modal__tabs{
  padding:10px 16px;
  display:flex;
  gap:10px;
  border-bottom:1px solid rgba(255,255,255,.08);
}

.gi-tab{
  padding:8px 12px;
  border-radius:10px;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.04);
  cursor:pointer;
  font-size:13px;
}
.gi-tab.active{
  background:rgba(72, 142, 255, .20);
  border-color:rgba(72,142,255,.35);
}

.gi-modal__body{ padding:14px 16px; }
.gi-modal__foot{
  padding:14px 16px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  border-top:1px solid rgba(255,255,255,.08);
}

/* адаптив */
@media (max-width: 1100px){
  .gi-structure-wrap{ flex-direction:column; }
  .gi-structure-side{
    width:100%;
    min-width:0;
    flex: 1 1 auto;
  }
  .gi-org{ padding-left: 16px; padding-right: 16px; }
}
  .gi-expander{
  width:28px;
  height:28px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-size:16px;
  line-height:1;
}
  /* + на линии между родителем и детьми */
.gi-join{
  position: relative;
  height: 34px;
  display:flex;
  align-items:center;
  justify-content:center;
  margin-top: 10px;
}

.gi-join::before{
  content:"";
  position:absolute;
  top:0;
  left:50%;
  transform: translateX(-50%);
  width:1px;
  height: 34px;
  background: rgba(255,255,255,0.10);
}

/* кнопка + как в Bitrix (на линии) */
.gi-addline{
  width:28px;
  height:28px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,0.12);
  background: rgba(18,20,26,0.85);
  box-shadow: 0 8px 22px rgba(0,0,0,.25);
  color:#fff;
  cursor:pointer;
}

/* подсветка выбранной карточки */
li.is-selected > .gi-node{
  outline: 2px solid rgba(80,140,255,0.65);
  box-shadow: 0 0 0 6px rgba(80,140,255,0.12);
}

/* подсветка линии/ребер на пути (делаем “синим”) */
li.path-on > ul::before,
li.path-on > ul li::before,
li.path-on > ul li::after{
  border-color: rgba(80,140,255,0.75) !important;
}
li.path-on > .gi-join::before{
  background: rgba(80,140,255,0.75) !important;
}


`;

  let style = document.getElementById("gi-structure-css");
  if (!style) {
    style = document.createElement("style");
    style.id = "gi-structure-css";
    document.head.appendChild(style);
  }
  style.textContent = css;
}


async function renderStructureView(root) {
  injectStructureCssOnce();

    root.innerHTML = `
    <div class="gi-structure-full">
      <div class="gi-structure-canvas gi-structure-canvas--full">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px;">
          <div>
            <h2 style="margin:0;">Структура компании</h2>
            <div class="muted" style="margin-top:4px;">Дерево отделов как в Bitrix (вверх-вниз).</div>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <button id="btnStructRefresh" class="btn">Обновить</button>
            <button id="btnStructAddRoot" class="btn primary" ${canManageStructure() ? "" : "disabled"}>+ Корневой отдел</button>
          </div>
        </div>

        <div class="gi-org" id="orgRoot">
          <p class="muted">Загрузка...</p>
        </div>
      </div>
    </div>
  `;



  const orgRoot = $("orgRoot");
  const depInfo = $("depInfo");
  // ✅ Правая панель структуры (как в Bitrix)
const panelDeptName = $("panelDeptName");
const panelParent = $("panelParent");
const panelChildCount = $("panelChildCount");
const panelEmployees = $("panelEmployees");
const panelMsg = $("panelMsg");

function updateStructurePanelById(depId) {
  const dep = departments.find((d) => d.id === Number(depId));
  if (!dep) return;

  if (panelDeptName) panelDeptName.textContent = dep.name || "";
  if (panelParent) {
    const parent = dep.parent_id ? departments.find((d) => d.id === dep.parent_id) : null;
    panelParent.textContent = parent ? `Родитель: ${parent.name}` : "Родитель: —";
  }
  if (panelChildCount) {
    const count = departments.filter((d) => d.parent_id === dep.id).length;
    panelChildCount.textContent = String(count);
  }
  if (panelEmployees) {
    panelEmployees.textContent = dep.manager_name ? `Руководитель: ${dep.manager_name}` : "Руководитель: —";
  }
  if (panelMsg) panelMsg.textContent = "";
}

   // ====== PAN + ZOOM like Bitrix ======
  let cam = {
    x: 0,
    y: 0,
    scale: 1
  };

  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let camStart = { x: 0, y: 0 };

  const canvasEl = root.querySelector(".gi-structure-canvas");

function applyTransform() {
  orgRoot.style.transformOrigin = "0 0";   // ✅ важное
  orgRoot.style.transform =
    `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`;
}


  applyTransform();

  // --- PAN (drag мышью) ---
  canvasEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;                 // только ЛКМ
    if (e.target.closest(".gi-node")) return;  // не тянем при клике по карточке

    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    camStart = { x: cam.x, y: cam.y };
    canvasEl.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    cam.x = camStart.x + (e.clientX - panStart.x);
    cam.y = camStart.y + (e.clientY - panStart.y);
    applyTransform();
  });

  window.addEventListener("mouseup", () => {
    isPanning = false;
    canvasEl.style.cursor = "default";
  });

  // --- ZOOM (колёсико мыши, как в Bitrix) ---
  canvasEl.addEventListener("wheel", (e) => {
    e.preventDefault();

    const rect = canvasEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const oldScale = cam.scale;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    cam.scale = Math.max(0.35, Math.min(2.2, cam.scale + delta));

    // zoom в точку курсора
    cam.x = mx - (mx - cam.x) * (cam.scale / oldScale);
    cam.y = my - (my - cam.y) * (cam.scale / oldScale);

    applyTransform();
  }, { passive: false });

  let departments = [];
  let selectedDepId = null;
let pathIds = new Set();

function computePathSet(id) {
  const parentById = new Map(departments.map(d => [d.id, d.parent_id]));
  const set = new Set();
  let cur = id;
  while (cur != null) {
    set.add(cur);
    cur = parentById.get(cur);
  }
  return set;
}

  let employees = [];
  let expanded = new Set();   // какие отделы раскрыты
let lastTree = [];          // последний tree, чтобы перерисовывать
let selectedId = null;



  $("btnStructRefresh").onclick = async () => {
    await loadAndRender();
  };

  $("btnStructAddRoot").onclick = async () => {
    if (!canManageStructure()) return;
    await openCreateDepartmentModal({ parent_id: null, parent_name: null });
    await loadAndRender();
  };

  async function loadAndRender() {
    orgRoot.innerHTML = `<p class="muted">Загрузка...</p>`;
    if (depInfo) depInfo.innerHTML = `Нажми на отдел в дереве.`;

    const depData = await api("/api/structure/departments");
    departments = depData.departments || [];

    const empData = await api("/api/structure/employees");
    employees = empData.employees || [];

    const tree = buildTree(departments);
expanded = new Set(departments.map(d => d.id)); // ✅ раскрыть всё дерево
selectedId = tree[0]?.id || null;              // корень (если есть)


    // если нет корня — предложим создать
    if (!tree.length) {
      orgRoot.innerHTML = `
        <div class="card" style="max-width:560px;">
          <h3 style="margin-top:0;">Пока нет отделов</h3>
          <p class="muted">Нажми “+ Корневой отдел” чтобы начать.</p>
        </div>
      `;
      return;
    }

    // Bitrix-like: один “корень” сверху (если несколько — покажем как несколько корней)
    orgRoot.innerHTML = renderTreeHtml(tree);
    wireTreeEvents();
  }

  function buildTree(rows) {
    const map = new Map();
    rows.forEach((d) => map.set(d.id, { ...d, children: [] }));

    const roots = [];
    rows.forEach((d) => {
      const node = map.get(d.id);
      const pid = d.parent_id;
      if (pid && map.get(pid)) map.get(pid).children.push(node);
      else roots.push(node);
    });

    // сортировка детей по имени
    const sortRec = (arr) => {
      arr.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      arr.forEach((n) => sortRec(n.children));
    };
    sortRec(roots);

    return roots;
  }

function renderTreeHtml(tree) {
  lastTree = tree;

  const byId = new Map(departments.map(d => [d.id, d]));
  const parentOf = (id) => {
    const d = byId.get(id);
    return d ? d.parent_id : null;
  };

  // набор id на пути от выбранного до корня
  const pathSet = new Set();
  if (selectedId != null) {
    let cur = selectedId;
    while (cur != null) {
      pathSet.add(cur);
      cur = parentOf(cur);
    }
  }

  function renderNode(dep) {
    const hasKids = dep.children && dep.children.length > 0;
    const isOpen = hasKids && expanded.has(dep.id);
    const canAddChild = canManageStructure();

    const isSelected = selectedId === dep.id;
    const onPath = pathSet.has(dep.id); // узел на пути

    return `
      <li data-dep-id="${dep.id}" class="${onPath ? "path-on" : ""} ${isSelected ? "is-selected" : ""}">
        <div class="gi-node ${selectedDepId === dep.id ? "is-selected" : ""}" data-action="select">
          <div class="gi-node__head" style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
            <div style="min-width:0;">
              <div style="font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${escapeHtml(dep.name)}
              </div>
              <div class="muted" style="font-size:12px; margin-top:4px;">
                Подчинённых: ${hasKids ? dep.children.length : 0}
              </div>
            </div>

            <div style="display:flex; gap:8px; align-items:center;">
             
              <button class="gi-more iconbtn" title="Действия" data-action="more">⋯</button>
            </div>
          </div>

          <div class="gi-menu" hidden>
            <button class="gi-menu__item" data-menu="edit">Редактировать отдел</button>
            <button class="gi-menu__item" data-menu="add-child" ${canAddChild ? "" : "disabled"}>Добавить отдел в подчинение</button>
          </div>
        </div>

        ${hasKids ? `
          <div class="gi-join">
            <button class="gi-addline" data-action="add-child" title="Добавить под-отдел" ${canAddChild ? "" : "disabled"}>+</button>
          </div>
        ` : ``}

        ${hasKids ? `<ul>${dep.children.map(renderNode).join("")}</ul>` : ``}
      </li>
    `;
  }

  return `<ul>${tree.map(renderNode).join("")}</ul>`;
}


  function wireTreeEvents() {
      // раскрыть/свернуть ветку
  orgRoot.querySelectorAll('button[data-action="toggle"]').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const li = e.target.closest("li[data-dep-id]");
      if (!li) return;
      const id = Number(li.dataset.depId);
           orgRoot.innerHTML = renderTreeHtml(lastTree);
      wireTreeEvents();
    };
  });
    // выбор отдела (подсветка пути)
  orgRoot.querySelectorAll(".gi-node[data-action='select']").forEach((node) => {
   node.onclick = (e) => {
  // клики по кнопкам внутри карточки не считаем выбором
  if (e.target.closest("button")) return;

  const li = node.closest("li[data-dep-id]");
  if (!li) return;

  const id = Number(li.dataset.depId);

  selectedDepId = id;                 // ✅ новый id
  pathIds = computePathSet(id);       // ✅ считаем путь

  orgRoot.innerHTML = renderTreeHtml(lastTree);
  wireTreeEvents();
updateStructurePanelById(selectedDepId);
};
  });
  
  // меню ⋯ открыть/закрыть
  orgRoot.querySelectorAll('button[data-action="more"]').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const node = btn.closest(".gi-node");
      const menu = node?.querySelector(".gi-menu");
      if (!menu) return;

      // закрыть остальные
      orgRoot.querySelectorAll(".gi-menu").forEach((m) => {
        if (m !== menu) m.hidden = true;
      });

      menu.hidden = !menu.hidden;
    };
  });

  // пункты меню
  orgRoot.querySelectorAll(".gi-menu__item").forEach((item) => {
    item.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const li = e.target.closest("li[data-dep-id]");
      if (!li) return;
      const id = Number(li.dataset.depId);
      const dep = departments.find((d) => d.id === id);
      if (!dep) return;

      const action = item.dataset.menu;

      if (action === "add-child") {
        await openCreateDepartmentModal({ parent_id: dep.id, parent_name: dep.name });
        await loadAndRender();
        return;
      }

      if (action === "edit") {
        // пока просто покажем сообщение (чтобы не ломать)
        alert("Редактирование сделаем следующим шагом (форма + сохранение).");
        return;
      }
    };
  });

  // закрывать меню кликом в пустоту
  document.addEventListener("click", () => {
    orgRoot.querySelectorAll(".gi-menu").forEach((m) => (m.hidden = true));
  }, { once: true });

    ;

    orgRoot.querySelectorAll("li[data-dep-id] .gi-node").forEach((nodeEl) => {
      nodeEl.addEventListener("click", (e) => {
        const li = e.target.closest("li[data-dep-id]");
        if (!li) return;
        const id = Number(li.dataset.depId);
        const dep = departments.find((d) => d.id === id);
        if (!dep) return;

        const manager = (dep.manager_name || dep.manager_email || "").trim();
        if (depInfo) {
        depInfo.innerHTML = `
    <div><b>${escapeHtml(dep.name)}</b></div>
    <div class="muted" style="margin-top:6px;">
      ${dep.description ? escapeHtml(dep.description) + "<br/>" : ""}
      ${manager ? "Руководитель: " + escapeHtml(manager) + "<br/>" : ""}
      ID: ${dep.id} | parent_id: ${dep.parent_id ?? "—"}
    </div>
  `;}
      });
    });
  

    orgRoot.querySelectorAll('button[data-action="add-child"]').forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const li = e.target.closest("li[data-dep-id]");
        if (!li) return;
        const parent_id = Number(li.dataset.depId);
        const parent = departments.find((d) => d.id === parent_id);
        if (!parent) return;

        await openCreateDepartmentModal({ parent_id, parent_name: parent.name });
        await loadAndRender();
      });
    });
  }

  async function openCreateDepartmentModal({ parent_id, parent_name }) {
    // step tabs like Bitrix: Название / Коммуникации
    const backdrop = document.createElement("div");
    backdrop.className = "gi-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "gi-modal";

    const close = () => backdrop.remove();

    const employeesOptions = employees
      .map(
        (u) =>
          `<option value="${u.id}">${escapeHtml(u.full_name || u.email)} (${escapeHtml(
            u.email
          )})</option>`
      )
      .join("");

    modal.innerHTML = `
      <div class="gi-modal__head">
        <div style="font-weight:800;">Создание отдела</div>
        <button class="btn" id="btnModalClose">Закрыть</button>
      </div>

      <div class="gi-modal__tabs">
        <button class="gi-tab active" data-tab="name">Название</button>
        <button class="gi-tab" data-tab="comm">Коммуникации</button>
      </div>

      <div class="gi-modal__body">
        <div data-pane="name">
          <div class="muted" style="margin-bottom:10px;">
            Вышестоящий отдел: <b>${parent_name ? escapeHtml(parent_name) : "— (корень)"}</b>
          </div>

          <label class="muted">Название</label>
          <input id="depNewName" placeholder="Напр. Снабжение" />

          <label class="muted" style="margin-top:10px;">Описание</label>
          <textarea id="depNewDesc" rows="4" placeholder="Коротко: чем занимается отдел"></textarea>

          <label class="muted" style="margin-top:10px;">Руководитель (необязательно)</label>
          <select id="depNewManager">
            <option value="">— не выбран —</option>
            ${employeesOptions}
          </select>
        </div>

        <div data-pane="comm" style="display:none;">
          <div class="card" style="background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08);">
            <h3 style="margin-top:0;">Коммуникации (заготовка как в Bitrix)</h3>
            <p class="muted" style="margin:0;">
              На следующем этапе подключим:<br/>
              • Коллабы / Каналы / Чаты<br/>
              • Авто-добавление сотрудников отдела в коммуникации<br/>
              Сейчас сохраняем только отдел и руководителя.
            </p>
          </div>
        </div>
      </div>

      <div class="gi-modal__foot">
        <span id="depModalStatus" class="muted"></span>
        <div style="display:flex; gap:10px;">
          <button class="btn" id="btnModalCancel">Назад</button>
          <button class="btn primary" id="btnModalCreate">Создать отдел</button>
        </div>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    modal.querySelector("#btnModalClose").onclick = close;
    modal.querySelector("#btnModalCancel").onclick = close;

    // tabs
    modal.querySelectorAll(".gi-tab").forEach((t) => {
      t.onclick = () => {
        modal.querySelectorAll(".gi-tab").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        const tab = t.dataset.tab;
        modal.querySelector('[data-pane="name"]').style.display = tab === "name" ? "" : "none";
        modal.querySelector('[data-pane="comm"]').style.display = tab === "comm" ? "" : "none";
      };
    });

    modal.querySelector("#btnModalCreate").onclick = async () => {
      const status = modal.querySelector("#depModalStatus");
      status.textContent = "";

      const name = modal.querySelector("#depNewName").value.trim();
      const description = modal.querySelector("#depNewDesc").value.trim();
      const manager_user_id = modal.querySelector("#depNewManager").value || null;

      if (!name) {
        status.textContent = "❌ Введите название отдела";
        return;
      }

      try {
        await api("/api/structure/departments", {
          method: "POST",
          body: JSON.stringify({
            name,
            description: description || null,
            parent_id: parent_id || null,
            manager_user_id: manager_user_id ? Number(manager_user_id) : null,
          }),
        });

        status.textContent = "✅ Создано";
        setTimeout(close, 250);
      } catch (e) {
  const map = {
    forbidden: "У вас нет прав доступа.",
    forbidden_parent_required: "У вас нет прав создавать корневой отдел.",
    forbidden_change_parent: "Нельзя менять вышестоящий отдел (parent).",
    unauthorized: "Сессия истекла. Войдите заново.",
    name_required: "Введите название отдела.",
    bad_id: "Неверный ID.",
    not_found: "Отдел не найден.",
  };

  status.textContent = "❌ " + (map[e.message] || "Ошибка: " + e.message);
}

    };

    // click outside closes
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
  }

  await loadAndRender();
}

/* ================= EVENTS ================= */
document.addEventListener("DOMContentLoaded", () => {
  $("btnLogin")?.addEventListener("click", doLogin);

  // регистрация скрыта в html — оставим заглушку на всякий случай
  $("btnRegister")?.addEventListener("click", () => {
    if (loginMsg) loginMsg.textContent = "Регистрация доступна только по приглашению";
  });

  checkSession();
});
