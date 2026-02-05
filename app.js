/* =====================================
   Garden Industry Control — app.js
   STABLE + INVITES + EMPLOYEES (owner)
   + Profile popup (name + email)
   + After login always refresh /api/auth/me (fix can_invite menu)
===================================== */

const $ = (id) => document.getElementById(id);

const loginCard = $("loginCard");
const appCard   = $("appCard");
const loginMsg  = $("loginMsg");

let CURRENT_USER = null;

/* ================= API ================= */
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/* ================= UI ================= */
function showLogin(message = "") {
  loginCard.classList.remove("hidden");
  appCard.classList.add("hidden");
  loginMsg.textContent = message;
}

function showApp(user) {
  CURRENT_USER = user;

  // ✅ обновим подпись профиля в topbar
  const avatarName = $("avatarName");
  if (avatarName && CURRENT_USER) {
    avatarName.textContent = (CURRENT_USER.full_name || CURRENT_USER.email || "Профиль");
  }

  loginCard.classList.add("hidden");
  appCard.classList.remove("hidden");
  loginMsg.textContent = "";
  initShell();
}

function isInviteAllowed() {
  return !!CURRENT_USER && (CURRENT_USER.role === "owner" || !!CURRENT_USER.can_invite);
}

function isOwner() {
  return !!CURRENT_USER && CURRENT_USER.role === "owner";
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
  loginMsg.textContent = "";

  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    loginMsg.textContent = "Введите email и пароль";
    return;
  }

  try {
    // 1) логинимся (ставит cookie)
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    // 2) ✅ берём актуальные поля role/can_invite/full_name
    const meData = await api("/api/auth/me");
    showApp(meData.user || meData);
  } catch (e) {
    loginMsg.textContent = "❌ " + e.message;
  }
}

async function doLogout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {}
  CURRENT_USER = null;
  showLogin("Вы вышли из системы");
}

/* ================= SESSION ================= */
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
  // ☰ sidebar collapse
  const btnSidebar = $("btnSidebar");
  if (btnSidebar) {
    btnSidebar.onclick = () => {
      document.body.classList.toggle("sidebar-collapsed");
    };
  }

  // logout
  const btnLogout = $("btnLogout");
  if (btnLogout) btnLogout.onclick = doLogout;

  // ✅ profile: show name + email
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

      nav.querySelectorAll(".nav__item").forEach(b =>
        b.classList.remove("active")
      );
      btn.classList.add("active");

      renderView(btn.dataset.view);
    };
  }

  // ✅ Подсветим/скроем пункты по ролям (не ломая верстку)
  applyRoleUi();

  // default view
  renderView("tasks");
}

function applyRoleUi() {
  const nav = $("mainNav");
  if (!nav) return;

  // скрыть "Сотрудники" для не-owner
  const employeesBtn = nav.querySelector('.nav__item[data-view="employees"]');
  if (employeesBtn) {
    employeesBtn.style.display = isOwner() ? "" : "none";
  }

  // скрыть "Приглашения" если нет права
  const invitesBtn = nav.querySelector('.nav__item[data-view="invites"]');
  if (invitesBtn) {
    invitesBtn.style.display = isInviteAllowed() ? "" : "none";
  }
}

/* ================= VIEWS ================= */
function renderView(view) {
  const root = $("viewRoot");
  if (!root) return;

  // спец-экраны
  if (view === "employees") return renderEmployeesView(root);
  if (view === "invites") return renderInvitesView(root);

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
    invites: "Приглашения",
    structure: "Структура",
  };

  root.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0;">${titles[view] || "Раздел"}</h2>
      <p class="muted">
        Раздел <b>${titles[view] || view}</b>.<br>
        Контент будет добавлен позже.
      </p>
    </div>
  `;
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
        <p class="muted" style="margin-top:8px;">
          После использования ссылка станет недействительной.
        </p>
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <h3 style="margin:0;">Последние приглашения</h3>
        <button id="btnRefreshInvites" class="btn">Обновить</button>
      </div>
      <div id="invTableWrap" style="margin-top:10px;">
        <p class="muted">Загрузка...</p>
      </div>
      <p class="muted" style="margin-top:10px;">
        Список видит только <b>owner</b>.
      </p>
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
          ttl_hours: Number.isFinite(ttl_hours) ? ttl_hours : 72
        })
      });

      const fullLink = `${location.origin}${data.inviteLink || ""}`;
      linkEl.value = fullLink;
      resultEl.classList.remove("hidden");
      statusEl.textContent = "✅ Готово";

      if (isOwner()) await loadInvitesTable();
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

  $("btnRefreshInvites").onclick = async () => {
    await loadInvitesTable();
  };

  async function loadInvitesTable() {
    const wrap = $("invTableWrap");

    if (!isOwner()) {
      wrap.innerHTML = `<p class="muted">Только owner видит список приглашений.</p>`;
      return;
    }

    wrap.innerHTML = `<p class="muted">Загрузка...</p>`;
    try {
      const data = await api("/api/invites-list");
      const rows = data.rows || [];

      if (!rows.length) {
        wrap.innerHTML = `<p class="muted">Пока нет приглашений.</p>`;
        return;
      }

      wrap.innerHTML = `
        <div style="overflow:auto;">
          <table class="table" style="min-width:840px;">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Создано</th>
                <th>Истекает</th>
                <th>Использовано</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${r.id}</td>
                  <td>${escapeHtml(r.email || "")}</td>
                  <td>${escapeHtml(r.role || "")}</td>
                  <td>${escapeHtml(r.created_at || "")}</td>
                  <td>${escapeHtml(r.expires_at || "")}</td>
                  <td>${r.used_at ? ("✅ " + escapeHtml(r.used_at)) : "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      wrap.innerHTML = `<p class="muted">❌ ${escapeHtml(e.message)}</p>`;
    }
  }

  await loadInvitesTable();
}

