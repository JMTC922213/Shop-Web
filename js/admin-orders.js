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

async function loadOrders() {
  try {
    var res = await fetch("/api/admin/orders");
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
  var tbody = document.getElementById("orders-table-body");
  tbody.innerHTML = "";

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">No orders yet.</td></tr>';
    return;
  }

  orders.forEach(function (order) {
    var itemSummary = order.items
      .map(function (item) {
        return escapeHtml(item.name || "Product #" + item.pid) + " x" + item.quantity;
      })
      .join(", ");

    var statusClass = "";
    if (order.status === "paid") statusClass = "status-paid";
    else if (order.status === "pending") statusClass = "status-pending";
    else statusClass = "status-failed";

    var row = document.createElement("tr");
    row.innerHTML =
      "<td>" + order.orderid + "</td>" +
      "<td>" + escapeHtml(order.user_name) + " (" + escapeHtml(order.user_email) + ")</td>" +
      '<td><span class="order-status ' + statusClass + '">' + escapeHtml(order.status) + "</span></td>" +
      "<td>$" + formatPrice(order.total) + "</td>" +
      "<td>" + escapeHtml(itemSummary) + "</td>" +
      "<td>" + escapeHtml(order.created_at) + "</td>";
    tbody.appendChild(row);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  loadCurrentUser().then(function () {
    if (!currentUser || !currentUser.is_admin) {
      window.location.href = "/login.html";
      return;
    }
    loadOrders();
  });
});
