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

function normalizeImageSrc(imagePath, fallback = "/images/laptop-1.jpg") {
  if (!imagePath) {
    return fallback;
  }
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  return imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed");
  }
  return response.json();
}

function getSelectedCategoryId(categories) {
  const params = new URLSearchParams(window.location.search);
  const candidate = Number.parseInt(params.get("catid"), 10);
  if (Number.isNaN(candidate)) {
    return null;
  }
  return categories.some((entry) => entry.catid === candidate) ? candidate : null;
}

function renderCategoryLinks(categories, selectedCatid) {
  const list = document.getElementById("category-list");
  list.innerHTML = "";

  const allItem = document.createElement("li");
  const allLink = document.createElement("a");
  allLink.href = "index.html";
  allLink.textContent = "All";
  if (selectedCatid === null) {
    allLink.classList.add("active");
  }
  allItem.appendChild(allLink);
  list.appendChild(allItem);

  categories.forEach((category) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `index.html?catid=${category.catid}`;
    link.textContent = category.name;
    if (selectedCatid === category.catid) {
      link.classList.add("active");
    }
    item.appendChild(link);
    list.appendChild(item);
  });
}

function renderProductCards(products) {
  const list = document.getElementById("product-list");
  const emptyMessage = document.getElementById("empty-products-message");
  list.innerHTML = "";

  if (products.length === 0) {
    emptyMessage.hidden = false;
    return;
  }

  emptyMessage.hidden = true;

  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <a href="product.html?pid=${product.pid}">
          <div class="product-thumbnail">
              <img src="${escapeHtml(
                normalizeImageSrc(product.image_thumb || product.image_large)
              )}" alt="${escapeHtml(product.name)}">
          </div>
          <h3 class="product-name">${escapeHtml(product.name)}</h3>
      </a>
      <p class="product-price">$${formatPrice(product.price)}</p>
      <button class="add-to-cart-btn" data-id="${product.pid}">Add to Cart</button>
    `;
    list.appendChild(card);
  });
}

function setProductHeading(categories, selectedCatid) {
  const heading = document.getElementById("products-heading");
  if (selectedCatid === null) {
    heading.textContent = "All Products";
    return;
  }
  const category = categories.find((entry) => entry.catid === selectedCatid);
  heading.textContent = category ? `${category.name}` : "Products";
}

async function loadPage() {
  const categories = await fetchJson("/api/categories");
  const selectedCatid = getSelectedCategoryId(categories);
  renderCategoryLinks(categories, selectedCatid);
  setProductHeading(categories, selectedCatid);

  const productsUrl =
    selectedCatid === null ? "/api/products" : `/api/products?catid=${selectedCatid}`;
  const products = await fetchJson(productsUrl);
  renderProductCards(products);
}

loadPage().catch((error) => {
  const list = document.getElementById("product-list");
  list.innerHTML = `<p class="empty-products-message">${escapeHtml(error.message)}</p>`;
});
