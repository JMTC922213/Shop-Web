PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  catid INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  pid INTEGER PRIMARY KEY,
  catid INTEGER NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  description TEXT NOT NULL,
  image_large TEXT,
  image_thumb TEXT,
  FOREIGN KEY (catid) REFERENCES categories(catid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_catid ON products(catid);

CREATE TABLE IF NOT EXISTS users (
  userid INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  userid INTEGER NOT NULL,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (userid) REFERENCES users(userid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  orderid INTEGER PRIMARY KEY,
  userid INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  merchant_email TEXT NOT NULL,
  salt TEXT NOT NULL,
  digest TEXT NOT NULL,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userid) REFERENCES users(userid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  orderid INTEGER NOT NULL,
  pid INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  price_at_purchase REAL NOT NULL,
  FOREIGN KEY (orderid) REFERENCES orders(orderid) ON DELETE CASCADE,
  FOREIGN KEY (pid) REFERENCES products(pid)
);
