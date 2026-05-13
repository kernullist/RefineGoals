import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import Database from "better-sqlite3";
import { initDatabase } from "@/lib/db-bootstrap.cjs";

export type DbSession = {
  id: string;
  title: string;
  rawIntent: string;
  domain: string;
  targetUsers: string;
  constraints: string;
  references: string;
  mustHaveFeatures: string;
  niceToHaveFeatures: string;
  risks: string;
  unknowns: string;
  decisions: string;
  outputType: string;
  completenessScore: number;
  createdAt: string;
  updatedAt: string;
};

export type DbMessage = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  metadata: string;
  createdAt: string;
};

export type DbAttachment = {
  id: string;
  sessionId: string;
  fileName: string;
  mimeType: string;
  path: string;
  purpose: string;
  createdAt: string;
};

export type DbDocument = {
  id: string;
  sessionId: string;
  kind: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type FullSession = DbSession & {
  messages: DbMessage[];
  attachments: DbAttachment[];
  documents: DbDocument[];
};

type SessionCreate = Partial<DbSession> & {
  title: string;
};

type SessionUpdate = Partial<Omit<DbSession, "id" | "createdAt" | "updatedAt">>;

const dbPath = path.join(process.cwd(), "data", "refine-goals.db");

let database: Database.Database | null = null;

function now() {
  return new Date().toISOString();
}

function getDb() {
  if (!database) {
    fs.mkdirSync(path.dirname(dbPath), {
      recursive: true,
    });
    initDatabase();
    database = new Database(dbPath);
    database.pragma("foreign_keys = ON");
  }

  return database;
}

function mapSession(row: Record<string, unknown>): DbSession {
  return {
    id: String(row.id),
    title: String(row.title),
    rawIntent: String(row.rawIntent),
    domain: String(row.domain),
    targetUsers: String(row.targetUsers),
    constraints: String(row.constraints),
    references: String(row.referencesJson),
    mustHaveFeatures: String(row.mustHaveFeatures),
    niceToHaveFeatures: String(row.niceToHaveFeatures),
    risks: String(row.risks),
    unknowns: String(row.unknowns),
    decisions: String(row.decisions),
    outputType: String(row.outputType),
    completenessScore: Number(row.completenessScore),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export const db = {
  listSessions(): FullSession[] {
    const rows = getDb()
      .prepare("SELECT * FROM goal_sessions ORDER BY updatedAt DESC")
      .all() as Record<string, unknown>[];

    return rows.map((row) => this.getFullSession(String(row.id))).filter(Boolean);
  },

  getSession(id: string): DbSession | null {
    const row = getDb()
      .prepare("SELECT * FROM goal_sessions WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;

    return row ? mapSession(row) : null;
  },

  getFullSession(id: string): FullSession {
    const session = this.getSession(id);
    if (!session) {
      throw new Error("Session not found.");
    }

    const messages = getDb()
      .prepare("SELECT * FROM messages WHERE sessionId = ? ORDER BY createdAt ASC")
      .all(id) as DbMessage[];
    const attachments = getDb()
      .prepare(
        "SELECT * FROM attachments WHERE sessionId = ? ORDER BY createdAt DESC",
      )
      .all(id) as DbAttachment[];
    const documents = getDb()
      .prepare("SELECT * FROM documents WHERE sessionId = ? ORDER BY updatedAt DESC")
      .all(id) as DbDocument[];

    return {
      ...session,
      messages,
      attachments,
      documents,
    };
  },

  createSession(input: SessionCreate): DbSession {
    const id = randomUUID();
    const timestamp = now();
    const data = {
      rawIntent: "",
      domain: "unknown",
      targetUsers: "",
      constraints: "[]",
      references: "[]",
      mustHaveFeatures: "[]",
      niceToHaveFeatures: "[]",
      risks: "[]",
      unknowns: "[]",
      decisions: "[]",
      outputType: "dashboard",
      completenessScore: 10,
      ...input,
    };

    getDb()
      .prepare(
        `INSERT INTO goal_sessions (
          id, title, rawIntent, domain, targetUsers, constraints, referencesJson,
          mustHaveFeatures, niceToHaveFeatures, risks, unknowns, decisions,
          outputType, completenessScore, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        data.title,
        data.rawIntent,
        data.domain,
        data.targetUsers,
        data.constraints,
        data.references,
        data.mustHaveFeatures,
        data.niceToHaveFeatures,
        data.risks,
        data.unknowns,
        data.decisions,
        data.outputType,
        data.completenessScore,
        timestamp,
        timestamp,
      );

    return this.getSession(id) as DbSession;
  },

  updateSession(id: string, input: SessionUpdate): DbSession {
    const current = this.getSession(id);
    if (!current) {
      throw new Error("Session not found.");
    }

    const next = {
      ...current,
      ...input,
      updatedAt: now(),
    };

    getDb()
      .prepare(
        `UPDATE goal_sessions SET
          title = ?,
          rawIntent = ?,
          domain = ?,
          targetUsers = ?,
          constraints = ?,
          referencesJson = ?,
          mustHaveFeatures = ?,
          niceToHaveFeatures = ?,
          risks = ?,
          unknowns = ?,
          decisions = ?,
          outputType = ?,
          completenessScore = ?,
          updatedAt = ?
        WHERE id = ?`,
      )
      .run(
        next.title,
        next.rawIntent,
        next.domain,
        next.targetUsers,
        next.constraints,
        next.references,
        next.mustHaveFeatures,
        next.niceToHaveFeatures,
        next.risks,
        next.unknowns,
        next.decisions,
        next.outputType,
        next.completenessScore,
        next.updatedAt,
        id,
      );

    return this.getSession(id) as DbSession;
  },

  createMessage(input: {
    sessionId: string;
    role: string;
    content: string;
    metadata?: string;
  }): DbMessage {
    const id = randomUUID();
    const timestamp = now();

    getDb()
      .prepare(
        `INSERT INTO messages (id, sessionId, role, content, metadata, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.sessionId,
        input.role,
        input.content,
        input.metadata || "{}",
        timestamp,
      );

    return getDb()
      .prepare("SELECT * FROM messages WHERE id = ?")
      .get(id) as DbMessage;
  },

  listAttachments(sessionId: string): DbAttachment[] {
    return getDb()
      .prepare("SELECT * FROM attachments WHERE sessionId = ? ORDER BY createdAt DESC")
      .all(sessionId) as DbAttachment[];
  },

  createAttachment(input: {
    sessionId: string;
    fileName: string;
    mimeType: string;
    path: string;
    purpose: string;
  }): DbAttachment {
    const id = randomUUID();
    const timestamp = now();

    getDb()
      .prepare(
        `INSERT INTO attachments (id, sessionId, fileName, mimeType, path, purpose, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.sessionId,
        input.fileName,
        input.mimeType,
        input.path,
        input.purpose,
        timestamp,
      );

    return getDb()
      .prepare("SELECT * FROM attachments WHERE id = ?")
      .get(id) as DbAttachment;
  },

  upsertDocument(input: {
    sessionId: string;
    kind: string;
    title: string;
    content: string;
  }): void {
    const timestamp = now();

    getDb()
      .prepare(
        `INSERT INTO documents (id, sessionId, kind, title, content, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(sessionId, kind) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          updatedAt = excluded.updatedAt`,
      )
      .run(
        randomUUID(),
        input.sessionId,
        input.kind,
        input.title,
        input.content,
        timestamp,
        timestamp,
      );
  },
};
