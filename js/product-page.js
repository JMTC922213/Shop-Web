function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeImageSrc(imagePath, fallback = "/images/laptop-1-full.jpg") {
  if (!imagePath) {
    return fallback;
  }
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  return imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
}

function formatPrice(price) {
  return Number(price).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed");
  }
  return response.json();
}

function getPidFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const pid = Number.parseInt(params.get("pid"), 10);
  return Number.isNaN(pid) ? null : pid;
}

function renderProduct(product) {
  const wrapper = document.getElementById("product-detail-wrapper");
  wrapper.innerHTML = `
      <div class="product-image-section">
          <img src="${escapeHtml(
            normalizeImageSrc(product.image_large || product.image_thumb)
          )}" alt="${escapeHtml(product.name)}" class="product-main-image">
      </div>

      <div class="product-info-section">
          <h1 class="product-title">${escapeHtml(product.name)}</h1>

          <p class="product-price-large">$${formatPrice(product.price)}</p>

          <div class="product-description">
              <h2>Product Description</h2>
              <p>${escapeHtml(product.description)}</p>
          </div>

          <div class="product-actions">
              <button class="add-to-cart-btn large" data-id="${product.pid}">Add to Cart</button>
          </div>
      </div>
  `;
}

function renderRelatedProducts(allProducts, currentProduct) {
  const relatedList = document.getElementById("related-product-list");
  const empty = document.getElementById("empty-related-message");

  const related = allProducts
    .filter(
      (item) => item.catid === currentProduct.catid && item.pid !== currentProduct.pid
    )
    .slice(0, 4);

  relatedList.innerHTML = "";

  if (related.length === 0) {
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  related.forEach((product) => {
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
    relatedList.appendChild(card);
  });
}

function updateBreadcrumb(product, categories) {
  const category = categories.find((entry) => entry.catid === product.catid);
  const categoryLabel = category ? category.name : "Category";
  const categoryLink = document.getElementById("category-link");
  categoryLink.textContent = categoryLabel;
  categoryLink.href = `index.html?catid=${product.catid}`;

  document.getElementById("breadcrumb-product-name").textContent = product.name;
  document.title = `${product.name} - TechShop`;
}

function renderError(message) {
  const wrapper = document.getElementById("product-detail-wrapper");
  wrapper.innerHTML = `<p class="empty-products-message">${escapeHtml(message)}</p>`;
}

async function loadPage() {
  const pid = getPidFromQuery();
  if (!pid) {
    renderError("Missing product id.");
    return;
  }

  const [product, allProducts, categories] = await Promise.all([
    fetchJson(`/api/products/${pid}`),
    fetchJson("/api/products"),
    fetchJson("/api/categories"),
  ]);

  renderProduct(product);
  renderRelatedProducts(allProducts, product);
  updateBreadcrumb(product, categories);
}

loadPage().catch((error) => {
  renderError(error.message);
});
