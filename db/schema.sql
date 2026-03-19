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
