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

function renderCategoryRows(categories) {
  const tableBody = document.getElementById("category-table-body");
  tableBody.innerHTML = "";

  categories.forEach((category) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${category.catid}</td>
      <td>${category.name}</td>
    `;
    tableBody.appendChild(row);
  });
}

function renderCategorySelects(categories) {
  const ids = [
    "update-category-id",
    "delete-category-id",
  ];

  ids.forEach((id) => {
    const select = document.getElementById(id);
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
  });
}

async function loadCategories() {
  const categories = await fetchJson("/api/categories");
  renderCategoryRows(categories);
  renderCategorySelects(categories);
}

async function handleCreateCategory(event) {
  event.preventDefault();
  const name = document.getElementById("create-category-name").value.trim();
  if (!name) {
    setStatus("Name is required.", true);
    return;
  }

  try {
    await fetchJson("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    event.target.reset();
    setStatus("Category created.");
    await loadCategories();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function handleUpdateCategory(event) {
  event.preventDefault();
  const catid = document.getElementById("update-category-id").value;
  const name = document.getElementById("update-category-name").value.trim();
  if (!catid || !name) {
    setStatus("Category and new name are required.", true);
    return;
  }

  try {
    await fetchJson(`/api/categories/${catid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setStatus("Category updated.");
    await loadCategories();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function handleDeleteCategory(event) {
  event.preventDefault();
  const catid = document.getElementById("delete-category-id").value;
  if (!catid) {
    setStatus("Category is required.", true);
    return;
  }

  try {
    await fetchJson(`/api/categories/${catid}`, {
      method: "DELETE",
    });
    setStatus("Category deleted.");
    await loadCategories();
  } catch (error) {
    setStatus(error.message, true);
  }
}

document.getElementById("create-category-form").addEventListener("submit", handleCreateCategory);
document.getElementById("update-category-form").addEventListener("submit", handleUpdateCategory);
document.getElementById("delete-category-form").addEventListener("submit", handleDeleteCategory);

// Wait for auth to load before fetching data
document.addEventListener("DOMContentLoaded", function () {
  loadCurrentUser().then(function () {
    if (!currentUser || !currentUser.is_admin) {
      window.location.href = "/login.html";
      return;
    }
    loadCategories().catch((error) => {
      setStatus(error.message, true);
    });
  });
});
