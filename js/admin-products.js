let categories = [];
let products = [];

function setStatus(message, isError = false) {
  const statusEl = document.getElementById("status-message");
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

async function fetchJson(url, options = {}) {
  if (options.method && options.method !== "GET") {
    options.headers = options.headers || {};
    if (typeof csrfToken === "string" && csrfToken) {
      options.headers["X-CSRF-Token"] = csrfToken;
    }
  }
  const response = await fetch(url, options);
  if (response.status === 401) {
    window.location.href = "/login.html";
    throw new Error("Authentication required");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(data.details)
      ? ` (${data.details.map((item) => item.message).join(", ")})`
      : "";
    throw new Error((data.error || "Request failed") + details);
  }
  return data;
}

function formatPrice(price) {
  return Number(price).toFixed(2);
}

function renderCategorySelect(selectId) {
  const select = document.getElementById(selectId);
  const currentValue = select.value;
  select.innerHTML = "";

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = String(category.catid);
    option.textContent = `${category.catid} - ${category.name}`;
    select.appendChild(option);
  });

  if (currentValue) {
    select.value = currentValue;
  }
}

function renderProductSelect(selectId) {
  const select = document.getElementById(selectId);
  const currentValue = select.value;
  select.innerHTML = "";

  products.forEach((product) => {
    const option = document.createElement("option");
    option.value = String(product.pid);
    option.textContent = `${product.pid} - ${product.name}`;
    select.appendChild(option);
  });

  if (currentValue) {
    select.value = currentValue;
  }
}

function renderProductRows() {
  const tableBody = document.getElementById("product-table-body");
  tableBody.innerHTML = "";

  products.forEach((product) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${product.pid}</td>
      <td>${product.catid}</td>
      <td>${product.name}</td>
      <td>$${formatPrice(product.price)}</td>
    `;
    tableBody.appendChild(row);
  });
}

function populateUpdateFormFromSelectedProduct() {
  const selectedPid = Number(document.getElementById("update-product-id").value);
  const product = products.find((entry) => entry.pid === selectedPid);
  if (!product) {
    return;
  }

  document.getElementById("update-product-catid").value = String(product.catid);
  document.getElementById("update-product-name").value = product.name;
  document.getElementById("update-product-price").value = Number(product.price).toFixed(2);
  document.getElementById("update-product-description").value = product.description;
  document.getElementById("update-product-image").value = "";
}

async function reloadAllData() {
  categories = await fetchJson("/api/categories");
  products = await fetchJson("/api/products");

  renderCategorySelect("create-product-catid");
  renderCategorySelect("update-product-catid");
  renderProductSelect("update-product-id");
  renderProductSelect("delete-product-id");
  renderProductRows();
  populateUpdateFormFromSelectedProduct();
}

function buildCreateFormData() {
  const formData = new FormData();
  formData.append("catid", document.getElementById("create-product-catid").value);
  formData.append("name", document.getElementById("create-product-name").value.trim());
  formData.append("price", document.getElementById("create-product-price").value);
  formData.append(
    "description",
    document.getElementById("create-product-description").value.trim()
  );
  const imageFile = document.getElementById("create-product-image").files[0];
  if (imageFile) {
    formData.append("image", imageFile);
  }
  return formData;
}

function buildUpdateFormData() {
  const formData = new FormData();
  formData.append("catid", document.getElementById("update-product-catid").value);
  formData.append("name", document.getElementById("update-product-name").value.trim());
  formData.append("price", document.getElementById("update-product-price").value);
  formData.append(
    "description",
    document.getElementById("update-product-description").value.trim()
  );
  const imageFile = document.getElementById("update-product-image").files[0];
  if (imageFile) {
    formData.append("image", imageFile);
  }
  return formData;
}

async function handleCreateProduct(event) {
  event.preventDefault();
  try {
    const formData = buildCreateFormData();
    await fetchJson("/api/products", {
      method: "POST",
      body: formData,
    });
    event.target.reset();
    setStatus("Product created.");
    await reloadAllData();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function handleUpdateProduct(event) {
  event.preventDefault();
  const pid = document.getElementById("update-product-id").value;
  if (!pid) {
    setStatus("Select a product first.", true);
    return;
  }

  try {
    const formData = buildUpdateFormData();
    await fetchJson(`/api/products/${pid}`, {
      method: "PUT",
      body: formData,
    });
    setStatus("Product updated.");
    await reloadAllData();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function handleDeleteProduct(event) {
  event.preventDefault();
  const pid = document.getElementById("delete-product-id").value;
  if (!pid) {
    setStatus("Select a product first.", true);
    return;
  }

  try {
    await fetchJson(`/api/products/${pid}`, { method: "DELETE" });
    setStatus("Product deleted.");
    await reloadAllData();
  } catch (error) {
    setStatus(error.message, true);
  }
}

document.getElementById("create-product-form").addEventListener("submit", handleCreateProduct);
document.getElementById("update-product-form").addEventListener("submit", handleUpdateProduct);
document.getElementById("delete-product-form").addEventListener("submit", handleDeleteProduct);
document
  .getElementById("update-product-id")
  .addEventListener("change", populateUpdateFormFromSelectedProduct);

// Wait for auth to load before fetching data
document.addEventListener("DOMContentLoaded", function () {
  loadCurrentUser().then(function () {
    if (!currentUser || !currentUser.is_admin) {
      window.location.href = "/login.html";
      return;
    }
    reloadAllData().catch((error) => {
      setStatus(error.message, true);
    });
  });
});
