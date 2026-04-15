function setStatus(message, isError) {
  var el = document.getElementById("status-message");
  el.textContent = message;
  el.classList.toggle("error", !!isError);
}

document.addEventListener("DOMContentLoaded", function () {
  loadCurrentUser().then(function () {
    if (!currentUser) {
      window.location.href = "/login.html";
    }
  });
});

document.getElementById("change-password-form").addEventListener("submit", function (e) {
  e.preventDefault();
  var currentPw = document.getElementById("current-password").value;
  var newPw = document.getElementById("new-password").value;
  var confirmPw = document.getElementById("confirm-new-password").value;

  if (newPw !== confirmPw) {
    setStatus("New passwords do not match.", true);
    return;
  }

  if (newPw.length < 8) {
    setStatus("New password must be at least 8 characters.", true);
    return;
  }

  fetch("/api/auth/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken || "",
    },
    body: JSON.stringify({
      currentPassword: currentPw,
      newPassword: newPw,
      confirmNewPassword: confirmPw,
    }),
  })
    .then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; });
    })
    .then(function (result) {
      if (!result.ok) {
        var msg = result.data.error || "Failed to change password.";
        if (result.data.details) {
          msg += " (" + result.data.details.map(function (d) { return d.message; }).join(", ") + ")";
        }
        setStatus(msg, true);
        return;
      }
      setStatus("Password changed. Redirecting to login...");
      setTimeout(function () { window.location.href = "/login.html"; }, 1500);
    })
    .catch(function () {
      setStatus("Network error.", true);
    });
});
