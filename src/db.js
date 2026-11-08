// src/db.js — SQLite storage (node:sqlite, built-in, no native builds).
// Money is stored as integer poisha (BDT * 100) to avoid float errors.
// DB path comes from DB_PATH env (default ./data/app.db). No secrets here.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');
const resolved = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
fs.mkdirSync(path.dirname(resolved), { recursive: true });

const db = new DatabaseSync(resolved);

// Enable foreign keys and WAL for safer concurrent reads/writes.
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS merchants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  package TEXT NOT NULL DEFAULT 'basic',
  webhook_url TEXT,
  success_url TEXT,
  fail_url TEXT,
  webhook_secret TEXT NOT NULL,
  pay_key TEXT UNIQUE NOT NULL,
  websites TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  key TEXT UNIQUE NOT NULL,
  label TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  key TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS numbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  method TEXT NOT NULL CHECK (method IN ('bkash', 'nagad', 'rocket', 'upay')),
  number TEXT NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sms_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  trxid TEXT UNIQUE NOT NULL,
  method TEXT NOT NULL,
  sender TEXT,
  amount_poisha INTEGER NOT NULL,
  received_at TEXT,
  raw_text TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'used')),
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  order_id TEXT,
  amount_poisha INTEGER NOT NULL,
  transaction_id TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  event TEXT NOT NULL,
  payload TEXT,
  url TEXT,
  status_code INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sms_unparsed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id INTEGER,
  sender TEXT,
  raw_text TEXT,
  reason TEXT,
  created_at TEXT NOT NULL
);
`);

function nowIso() {
  return new Date().toISOString();
}

/** Start of the current calendar month, as an ISO prefix "YYYY-MM". */
function currentMonthPrefix() {
  return new Date().toISOString().slice(0, 7);
}

module.exports = { db, dbPath: resolved, nowIso, currentMonthPrefix };
