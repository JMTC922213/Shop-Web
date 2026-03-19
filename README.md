# Shop-Web

Shop-Web is a portfolio storefront project built with Node.js, Express, SQLite, and vanilla JavaScript. It includes product browsing, category filtering, product detail pages, a client-side cart, image upload handling, and a local admin workflow for managing catalog data.

The repo is configured for safe public sharing: the storefront is enabled by default, while the local admin pages and write APIs are disabled unless you opt in during development.

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
- Local admin pages for category and product management
- Image upload handling with resized product and thumbnail outputs
- SQLite schema and seed data for local setup

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Local admin mode

The admin UI and write endpoints are intentionally disabled by default so the public project starts in a safer read-only mode.

To enable the local admin workflow:

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
- The admin interface is intentionally unauthenticated and exists only for local development and portfolio review.
- This project does not include checkout, payments, or production authentication.
