# TechShop - Full-Stack E-Commerce Web Application

A fully functional e-commerce platform for electronics, built from scratch with a Node.js/Express backend, SQLite database, and vanilla HTML/CSS/JavaScript frontend. Features user authentication, Stripe payment integration, an admin dashboard, and a responsive storefront.

## Live Features

### Storefront
- **Product Catalog** — Browse products by category (Laptops, Smartphones, Audio, Accessories) with thumbnail previews
- **Product Detail Pages** — Individual pages with full-size images and descriptions
- **Shopping Cart** — Client-side cart with add/remove/quantity controls and live total calculation
- **Stripe Checkout** — Secure payment flow via Stripe Checkout Sessions with webhook verification

### User Accounts
- **Registration & Login** — Email/password authentication with bcrypt hashing
- **Session Management** — Secure HTTP-only cookie sessions with automatic expiry
- **Password Change** — Authenticated users can update their password (invalidates all sessions)
- **Order History** — Users can view their past orders and item details

### Admin Dashboard
- **Product Management** — Full CRUD for products with image upload, auto-resizing (Sharp), and thumbnail generation
- **Category Management** — Create, rename, and delete categories (cascading product cleanup)
- **Order Management** — View all orders across users with status tracking
- **Role-Based Access** — Admin pages and API routes are protected by middleware

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express 5 |
| **Database** | SQLite 3 with foreign keys and indexes |
| **Auth** | bcryptjs, secure cookie sessions |
| **Payments** | Stripe Checkout + Webhooks |
| **Image Processing** | Sharp (resize, thumbnail generation, JPEG optimization) |
| **File Upload** | Multer with in-memory storage and MIME type filtering |
| **Validation** | express-validator (input sanitization on all endpoints) |
| **Frontend** | Vanilla HTML, CSS, JavaScript (no frameworks) |

## Security Implementations

- **CSRF Protection** — Per-session CSRF tokens validated on all state-changing requests with timing-safe comparison
- **Content Security Policy** — Strict CSP headers limiting script, style, image, and frame sources
- **Input Sanitization** — Server-side HTML tag stripping and length validation on all user inputs
- **Password Security** — bcrypt hashing (cost factor 10), minimum length enforcement
- **Session Security** — HTTP-only + Secure + SameSite=Strict cookies, session rotation on login to prevent fixation
- **Webhook Integrity** — Stripe signature verification + SHA-256 order digest with timing-safe comparison for duplicate/tamper prevention
- **File Upload Safety** — MIME type allowlisting, 10 MB size limit, server-side image re-encoding
- **Access Control** — Role-based middleware protecting admin routes and pages

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/me` | Get current user and CSRF token |
| POST | `/api/auth/register` | Create a new account |
| POST | `/api/auth/login` | Log in and receive session cookie |
| POST | `/api/auth/logout` | Destroy session |
| POST | `/api/auth/change-password` | Update password (requires auth) |

### Products & Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List all categories |
| POST | `/api/categories` | Create category (admin) |
| PUT | `/api/categories/:catid` | Rename category (admin) |
| DELETE | `/api/categories/:catid` | Delete category + products (admin) |
| GET | `/api/products` | List products (optional `?catid=` filter) |
| GET | `/api/products/:pid` | Get single product |
| POST | `/api/products` | Create product with image (admin) |
| PUT | `/api/products/:pid` | Update product (admin) |
| DELETE | `/api/products/:pid` | Delete product + images (admin) |

### Orders & Checkout
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/checkout/create-order` | Create order + Stripe session (requires auth) |
| GET | `/api/orders/my` | Get current user's recent orders |
| GET | `/api/admin/orders` | Get all orders (admin) |
| POST | `/api/webhook/stripe` | Stripe webhook for payment confirmation |

## Database Schema

```
categories (catid, name)
    └── products (pid, catid, name, price, description, image_large, image_thumb)

users (userid, email, name, password, is_admin)
    ├── sessions (token, userid, csrf_token, expires_at)
    └── orders (orderid, userid, currency, merchant_email, salt, digest, total, status, ...)
            └── order_items (id, orderid, pid, quantity, price_at_purchase)
```

Foreign keys with `ON DELETE CASCADE` ensure referential integrity throughout.

## Getting Started

### Prerequisites
- Node.js 18+
- A Stripe account (for payment features)

### Installation

```bash
git clone https://github.com/JMTC922213/Shop-Web.git
cd Shop-Web
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```
PORT=3000
BASE_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
MERCHANT_EMAIL=admin@techshop.com
```

### Run

```bash
npm start
```

The server starts at `http://localhost:3000`. The SQLite database is created automatically on first run.

## Project Structure

```
├── server/
│   ├── index.js          # Express app, product/category CRUD, static file serving
│   ├── auth.js           # Authentication routes and session middleware
│   ├── checkout.js        # Stripe checkout and webhook handling
│   ├── csrf.js           # CSRF token validation middleware
│   └── db.js             # SQLite connection and schema initialization
├── js/
│   ├── auth-common.js    # Shared auth utilities (session check, CSRF headers)
│   ├── cart.js           # Shopping cart logic
│   ├── checkout.js       # Client-side checkout flow
│   ├── login.js          # Login form handling
│   ├── register.js       # Registration form handling
│   ├── change-password.js
│   ├── my-orders.js      # Order history display
│   ├── admin-categories.js
│   ├── admin-products.js
│   └── admin-orders.js
├── css/style.css         # All styles (responsive layout)
├── db/schema.sql         # Database schema definition
├── images/               # Static product images
└── uploads/              # User-uploaded product images (gitignored)
```
