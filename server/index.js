require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const cookieParser = require("cookie-parser");
const { body, param, validationResult } = require("express-validator");
const { createDb } = require("./db");
const { parseSession, requireAdmin, registerAuthRoutes } = require("./auth");
const { validateCsrf } = require("./csrf");
const { registerWebhookRoute, registerCheckoutRoutes } = require("./checkout");

const PORT = Number(process.env.PORT || 3000);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function sanitizeShortText(value) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .trim();
}

function sanitizeDescription(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function toImageUrl(imagePath) {
  if (!imagePath) {
    return "";
  }
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  return imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
}

function mapProductRow(row) {
  if (!row) {
    return row;
  }
  return {
    ...row,
    image_large: toImageUrl(row.image_large),
    image_thumb: toImageUrl(row.image_thumb),
  };
}

function getValidationErrorResponse(req, res) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return false;
  }

  res.status(400).json({
    error: "Validation failed",
    details: result.array().map((entry) => ({
      field: entry.path,
      message: entry.msg,
    })),
  });
  return true;
}

function buildUploader() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (_req, file, callback) => {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        callback(new Error("UNSUPPORTED_IMAGE_FORMAT"));
        return;
      }
      callback(null, true);
    },
  });
}

function normalizePublicPath(publicPath) {
  if (!publicPath || typeof publicPath !== "string") {
    return null;
  }
  const trimmed = publicPath.startsWith("/") ? publicPath.slice(1) : publicPath;
  if (!trimmed.startsWith("uploads/")) {
    return null;
  }
  return trimmed;
}

