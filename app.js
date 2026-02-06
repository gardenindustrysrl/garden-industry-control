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
  if (document.getElementById("structureCss")) return;

  const css = `
  /* ==== Org chart (simple Bitrix-like tree) ==== */
  .gi-structure-wrap { display:flex; gap:14px; align-items:flex-start; }
  .gi-structure-canvas { flex:1; min-height:520px; padding:14px; border-radius:14px; background: rgba(255,255,255,0.04); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06); overflow:auto; }
  .gi-structure-side { width:320px; min-width:280px; }
  .gi-org { display:flex; justify-content:center; }
  .gi-org ul { padding-top:20px; position:relative; transition: all .2s; display:flex; justify-content:center; }
  .gi-org li { list-style-type:none; position:relative; padding:20px 10px 0 10px; text-align:center; }
  .gi-org li::before, .gi-org li::after { content:''; position:absolute; top:0; right:50%; border-top:1px solid rgba(255,255,255,0.16); width:50%; height:20px; }
  .gi-org li::after { right:auto; left:50%; border-left:1px solid rgba(255,255,255,0.16); }
  .gi-org li:only-child::after, .gi-org li:only-child::before { display:none; }
  .gi-org li:only-child { padding-top:0; }
  .gi-org li:first-child::before, .gi-org li:last-child::after { border:0 none; }
  .gi-org li:last-child::before { border-right:1px solid rgba(255,255,255,0.16); border-radius:0 6px 0 0; }
  .gi-org li:first-child::after { border-radius:6px 0 0 0; }
  .gi-org ul ul::before { content:''; position:absolute; top:0; left:50%; border-left:1px solid rgba(255,255,255,0.16); width:0; height:20px; }

  .gi-node {
    display:inline-block;
    min-width:220px;
    max-width:260px;
    padding:12px 12px 10px;
    border-radius:12px;
    background: rgba(17,20,26,0.72);
    box-shadow: 0 10px 30px rgba(0,0,0,0.25);
    border: 1px solid rgba(255,255,255,0.08);
    cursor:pointer;
    text-align:left;
  }
  .gi-node__title { font-weight:700; }
  .gi-node__meta { margin-top:6px; font-size:12px; opacity:.75; }
  .gi-node__tools { margin-top:10px; display:flex; gap:8px; }
  .gi-plus {
    width:30px; height:30px; border-radius:10px;
    border:1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.06);
    display:inline-flex; align-items:center; justify-content:center;
    cursor:pointer;
  }
  .gi-plus:hover { background: rgba(255,255,255,0.10); }
  .gi-modal-backdrop{position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; z-index:9999;}
  .gi-modal{width:min(860px, 92vw); border-radius:16px; background:#0f141a; border:1px solid rgba(255,255,255,.10); box-shadow:0 30px 80px rgba(0,0,0,.45); overflow:hidden;}
  .gi-modal__head{padding:14px 16px; display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,.03); border-bottom:1px solid rgba(255,255,255,.08);}
  .gi-modal__tabs{padding:10px 16px; display:flex; gap:10px; border-bottom:1px solid rgba(255,255,255,.08);}
  .gi-tab{padding:8px 12px; border-radius:10px; border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.04); cursor:pointer; font-size:13px;}
  .gi-tab.active{background:rgba(72, 142, 255, .20); border-color:rgba(72,142,255,.35);}
  .gi-modal__body{padding:14px 16px;}
  .gi-modal__foot{padding:14px 16px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,.08);}
  `;

  const style = document.createElement("style");
  style.id = "structureCss";
  style.textContent = css;
  document.head.appendChild(style);
}

async function renderStructureView(root) {
  injectStructureCssOnce();

  root.innerHTML = `
    <div class="gi-structure-wrap">
      <div class="gi-structure-canvas">
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

      <div class="gi-structure-side">
        <div class="card">
          <h3 style="margin-top:0;">Права</h3>
          <p class="muted" style="margin:0;">
            <b>Owner</b> — полный доступ.<br/>
            <b>can_manage_structure</b> — доступ как у директора.<br/>
            <b>Руководитель отдела</b> — может создавать под-отделы в своём отделе.
          </p>
        </div>

        <div class="card" style="margin-top:12px;">
          <h3 style="margin-top:0;">Выбранный отдел</h3>
          <div id="depInfo" class="muted">Нажми на отдел в дереве.</div>
        </div>
      </div>
    </div>
  `;

  const orgRoot = $("orgRoot");
  const depInfo = $("depInfo");

  let departments = [];
  let employees = [];

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
    depInfo.innerHTML = `Нажми на отдел в дереве.`;

    const depData = await api("/api/structure/departments");
    departments = depData.departments || [];

    const empData = await api("/api/structure/employees");
    employees = empData.employees || [];

    const tree = buildTree(departments);

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

  function renderTreeHtml(nodes) {
    const toLi = (n) => {
      const manager = (n.manager_name || n.manager_email || "").trim();
      const canAddChild =
        canManageStructure() || (CURRENT_USER?.id && n.manager_user_id === CURRENT_USER.id);

      return `
        <li data-dep-id="${n.id}">
          <div class="gi-node">
            <div class="gi-node__title">${escapeHtml(n.name)}</div>
            <div class="gi-node__meta">
              ${manager ? `Руководитель: <b>${escapeHtml(manager)}</b><br/>` : ""}
              Подотделов: ${n.children.length}
            </div>
            <div class="gi-node__tools">
              <button class="gi-plus" title="Добавить под-отдел" data-action="add-child" ${
                canAddChild ? "" : "disabled"
              }>+</button>
            </div>
          </div>
          ${n.children.length ? `<ul>${n.children.map(toLi).join("")}</ul>` : ""}
        </li>
      `;
    };

    return `<ul>${nodes.map(toLi).join("")}</ul>`;
  }

  function wireTreeEvents() {
    orgRoot.querySelectorAll("li[data-dep-id] .gi-node").forEach((nodeEl) => {
      nodeEl.addEventListener("click", (e) => {
        const li = e.target.closest("li[data-dep-id]");
        if (!li) return;
        const id = Number(li.dataset.depId);
        const dep = departments.find((d) => d.id === id);
        if (!dep) return;

        const manager = (dep.manager_name || dep.manager_email || "").trim();
        depInfo.innerHTML = `
          <div><b>${escapeHtml(dep.name)}</b></div>
          <div class="muted" style="margin-top:6px;">
            ${dep.description ? escapeHtml(dep.description) + "<br/>" : ""}
            ${manager ? "Руководитель: " + escapeHtml(manager) + "<br/>" : ""}
            ID: ${dep.id} | parent_id: ${dep.parent_id ?? "—"}
          </div>
        `;
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
        status.textContent = "❌ " + e.message;
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
