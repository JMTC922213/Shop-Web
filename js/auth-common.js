var currentUser = null;
var csrfToken = null;

function escapeHtmlAuth(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function updateUserIndicator() {
  var el = document.getElementById("user-indicator");
  if (!el) return;

  if (currentUser) {
    el.textContent = "";
    var nameSpan = document.createElement("span");
    nameSpan.textContent = currentUser.name;
    el.appendChild(nameSpan);

    el.appendChild(document.createTextNode(" | "));
    var ordersLink = document.createElement("a");
    ordersLink.href = "my-orders.html";
    ordersLink.textContent = "My Orders";
    el.appendChild(ordersLink);

    el.appendChild(document.createTextNode(" | "));
    var settingsLink = document.createElement("a");
    settingsLink.href = "change-password.html";
    settingsLink.textContent = "Settings";
    el.appendChild(settingsLink);

    el.appendChild(document.createTextNode(" | "));
    var logoutLink = document.createElement("a");
    logoutLink.href = "#";
    logoutLink.textContent = "Logout";
    logoutLink.addEventListener("click", function (e) {
      e.preventDefault();
      fetch("/api/auth/logout", {
        method: "POST",
        headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
      }).then(function () {
        window.location.href = "/";
      });
    });
    el.appendChild(logoutLink);
  } else {
    el.textContent = "";
    var guest = document.createTextNode("Guest | ");
    el.appendChild(guest);
    var loginLink = document.createElement("a");
    loginLink.href = "login.html";
    loginLink.textContent = "Login";
    el.appendChild(loginLink);
  }
}

function loadCurrentUser() {
  return fetch("/api/auth/me")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      currentUser = data.user;
      csrfToken = data.csrf_token;
      updateUserIndicator();
      return data;
    })
    .catch(function () {
      currentUser = null;
      csrfToken = null;
      updateUserIndicator();
    });
}

document.addEventListener("DOMContentLoaded", function () {
  loadCurrentUser();
});
