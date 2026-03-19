function CartItem(pid, quantity) {
  this.pid = pid;
  this.quantity = quantity;
  this.name = null;
  this.price = null;
}

CartItem.prototype.getSubtotal = function () {
  if (this.price === null) {
    return 0;
  }
  return this.price * this.quantity;
};

function ShoppingCart() {
  this.items = [];
}

ShoppingCart.prototype.loadCart = function () {
  try {
    var data = JSON.parse(localStorage.getItem("cart"));
    if (Array.isArray(data)) {
      this.items = data.map(function (entry) {
        return new CartItem(entry.pid, entry.quantity);
      });
    }
  } catch (e) {
    this.items = [];
  }
};

ShoppingCart.prototype.saveCart = function () {
  var data = this.items.map(function (item) {
    return { pid: item.pid, quantity: item.quantity };
  });
  localStorage.setItem("cart", JSON.stringify(data));
};

ShoppingCart.prototype.addItem = function (pid) {
  pid = Number(pid);
  var existing = this.items.find(function (item) {
    return item.pid === pid;
  });
  if (existing) {
    existing.quantity += 1;
  } else {
    this.items.push(new CartItem(pid, 1));
  }
  this.saveCart();
  this.renderCart();
};

ShoppingCart.prototype.removeItem = function (pid) {
  pid = Number(pid);
  this.items = this.items.filter(function (item) {
    return item.pid !== pid;
  });
  this.saveCart();
  this.renderCart();
};

ShoppingCart.prototype.updateQuantity = function (pid, qty) {
  pid = Number(pid);
  qty = Number(qty);
  if (qty < 1) {
    this.removeItem(pid);
    return;
  }
  var item = this.items.find(function (item) {
    return item.pid === pid;
  });
  if (item) {
    item.quantity = qty;
    this.saveCart();
    this.renderCart();
  }
};

ShoppingCart.prototype.renderCart = function () {
  var self = this;
  var cartItemsEl = document.querySelector(".cart-items");
  var cartTotalEl = document.getElementById("cart-total");
  var cartCountEls = document.querySelectorAll(".cart-count");

  // Update badge count
  var totalCount = 0;
  for (var i = 0; i < this.items.length; i++) {
    totalCount += this.items[i].quantity;
  }
  for (var j = 0; j < cartCountEls.length; j++) {
    cartCountEls[j].textContent = totalCount;
  }

  if (this.items.length === 0) {
    cartItemsEl.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
    cartTotalEl.textContent = "0.00";
    return;
  }

  // Fetch product details for each item, then render
  var fetches = this.items.map(function (item) {
    return fetch("/api/products/" + item.pid)
      .then(function (res) {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(function (product) {
        item.name = product.name;
        item.price = Number(product.price);
      })
      .catch(function () {
        item.name = "Unknown Product";
        item.price = 0;
      });
  });

  Promise.all(fetches).then(function () {
    var html = "";
    var total = 0;

    for (var i = 0; i < self.items.length; i++) {
      var item = self.items[i];
      total += item.getSubtotal();
      html +=
        '<div class="cart-item">' +
          '<div class="cart-item-name">' + escapeHtml(item.name) + "</div>" +
          '<div class="cart-item-price">$' + formatPrice(item.price) + "</div>" +
          '<div class="cart-item-quantity">' +
            '<button class="qty-btn" data-pid="' + item.pid + '" data-action="minus">-</button>' +
            '<input type="number" value="' + item.quantity + '" min="1" data-pid="' + item.pid + '" class="qty-input">' +
            '<button class="qty-btn" data-pid="' + item.pid + '" data-action="plus">+</button>' +
            '<button class="cart-item-delete" data-pid="' + item.pid + '">X</button>' +
          "</div>" +
        "</div>";
    }

    cartItemsEl.innerHTML = html;
    cartTotalEl.textContent = formatPrice(total);
  });
};

ShoppingCart.prototype.init = function () {
  var self = this;

  this.loadCart();
  this.renderCart();

  // "Add to Cart" buttons — event delegation on body
  document.body.addEventListener("click", function (e) {
    var btn = e.target.closest(".add-to-cart-btn");
    if (btn && btn.dataset.id) {
      e.preventDefault();
      self.addItem(btn.dataset.id);
    }
  });

  // Cart sidebar — qty +/-, delete, and manual input
  var cartItemsEl = document.querySelector(".cart-items");
  cartItemsEl.addEventListener("click", function (e) {
    var target = e.target;

    // +/- buttons
    if (target.classList.contains("qty-btn")) {
      var pid = Number(target.dataset.pid);
      var item = self.items.find(function (item) {
        return item.pid === pid;
      });
      if (!item) return;
      if (target.dataset.action === "plus") {
        self.updateQuantity(pid, item.quantity + 1);
      } else if (target.dataset.action === "minus") {
        self.updateQuantity(pid, item.quantity - 1);
      }
    }

    // Delete button
    if (target.classList.contains("cart-item-delete")) {
      self.removeItem(target.dataset.pid);
    }
  });

  // Manual quantity input change
  cartItemsEl.addEventListener("change", function (e) {
    if (e.target.classList.contains("qty-input")) {
      var qty = parseInt(e.target.value, 10);
      if (isNaN(qty) || qty < 1) qty = 1;
      self.updateQuantity(e.target.dataset.pid, qty);
    }
  });
};

// Helper functions (same as other pages)
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

// Initialize cart when page loads
document.addEventListener("DOMContentLoaded", function () {
  var cart = new ShoppingCart();
  cart.init();
});