/* ================= EMPLOYEES VIEW ================= */
async function renderEmployeesView(root) {
  if (!isOwner()) {
    root.innerHTML = `
      <div class="card">
        <h2 style="margin-top:0;">Сотрудники</h2>
        <p class="muted">Этот раздел доступен только владельцу (owner).</p>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="card">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <h2 style="margin:0;">Сотрудники</h2>
        <button id="btnReloadUsers" class="btn">Обновить</button>
      </div>

      <p class="muted" style="margin-top:8px;">
        Включай право <b>может приглашать</b> тем сотрудникам, кому разрешено выдавать инвайты.
      </p>

      <div id="usersTableWrap" style="margin-top:12px;">
        <p class="muted">Загрузка...</p>
      </div>
    </div>
  `;

  $("btnReloadUsers").onclick = async () => {
    await loadUsers();
  };

  async function loadUsers() {
    const wrap = $("usersTableWrap");
    wrap.innerHTML = `<p class="muted">Загрузка...</p>`;

    try {
      const data = await api("/api/users");
      const rows = data.rows || [];

      if (!rows.length) {
        wrap.innerHTML = `<p class="muted">Нет пользователей.</p>`;
        return;
      }

      wrap.innerHTML = `
        <div style="overflow:auto;">
          <table class="table" style="min-width:760px;">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Имя</th>
                <th>Роль</th>
                <th>Может приглашать</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(u => `
                <tr>
                  <td>${u.id}</td>
                  <td>${escapeHtml(u.email || "")}</td>
                  <td>${escapeHtml(u.full_name || "")}</td>
                  <td>${escapeHtml(u.role || "")}</td>
                  <td>
                    ${u.role === "owner"
                      ? "Всегда"
                      : `<label style="display:inline-flex; align-items:center; gap:8px;">
                          <input type="checkbox" data-user-id="${u.id}" ${u.can_invite ? "checked" : ""} />
                          <span class="muted">Дать разрешение</span>
                        </label>`
                    }
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        <div style="margin-top:10px; display:flex; gap:10px; align-items:center;">
          <button id="btnSaveInvPerms" class="btn primary">Сохранить изменения</button>
          <span id="usersStatus" class="muted"></span>
        </div>
      `;

      $("btnSaveInvPerms").onclick = async () => {
        const status = $("usersStatus");
        status.textContent = "";

        const checkboxes = wrap.querySelectorAll('input[type="checkbox"][data-user-id]');
        const updates = [];
        checkboxes.forEach(cb => {
          updates.push({ id: Number(cb.dataset.userId), can_invite: cb.checked });
        });

        try {
          for (const u of updates) {
            await api(`/api/users/${u.id}/can-invite`, {
              method: "PATCH",
              body: JSON.stringify({ can_invite: u.can_invite })
            });
          }
          status.textContent = "✅ Сохранено";

          // ✅ после изменения прав обновим CURRENT_USER (на случай если ты включал себе/другим)
          await refreshMe();
        } catch (e) {
          status.textContent = "❌ " + e.message;
        }
      };
    } catch (e) {
      wrap.innerHTML = `<p class="muted">❌ ${escapeHtml(e.message)}</p>`;
    }
  }

  async function refreshMe() {
    try {
      const data = await api("/api/auth/me");
      CURRENT_USER = (data.user || data);
      applyRoleUi();
      const avatarName = $("avatarName");
      if (avatarName && CURRENT_USER) {
        avatarName.textContent = (CURRENT_USER.full_name || CURRENT_USER.email || "Профиль");
      }
    } catch {}
  }

  await loadUsers();
}

/* ================= EVENTS ================= */
document.addEventListener("DOMContentLoaded", () => {
  $("btnLogin").addEventListener("click", doLogin);
  $("btnRegister").addEventListener("click", () => {
    loginMsg.textContent = "Регистрация доступна только по приглашению";
  });

  checkSession();
});
