(async function () {
  const status = document.getElementById("status");
  const form = document.getElementById("form");
  const tokenInput = document.getElementById("token");
  const emailInput = document.getElementById("email");

  const token = location.pathname.split("/").pop();
  tokenInput.value = token;

  status.textContent = "Проверяем приглашение...";

  const r = await fetch(`/api/invites/${encodeURIComponent(token)}`);
  const data = await r.json();

  if (!data.valid) {
    status.textContent = "Ошибка: " + (data.error || "invalid invite");
    return;
  }

  status.textContent = `Ок ✅ Роль: ${data.role}. Действительно до: ${data.expires_at}`;
  form.style.display = "block";

  if (data.email) {
    emailInput.value = data.email;
    emailInput.readOnly = true;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      token,
      email: emailInput.value.trim(),
      full_name: document.getElementById("full_name").value.trim(),
      password: document.getElementById("password").value,
    };

    const rr = await fetch("/api/register-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const out = await rr.json();
    if (!rr.ok) {
      status.textContent = "Ошибка: " + (out.error || "register failed");
      return;
    }

    status.textContent = "Аккаунт создан ✅ Теперь зайди на главной странице через логин.";
    form.reset();
  });
})();
