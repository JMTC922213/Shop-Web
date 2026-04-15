// Checkout button handler — depends on auth-common.js (currentUser, csrfToken) and cart.js (window.shopCart)

(function () {
  // Show order success/cancelled messages from redirect query params
  function handleOrderRedirect() {
    var params = new URLSearchParams(window.location.search);
    var successId = params.get("order_success");
    var cancelledId = params.get("order_cancelled");

    if (successId) {
      showCheckoutMessage("Order #" + successId + " placed successfully! Thank you for your purchase.", false);
      // Clean URL without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (cancelledId) {
      showCheckoutMessage("Order #" + cancelledId + " was cancelled. Your cart items have been preserved.", true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  function showCheckoutMessage(message, isError) {
    // Remove any existing checkout message
    var existing = document.getElementById("checkout-message");
    if (existing) existing.remove();

    var div = document.createElement("div");
    div.id = "checkout-message";
    div.style.cssText = "padding:15px 20px;margin:10px auto;max-width:1200px;width:90%;border-radius:4px;font-weight:bold;text-align:center;";
    if (isError) {
      div.style.backgroundColor = "#f8d7da";
      div.style.color = "#721c24";
      div.style.border = "1px solid #f5c6cb";
    } else {
      div.style.backgroundColor = "#d4edda";
      div.style.color = "#155724";
      div.style.border = "1px solid #c3e6cb";
    }
    div.textContent = message;

    var main = document.querySelector("main");
    if (main) {
      main.parentNode.insertBefore(div, main);
    }
  }

  function initCheckout() {
    handleOrderRedirect();

    var checkoutBtn = document.querySelector(".checkout-btn");
    if (!checkoutBtn) return;

    checkoutBtn.addEventListener("click", function (e) {
      e.preventDefault();

      // Check if user is logged in
      if (!currentUser) {
        alert("Please log in to checkout.");
        window.location.href = "/login.html";
        return;
      }

      var cart = window.shopCart;
      if (!cart || !cart.items || cart.items.length === 0) {
        alert("Your cart is empty.");
        return;
      }

      // Build items array with only pid and quantity (never price)
      var items = cart.items.map(function (item) {
        return { pid: item.pid, quantity: item.quantity };
      });

      // Disable button during request
      checkoutBtn.disabled = true;
      checkoutBtn.textContent = "Processing...";

      fetch("/api/checkout/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || "",
        },
        body: JSON.stringify({ items: items }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            alert(result.data.error || "Checkout failed.");
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = "Checkout";
            return;
          }

          // Clear local cart
          localStorage.removeItem("cart");

          // Redirect to Stripe Checkout
          window.location.href = result.data.checkout_url;
        })
        .catch(function () {
          alert("Network error. Please try again.");
          checkoutBtn.disabled = false;
          checkoutBtn.textContent = "Checkout";
        });
    });
  }

  document.addEventListener("DOMContentLoaded", initCheckout);
})();
