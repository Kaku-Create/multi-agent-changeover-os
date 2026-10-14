import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { dbPath, config } from '../config.js';
import { logger } from '../lib/logger.js';

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  logger.info('sqlite ready', { dbPath, env: config.env });
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('sqlite closed');
  }
}

function migrate(d: DatabaseSync): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      code TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS materials (
      sku TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS toolings (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operators (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      sequence INTEGER NOT NULL,
      day INTEGER NOT NULL,
      line TEXT NOT NULL,
      scenario TEXT NOT NULL,
      from_product TEXT NOT NULL,
      to_product TEXT NOT NULL,
      baseline_minutes REAL NOT NULL,
      actual_minutes REAL NOT NULL,
      saved_ratio REAL NOT NULL,
      success INTEGER NOT NULL,
      quality_passed INTEGER NOT NULL,
      json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learning (
      sequence INTEGER PRIMARY KEY,
      json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      filename TEXT,
      mode TEXT NOT NULL,
      total INTEGER NOT NULL,
      imported INTEGER NOT NULL,
      failed INTEGER NOT NULL,
      errors_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      request_id TEXT,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status INTEGER NOT NULL,
      duration_ms REAL NOT NULL,
      ip TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_events_sequence ON events(sequence);
    CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
    CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);

    CREATE TABLE IF NOT EXISTS workorders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      from_product TEXT NOT NULL,
      to_product TEXT NOT NULL,
      scenario TEXT NOT NULL,
      line TEXT,
      day INTEGER,
      planned_start_minute INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workorders_batch ON workorders(batch_id);
    CREATE INDEX IF NOT EXISTS idx_workorders_created ON workorders(created_at);
  `);

  const row = d.prepare('SELECT version FROM schema_version LIMIT 1').get() as
    | { version: number }
    | undefined;
  if (!row) {
    d.prepare('INSERT INTO schema_version (version) VALUES (?)').run(1);
  }
}
