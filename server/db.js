const fs = require("node:fs");
const path = require("node:path");
const sqlite3 = require("sqlite3");

const DB_PATH = path.join(__dirname, "..", "db", "techshop.sqlite");
const SCHEMA_PATH = path.join(__dirname, "..", "db", "schema.sql");
const SEED_PATH = path.join(__dirname, "..", "db", "seed.sql");

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

async function initializeDatabase(db) {
  const schemaSql = fs.readFileSync(SCHEMA_PATH, "utf8");
  await new Promise((resolve, reject) => {
    db.exec(schemaSql, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

  const countRow = await get(db, "SELECT COUNT(*) AS count FROM categories");
  if (countRow.count === 0) {
    const seedSql = fs.readFileSync(SEED_PATH, "utf8");
    await new Promise((resolve, reject) => {
      db.exec(seedSql, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
}

async function createDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = await new Promise((resolve, reject) => {
    const instance = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(instance);
    });
  });

  await run(db, "PRAGMA foreign_keys = ON");
  await initializeDatabase(db);

  return {
    db,
    run: (sql, params) => run(db, sql, params),
    get: (sql, params) => get(db, sql, params),
    all: (sql, params) => all(db, sql, params),
    close: () =>
      new Promise((resolve, reject) => {
        db.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      }),
  };
}

module.exports = {
  DB_PATH,
  createDb,
};
