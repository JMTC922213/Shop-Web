function setStatus(message, isError) {
  var el = document.getElementById("status-message");
  el.textContent = message;
  el.classList.toggle("error", !!isError);
}

document.getElementById("register-form").addEventListener("submit", function (e) {
  e.preventDefault();
  var name = document.getElementById("register-name").value.trim();
  var email = document.getElementById("register-email").value.trim();
  var password = document.getElementById("register-password").value;
  var confirm = document.getElementById("register-confirm").value;

  if (password !== confirm) {
    setStatus("Passwords do not match.", true);
    return;
  }

  if (password.length < 8) {
    setStatus("Password must be at least 8 characters.", true);
    return;
  }

  fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name, email: email, password: password, confirmPassword: confirm }),
  })
    .then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; });
    })
    .then(function (result) {
      if (!result.ok) {
        var msg = result.data.error || "Registration failed.";
        if (result.data.details) {
          msg += " (" + result.data.details.map(function (d) { return d.message; }).join(", ") + ")";
        }
        setStatus(msg, true);
        return;
      }
      setStatus("Registration successful! Redirecting to login...");
      setTimeout(function () { window.location.href = "/login.html"; }, 1500);
    })
    .catch(function () {
      setStatus("Network error. Please try again.", true);
    });
});
