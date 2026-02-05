// gic-portal/invite.js  (FRONTEND / Browser)
// НИКАКИХ require / express / module.exports здесь быть не должно.

(async function () {
  const status = document.getElementById("status");
  const form = document.getElementById("form");
  const tokenInput = document.getElementById("token");
  const emailInput = document.getElementById("email");

  if (!status || !form) {
    console.error("Invite page elements not found. Check invite.html ids.");
    return;
  }

  const token = location.pathname.split("/").pop();
  if (tokenInput) tokenInput.value = token;

  status.textContent = "Проверяем приглашение...";

  try {
    const r = await fetch(`/api/invites/${encodeURIComponent(token)}`);
    const data = await r.json();

    if (!r.ok || !data.valid) {
      status.textContent = "Ошибка: " + (data.error || `HTTP ${r.status}`);
      return;
    }

    status.textContent =
      `Ок ✅ Роль: ${data.role}. Действительно до: ${data.expires_at}`;
    form.style.display = "block";

    if (data.email && emailInput) {
      emailInput.value = data.email;
      emailInput.readOnly = true;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const payload = {
        token,
        email: (emailInput ? emailInput.value : "").trim(),
        full_name: (document.getElementById("full_name")?.value || "").trim(),
        password: document.getElementById("password")?.value || "",
      };

      const rr = await fetch("/api/register-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const out = await rr.json();

      if (!rr.ok) {
        status.textContent = "Ошибка: " + (out.error || `HTTP ${rr.status}`);
        return;
      }

      // ✅ УСПЕХ
      status.textContent =
        "Аккаунт создан ✅ Через 3 секунды вы будете перенаправлены на страницу входа.";

      form.reset();
      form.style.display = "none";

      // ⏱ редирект через 3 секунды
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    });
  } catch (err) {
    console.error(err);
    status.textContent = "Ошибка соединения с сервером";
  }
})();
