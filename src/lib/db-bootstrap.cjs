/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function initDatabase() {
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, {
    recursive: true,
  });

  const db = new Database(path.join(dataDir, "refine-goals.db"));

  db.exec(`
    CREATE TABLE IF NOT EXISTS goal_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      rawIntent TEXT NOT NULL DEFAULT '',
      domain TEXT NOT NULL DEFAULT 'unknown',
      targetUsers TEXT NOT NULL DEFAULT '',
      constraints TEXT NOT NULL DEFAULT '[]',
      referencesJson TEXT NOT NULL DEFAULT '[]',
      mustHaveFeatures TEXT NOT NULL DEFAULT '[]',
      niceToHaveFeatures TEXT NOT NULL DEFAULT '[]',
      risks TEXT NOT NULL DEFAULT '[]',
      unknowns TEXT NOT NULL DEFAULT '[]',
      decisions TEXT NOT NULL DEFAULT '[]',
      outputType TEXT NOT NULL DEFAULT 'dashboard',
      completenessScore INTEGER NOT NULL DEFAULT 10,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES goal_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session_created
      ON messages(sessionId, createdAt);

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      fileName TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      path TEXT NOT NULL,
      purpose TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES goal_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_session_created
      ON attachments(sessionId, createdAt);

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES goal_sessions(id) ON DELETE CASCADE,
      UNIQUE(sessionId, kind)
    );
  `);

  db.close();
}

module.exports = {
  initDatabase,
};
