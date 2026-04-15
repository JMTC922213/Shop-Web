function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatPrice(price) {
  return Number(price).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function setStatus(message, isError) {
  var el = document.getElementById("status-message");
  el.textContent = message;
  el.classList.toggle("error", !!isError);
}

async function loadMyOrders() {
  try {
    var res = await fetch("/api/orders/my");
    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    var orders = await res.json();
    renderOrders(orders);
  } catch (err) {
    setStatus("Failed to load orders.", true);
  }
}

function renderOrders(orders) {
  var container = document.getElementById("orders-container");
  container.innerHTML = "";

  if (orders.length === 0) {
    container.innerHTML = '<p class="empty-cart">You have no orders yet.</p>';
    return;
  }

  orders.forEach(function (order) {
    var statusClass = "";
    if (order.status === "paid") statusClass = "status-paid";
    else if (order.status === "pending") statusClass = "status-pending";
    else statusClass = "status-failed";

    var itemsHtml = order.items
      .map(function (item) {
        return '<div class="order-item-row">' +
          '<span>' + escapeHtml(item.name || "Product #" + item.pid) + " x" + item.quantity + "</span>" +
          '<span>$' + formatPrice(item.price_at_purchase * item.quantity) + "</span>" +
          "</div>";
      })
      .join("");

    var card = document.createElement("div");
    card.className = "order-card";
    card.innerHTML =
      '<div class="order-header">' +
        '<span class="order-id">Order #' + order.orderid + "</span>" +
        '<span class="order-status ' + statusClass + '">' + escapeHtml(order.status) + "</span>" +
      "</div>" +
      '<div class="order-items">' + itemsHtml + "</div>" +
      '<div class="order-footer">' +
        '<span class="order-date">' + escapeHtml(order.created_at) + "</span>" +
        '<span class="order-total">Total: $' + formatPrice(order.total) + "</span>" +
      "</div>";
    container.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  loadCurrentUser().then(function () {
    if (!currentUser) {
      window.location.href = "/login.html";
      return;
    }
    loadMyOrders();
  });
});
