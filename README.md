# TechShop Demo

TechShop Demo is a small full-stack storefront prototype for browsing products, viewing product details, managing a client-side cart, and performing basic admin CRUD operations for categories and products.

The repo is configured for safe public sharing: the storefront is enabled by default, while the demo admin pages and write APIs are disabled unless you opt in locally.

## Stack

- Node.js
- Express
- SQLite
- Vanilla JavaScript
- HTML/CSS

## Features

- Storefront product listing with category filtering
- Product detail pages with related products
- Client-side shopping cart persisted in `localStorage`
- Admin pages for category and product management
- Image upload handling with resized product and thumbnail outputs
- SQLite schema and seed data for local setup

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Demo admin mode

The admin UI and write endpoints are intentionally disabled by default so the public project starts in a safer read-only mode.

To enable the demo admin locally:

```bash
npm run start:admin
```

Then open `http://localhost:3000/admin`.

## Project structure

```text
.
├── admin-categories.html
├── admin-products.html
├── css/
├── db/
├── images/
├── index.html
├── js/
├── product.html
├── server/
└── uploads/
```

## Notes

- Uploaded images are ignored from Git; only `.gitkeep` placeholders are tracked.
- The SQLite database file is generated locally and should stay untracked.
- The admin interface is intentionally unauthenticated and exists only for local demo purposes.
- This project does not include checkout, payments, or production authentication.
