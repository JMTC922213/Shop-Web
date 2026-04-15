function setStatus(message, isError) {
  var el = document.getElementById("status-message");
  el.textContent = message;
  el.classList.toggle("error", !!isError);
}

document.getElementById("login-form").addEventListener("submit", function (e) {
  e.preventDefault();
  var email = document.getElementById("login-email").value.trim();
  var password = document.getElementById("login-password").value;

  if (!email || !password) {
    setStatus("Email and password are required.", true);
    return;
  }

  fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: password }),
  })
    .then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; });
    })
    .then(function (result) {
      if (!result.ok) {
        setStatus(result.data.error || "Login failed.", true);
        return;
      }
      setStatus("Login successful. Redirecting...");
      window.location.href = result.data.redirect || "/";
    })
    .catch(function () {
      setStatus("Network error. Please try again.", true);
    });
});