async function safelyDeleteFileIfExists(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function writeImageVariants({ fileBuffer, pid, uploadsProductDir, uploadsThumbDir }) {
  const largeFileName = `${pid}.jpg`;
  const thumbFileName = `${pid}-thumb.jpg`;
  const largeDiskPath = path.join(uploadsProductDir, largeFileName);
  const thumbDiskPath = path.join(uploadsThumbDir, thumbFileName);

  await sharp(fileBuffer)
    .rotate()
    .resize({
      width: 1000,
      height: 1000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 84 })
    .toFile(largeDiskPath);

  await sharp(fileBuffer)
    .rotate()
    .resize({
      width: 320,
      height: 320,
      fit: "cover",
      position: "centre",
    })
    .jpeg({ quality: 78 })
    .toFile(thumbDiskPath);

  return {
    imageLarge: `/uploads/products/${largeFileName}`,
    imageThumb: `/uploads/thumbnails/${thumbFileName}`,
  };
}

async function startServer() {
  const app = express();
  const upload = buildUploader();
  const database = await createDb();

  const webRoot = path.join(__dirname, "..");
  const uploadsProductDir = path.join(webRoot, "uploads", "products");
  const uploadsThumbDir = path.join(webRoot, "uploads", "thumbnails");

  fs.mkdirSync(uploadsProductDir, { recursive: true });
  fs.mkdirSync(uploadsThumbDir, { recursive: true });

  // Register Stripe webhook BEFORE express.json() — webhook needs raw body
  registerWebhookRoute(app, database);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Content Security Policy
  app.use((_req, res, next) => {
    res.setHeader("Content-Security-Policy",
      "default-src 'self'; script-src 'self' https://js.stripe.com; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self'"
    );
    next();
  });

  app.use("/uploads/products", express.static(uploadsProductDir));
  app.use("/uploads/thumbnails", express.static(uploadsThumbDir));
  app.use("/css", express.static(path.join(webRoot, "css")));
  app.use("/images", express.static(path.join(webRoot, "images")));
  app.use("/js", express.static(path.join(webRoot, "js")));

  // Cookie parsing and session/CSRF middleware
  app.use(cookieParser());
  app.use((req, res, next) => parseSession(database, req, res, next));
  app.use(validateCsrf);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/categories", async (_req, res) => {
    try {
      const rows = await database.all(
        "SELECT catid, name FROM categories ORDER BY catid ASC"
      );
      res.json(rows);
    } catch (_error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post(
    "/api/categories",
    requireAdmin,
    [
      body("name")
        .trim()
        .notEmpty()
        .withMessage("Category name is required")
        .isLength({ max: 100 })
        .withMessage("Category name must be <= 100 characters")
        .customSanitizer(sanitizeShortText),
    ],
    async (req, res) => {
      if (getValidationErrorResponse(req, res)) {
        return;
      }

      try {
        const result = await database.run("INSERT INTO categories (name) VALUES (?)", [
          req.body.name,
        ]);
        const row = await database.get(
          "SELECT catid, name FROM categories WHERE catid = ?",
          [result.lastID]
        );
        res.status(201).json(row);
      } catch (error) {
        if (String(error.message || "").includes("UNIQUE")) {
          res.status(409).json({ error: "Category name already exists" });
          return;
        }
        res.status(500).json({ error: "Failed to create category" });
      }
    }
  );

  app.put(
    "/api/categories/:catid",
    requireAdmin,
    [
      param("catid").isInt({ min: 1 }).withMessage("Invalid category id").toInt(),
      body("name")
        .trim()
        .notEmpty()
        .withMessage("Category name is required")
        .isLength({ max: 100 })
        .withMessage("Category name must be <= 100 characters")
        .customSanitizer(sanitizeShortText),
    ],
    async (req, res) => {
      if (getValidationErrorResponse(req, res)) {
        return;
      }

      try {
        const existing = await database.get(
          "SELECT catid FROM categories WHERE catid = ?",
          [req.params.catid]
        );
        if (!existing) {
          res.status(404).json({ error: "Category not found" });
          return;
        }

        await database.run("UPDATE categories SET name = ? WHERE catid = ?", [
          req.body.name,
          req.params.catid,
        ]);
        const row = await database.get(
          "SELECT catid, name FROM categories WHERE catid = ?",
          [req.params.catid]
        );
        res.json(row);
      } catch (error) {
        if (String(error.message || "").includes("UNIQUE")) {
          res.status(409).json({ error: "Category name already exists" });
          return;
        }
        res.status(500).json({ error: "Failed to update category" });
      }
    }
  );

  app.delete(
    "/api/categories/:catid",
    requireAdmin,
    [param("catid").isInt({ min: 1 }).withMessage("Invalid category id").toInt()],
    async (req, res) => {
      if (getValidationErrorResponse(req, res)) {
        return;
      }

      try {
        const existing = await database.get(
          "SELECT catid, name FROM categories WHERE catid = ?",
          [req.params.catid]
        );
        if (!existing) {
          res.status(404).json({ error: "Category not found" });
          return;
        }

        const categoryProducts = await database.all(
          "SELECT image_large, image_thumb FROM products WHERE catid = ?",
          [req.params.catid]
        );

        await database.run("DELETE FROM categories WHERE catid = ?", [req.params.catid]);

        for (const product of categoryProducts) {
          const largePublic = normalizePublicPath(product.image_large);
          const thumbPublic = normalizePublicPath(product.image_thumb);
          if (largePublic) {
            await safelyDeleteFileIfExists(path.join(webRoot, largePublic));
          }
          if (thumbPublic) {
            await safelyDeleteFileIfExists(path.join(webRoot, thumbPublic));
          }
        }

        res.json({ deleted: true, category: existing });
      } catch (_error) {
        res.status(500).json({ error: "Failed to delete category" });
      }
    }
  );

  app.get("/api/products", async (req, res) => {
    try {
      const catid = Number.parseInt(req.query.catid, 10);
      if (Number.isNaN(catid)) {
        const rows = await database.all(
          "SELECT pid, catid, name, price, description, image_large, image_thumb FROM products ORDER BY pid ASC"
        );
        res.json(rows.map(mapProductRow));
        return;
      }

      const rows = await database.all(
        "SELECT pid, catid, name, price, description, image_large, image_thumb FROM products WHERE catid = ? ORDER BY pid ASC",
        [catid]
      );
      res.json(rows.map(mapProductRow));
    } catch (_error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get(
    "/api/products/:pid",
    [param("pid").isInt({ min: 1 }).withMessage("Invalid product id").toInt()],
    async (req, res) => {
      if (getValidationErrorResponse(req, res)) {
        return;
      }

      try {
        const row = await database.get(
          "SELECT pid, catid, name, price, description, image_large, image_thumb FROM products WHERE pid = ?",
          [req.params.pid]
        );
        if (!row) {
          res.status(404).json({ error: "Product not found" });
          return;
        }
        res.json(mapProductRow(row));
      } catch (_error) {
        res.status(500).json({ error: "Failed to fetch product" });
      }
    }
  );

  const productValidationRules = [
    body("catid")
      .trim()
      .isInt({ min: 1 })
      .withMessage("catid must be a positive integer")
      .toInt(),
    body("name")
      .trim()
      .notEmpty()
      .withMessage("name is required")
      .isLength({ max: 200 })
      .withMessage("name must be <= 200 characters")
      .customSanitizer(sanitizeShortText),
    body("price")
      .trim()
      .isFloat({ min: 0 })
      .withMessage("price must be a non-negative number")
      .toFloat(),
    body("description")
      .trim()
      .notEmpty()
      .withMessage("description is required")
      .isLength({ max: 5000 })
      .withMessage("description must be <= 5000 characters")
      .customSanitizer(sanitizeDescription),
  ];

  app.post("/api/products", requireAdmin, upload.single("image"), productValidationRules, async (req, res) => {
    if (getValidationErrorResponse(req, res)) {
      return;
    }

    try {
      const category = await database.get(
        "SELECT catid FROM categories WHERE catid = ?",
        [req.body.catid]
      );
      if (!category) {
        res.status(400).json({ error: "Invalid category id" });
        return;
      }

      const inserted = await database.run(
        "INSERT INTO products (catid, name, price, description) VALUES (?, ?, ?, ?)",
        [req.body.catid, req.body.name, req.body.price, req.body.description]
      );
      const pid = inserted.lastID;

      if (req.file) {
        const imagePaths = await writeImageVariants({
          fileBuffer: req.file.buffer,
          pid,
          uploadsProductDir,
          uploadsThumbDir,
        });
        await database.run(
          "UPDATE products SET image_large = ?, image_thumb = ? WHERE pid = ?",
          [imagePaths.imageLarge, imagePaths.imageThumb, pid]
        );
      }

      const row = await database.get(
        "SELECT pid, catid, name, price, description, image_large, image_thumb FROM products WHERE pid = ?",
        [pid]
      );
      res.status(201).json(mapProductRow(row));
    } catch (_error) {
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.put(
    "/api/products/:pid",
    requireAdmin,
    [param("pid").isInt({ min: 1 }).withMessage("Invalid product id").toInt()],
    upload.single("image"),
    productValidationRules,
    async (req, res) => {
      if (getValidationErrorResponse(req, res)) {
        return;
      }

      try {
        const existing = await database.get(
          "SELECT pid, image_large, image_thumb FROM products WHERE pid = ?",
          [req.params.pid]
        );
        if (!existing) {
          res.status(404).json({ error: "Product not found" });
          return;
        }

        const category = await database.get(
          "SELECT catid FROM categories WHERE catid = ?",
          [req.body.catid]
        );
        if (!category) {
          res.status(400).json({ error: "Invalid category id" });
          return;
        }

        await database.run(
          "UPDATE products SET catid = ?, name = ?, price = ?, description = ? WHERE pid = ?",
          [
            req.body.catid,
            req.body.name,
            req.body.price,
            req.body.description,
            req.params.pid,
          ]
        );

        if (req.file) {
          const imagePaths = await writeImageVariants({
            fileBuffer: req.file.buffer,
            pid: req.params.pid,
            uploadsProductDir,
            uploadsThumbDir,
          });
          await database.run(
            "UPDATE products SET image_large = ?, image_thumb = ? WHERE pid = ?",
            [imagePaths.imageLarge, imagePaths.imageThumb, req.params.pid]
          );
        }

        const row = await database.get(
          "SELECT pid, catid, name, price, description, image_large, image_thumb FROM products WHERE pid = ?",
          [req.params.pid]
        );
        res.json(mapProductRow(row));
      } catch (_error) {
        res.status(500).json({ error: "Failed to update product" });
      }
    }
  );

  app.delete(
    "/api/products/:pid",
    requireAdmin,
    [param("pid").isInt({ min: 1 }).withMessage("Invalid product id").toInt()],
    async (req, res) => {
      if (getValidationErrorResponse(req, res)) {
        return;
      }

      try {
        const existing = await database.get(
          "SELECT pid, catid, name, image_large, image_thumb FROM products WHERE pid = ?",
          [req.params.pid]
        );
        if (!existing) {
          res.status(404).json({ error: "Product not found" });
          return;
        }

        const largePublic = normalizePublicPath(existing.image_large);
        const thumbPublic = normalizePublicPath(existing.image_thumb);

        if (largePublic) {
          await safelyDeleteFileIfExists(path.join(webRoot, largePublic));
        }
        if (thumbPublic) {
          await safelyDeleteFileIfExists(path.join(webRoot, thumbPublic));
        }

        await database.run("DELETE FROM products WHERE pid = ?", [req.params.pid]);
        res.json({ deleted: true, product: existing });
      } catch (_error) {
        res.status(500).json({ error: "Failed to delete product" });
      }
    }
  );

  app.get(/^\/product-(\d+)\.html$/i, (req, res) => {
    res.redirect(302, `/product.html?pid=${req.params[0]}`);
  });

  // Register auth routes
  registerAuthRoutes(app, database);

  // Register checkout routes
  registerCheckoutRoutes(app, database);

  app.get("/admin", (req, res) => {
    if (!req.user || !req.user.is_admin) {
      return res.redirect(302, "/login.html");
    }
    res.redirect(302, "/admin-categories.html");
  });

  const allowedPages = new Set([
    "index.html",
    "product.html",
    "admin-categories.html",
    "admin-products.html",
    "category-laptops.html",
    "category-smartphones.html",
    "category-audio.html",
    "category-accessories.html",
    "login.html",
    "register.html",
    "change-password.html",
    "admin-orders.html",
    "my-orders.html",
  ]);

  const adminPages = new Set(["admin-categories.html", "admin-products.html", "admin-orders.html"]);

  app.get("/", (_req, res) => {
    res.sendFile(path.join(webRoot, "index.html"));
  });

  app.get("/:page", (req, res, next) => {
    const page = req.params.page;
    if (!allowedPages.has(page)) {
      next();
      return;
    }

    // Protect admin pages
    if (adminPages.has(page)) {
      if (!req.user) {
        return res.redirect(302, "/login.html");
      }
      if (!req.user.is_admin) {
        return res.redirect(302, "/");
      }
    }

    // Protect pages that require any logged-in user
    if ((page === "change-password.html" || page === "my-orders.html") && !req.user) {
      return res.redirect(302, "/login.html");
    }

    const filePath = path.join(webRoot, page);
    if (!fs.existsSync(filePath)) {
      res.status(404).type("text/plain").send("Not Found");
      return;
    }
    res.sendFile(filePath);
  });

  app.use((err, _req, res, next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Image must be <= 10MB" });
        return;
      }
      res.status(400).json({ error: `Upload error: ${err.code}` });
      return;
    }

    if (err && err.message === "UNSUPPORTED_IMAGE_FORMAT") {
      res.status(400).json({
        error: "Unsupported image format. Use JPEG, PNG, WEBP, or GIF.",
      });
      return;
    }

    next(err);
  });

  app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ error: "Route not found" });
      return;
    }
    res.status(404).type("text/plain").send("Not Found");
  });

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
