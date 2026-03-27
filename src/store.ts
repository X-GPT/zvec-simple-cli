import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE_DIR = ".zdoc-data";
const DB_PATH = join(BASE_DIR, "store.db");

let _db: Database | null = null;

function getDb(): Database {
  if (_db) return _db;

  if (!existsSync(BASE_DIR)) {
    mkdirSync(BASE_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.run("PRAGMA journal_mode = WAL");
  _db.run("PRAGMA foreign_keys = ON");

  _db.run(`
    CREATE TABLE IF NOT EXISTS partitions (
      name TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      added_at TEXT NOT NULL
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS files (
      source TEXT PRIMARY KEY,
      partition TEXT NOT NULL,
      added_at TEXT NOT NULL,
      mtime REAL NOT NULL,
      FOREIGN KEY (partition) REFERENCES partitions(name)
    )
  `);

  _db.run("CREATE INDEX IF NOT EXISTS idx_files_partition ON files(partition)");

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// --- Partitions ---

export function registerPartition(name: string, path: string): void {
  const db = getDb();
  db.run(
    "INSERT OR REPLACE INTO partitions (name, path, added_at) VALUES (?, ?, ?)",
    [name, path, new Date().toISOString()]
  );
}

export function removePartition(name: string): number {
  const db = getDb();
  const files = db
    .query("SELECT COUNT(*) as count FROM files WHERE partition = ?")
    .get(name) as { count: number } | null;
  const fileCount = files?.count ?? 0;

  db.run("DELETE FROM files WHERE partition = ?", [name]);
  db.run("DELETE FROM partitions WHERE name = ?", [name]);

  return fileCount;
}

export interface PartitionInfo {
  name: string;
  path: string;
  addedAt: string;
  fileCount: number;
}

export function listPartitions(): PartitionInfo[] {
  const db = getDb();
  return db
    .query(`
      SELECT p.name, p.path, p.added_at as addedAt,
             COUNT(f.source) as fileCount
      FROM partitions p
      LEFT JOIN files f ON f.partition = p.name
      GROUP BY p.name
      ORDER BY p.name
    `)
    .all() as PartitionInfo[];
}

export function getPartition(name: string): { name: string; path: string; addedAt: string } | null {
  const db = getDb();
  return db
    .query("SELECT name, path, added_at as addedAt FROM partitions WHERE name = ?")
    .get(name) as { name: string; path: string; addedAt: string } | null;
}

// --- Files ---

export function addFile(source: string, partition: string, mtime: number): void {
  const db = getDb();
  db.run(
    "INSERT OR REPLACE INTO files (source, partition, added_at, mtime) VALUES (?, ?, ?, ?)",
    [source, partition, new Date().toISOString(), mtime]
  );
}

export function removeFile(source: string): void {
  const db = getDb();
  db.run("DELETE FROM files WHERE source = ?", [source]);
}

export function removeFilesForPartition(name: string): void {
  const db = getDb();
  db.run("DELETE FROM files WHERE partition = ?", [name]);
}

export interface FileInfo {
  source: string;
  partition: string;
  addedAt: string;
  mtime: number;
}

export function getFilesForPartition(name: string): FileInfo[] {
  const db = getDb();
  return db
    .query("SELECT source, partition, added_at as addedAt, mtime FROM files WHERE partition = ?")
    .all(name) as FileInfo[];
}

export function getAllFiles(): FileInfo[] {
  const db = getDb();
  return db
    .query("SELECT source, partition, added_at as addedAt, mtime FROM files")
    .all() as FileInfo[];
}

export function getFileMtime(source: string): number | null {
  const db = getDb();
  const row = db
    .query("SELECT mtime FROM files WHERE source = ?")
    .get(source) as { mtime: number } | null;
  return row?.mtime ?? null;
}

export function getStats(): { partitions: number; files: number } {
  const db = getDb();
  const p = db.query("SELECT COUNT(*) as count FROM partitions").get() as { count: number };
  const f = db.query("SELECT COUNT(*) as count FROM files").get() as { count: number };
  return { partitions: p.count, files: f.count };
}
