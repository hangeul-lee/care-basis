import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { officialDocuments } from "../seedData.js";
import { enrichBaby, normalizeTags, toCamelRow } from "../utils.js";
import { inferTrustGrade, isTrustedSourceUrl } from "../trustedSources.js";

function parseTags(value) {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value || "[]");
  } catch {
    return normalizeTags(value);
  }
}

function normalizeDocument(row) {
  const document = toCamelRow(row);
  return {
    ...document,
    tags: parseTags(document.tags),
    isTrusted: Boolean(document.isTrusted)
  };
}

function sslOptions(config) {
  if (!config.ssl) return undefined;

  const ca = config.sslCaBase64
    ? Buffer.from(config.sslCaBase64, "base64").toString("utf-8")
    : config.sslCa;

  return {
    rejectUnauthorized: config.sslRejectUnauthorized,
    ...(ca ? { ca } : {})
  };
}

function schemaStatements(schemaSql) {
  return schemaSql
    .replace(/CREATE\s+DATABASE[\s\S]*?;\s*/i, "")
    .replace(/USE\s+[`"']?[\w-]+[`"']?\s*;\s*/i, "")
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export class MySqlStore {
  constructor(config) {
    this.config = config;
    this.pool = null;
  }

  async init() {
    const mysql = await import("mysql2/promise");
    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      dateStrings: true,
      ssl: sslOptions(this.config),
      waitForConnections: true,
      connectionLimit: 8,
      namedPlaceholders: true
    });

    if (this.config.autoMigrate) {
      await this.migrate();
    }
    await this.seedOfficialDocuments();
  }

  async query(sql, params = {}) {
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }

  async migrate() {
    const schemaSql = await readFile(resolve(process.cwd(), "database", "schema.sql"), "utf-8");
    const connection = await this.pool.getConnection();
    try {
      for (const statement of schemaStatements(schemaSql)) {
        await connection.query(statement);
      }
    } finally {
      connection.release();
    }
  }

  async seedOfficialDocuments() {
    const rows = await this.query("SELECT source_url FROM info_documents");
    const existingUrls = new Set(rows.map((row) => row.source_url));

    for (const document of officialDocuments) {
      if (!existingUrls.has(document.sourceUrl)) {
        await this.createDocument(document);
      } else {
        await this.updateDocumentBySourceUrl(document.sourceUrl, document);
      }
    }
  }

  async updateDocumentBySourceUrl(sourceUrl, input) {
    await this.query(
      `UPDATE info_documents
       SET title = :title, summary = :summary, source_institution = :sourceInstitution,
           last_verified_at = :lastVerifiedAt, trust_grade = :trustGrade,
           tags = :tags, is_trusted = :isTrusted, updated_at = CURRENT_TIMESTAMP
       WHERE source_url = :sourceUrl`,
      {
        title: String(input.title || "").trim(),
        summary: String(input.summary || "").trim(),
        sourceInstitution: String(input.sourceInstitution || "").trim(),
        sourceUrl,
        lastVerifiedAt: input.lastVerifiedAt,
        trustGrade: input.trustGrade,
        tags: JSON.stringify(normalizeTags(input.tags)),
        isTrusted: isTrustedSourceUrl(sourceUrl)
      }
    );
  }

  async listBabies() {
    const rows = await this.query("SELECT * FROM babies ORDER BY created_at ASC");
    return rows.map(toCamelRow).map(enrichBaby);
  }

  async createBaby(input) {
    const rows = await this.query(
      `INSERT INTO babies (name, birth_date, sex)
       VALUES (:name, :birthDate, :sex)`,
      {
        name: String(input.name || "").trim(),
        birthDate: input.birthDate,
        sex: input.sex || "unspecified"
      }
    );

    const [baby] = await this.query("SELECT * FROM babies WHERE id = :id", { id: rows.insertId });
    return enrichBaby(toCamelRow(baby));
  }

  async updateBaby(id, input) {
    await this.query(
      `UPDATE babies
       SET name = :name, birth_date = :birthDate, sex = :sex, updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      {
        id,
        name: String(input.name || "").trim(),
        birthDate: input.birthDate,
        sex: input.sex || "unspecified"
      }
    );

    const [baby] = await this.query("SELECT * FROM babies WHERE id = :id", { id });
    return baby ? enrichBaby(toCamelRow(baby)) : null;
  }

  async listRoutineEntries(babyId, date) {
    const rows = await this.query(
      `SELECT * FROM routine_entries
       WHERE baby_id = :babyId AND entry_date = :date
       ORDER BY entry_time ASC, created_at ASC`,
      { babyId, date }
    );
    return rows.map(toCamelRow);
  }

  async createRoutineEntry(input) {
    const result = await this.query(
      `INSERT INTO routine_entries
       (baby_id, entry_date, entry_time, category, amount, note)
       VALUES (:babyId, :entryDate, :entryTime, :category, :amount, :note)`,
      {
        babyId: input.babyId,
        entryDate: input.entryDate,
        entryTime: input.entryTime,
        category: input.category,
        amount: input.amount || "",
        note: input.note || ""
      }
    );

    const [entry] = await this.query("SELECT * FROM routine_entries WHERE id = :id", {
      id: result.insertId
    });
    return toCamelRow(entry);
  }

  async updateRoutineEntry(id, input) {
    await this.query(
      `UPDATE routine_entries
       SET entry_time = :entryTime, category = :category, amount = :amount,
           note = :note, updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      {
        id,
        entryTime: input.entryTime,
        category: input.category,
        amount: input.amount || "",
        note: input.note || ""
      }
    );

    const [entry] = await this.query("SELECT * FROM routine_entries WHERE id = :id", { id });
    return entry ? toCamelRow(entry) : null;
  }

  async deleteRoutineEntry(id) {
    const result = await this.query("DELETE FROM routine_entries WHERE id = :id", { id });
    return result.affectedRows > 0;
  }

  async listDocuments() {
    const rows = await this.query("SELECT * FROM info_documents ORDER BY title ASC");
    return rows.map(normalizeDocument);
  }

  async searchDocuments({ query = "", tag = "" }) {
    const q = `%${query.trim()}%`;
    const rows = await this.query(
      `SELECT * FROM info_documents
       WHERE is_trusted = 1
         AND (:query = '' OR title LIKE :q OR summary LIKE :q OR source_institution LIKE :q OR tags LIKE :q)
         AND (:tag = '' OR JSON_CONTAINS(tags, JSON_QUOTE(:tag)))
       ORDER BY trust_grade ASC, updated_at DESC`,
      { query: query.trim(), q, tag: tag.trim() }
    );
    return rows.map(normalizeDocument);
  }

  async createDocument(input) {
    const isTrusted = isTrustedSourceUrl(input.sourceUrl);
    const trustGrade = input.trustGrade || inferTrustGrade(input.sourceInstitution, input.sourceUrl);
    const result = await this.query(
      `INSERT INTO info_documents
       (title, summary, source_institution, source_url, last_verified_at, trust_grade, tags, is_trusted)
       VALUES (:title, :summary, :sourceInstitution, :sourceUrl, :lastVerifiedAt, :trustGrade, :tags, :isTrusted)`,
      {
        title: String(input.title || "").trim(),
        summary: String(input.summary || "").trim(),
        sourceInstitution: String(input.sourceInstitution || "").trim(),
        sourceUrl: String(input.sourceUrl || "").trim(),
        lastVerifiedAt: input.lastVerifiedAt || new Date().toISOString().slice(0, 10),
        trustGrade,
        tags: JSON.stringify(normalizeTags(input.tags)),
        isTrusted
      }
    );

    const [document] = await this.query("SELECT * FROM info_documents WHERE id = :id", {
      id: result.insertId
    });
    return normalizeDocument(document);
  }

  async updateDocument(id, input) {
    const isTrusted = isTrustedSourceUrl(input.sourceUrl);
    await this.query(
      `UPDATE info_documents
       SET title = :title, summary = :summary, source_institution = :sourceInstitution,
           source_url = :sourceUrl, last_verified_at = :lastVerifiedAt,
           trust_grade = :trustGrade, tags = :tags, is_trusted = :isTrusted,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      {
        id,
        title: String(input.title || "").trim(),
        summary: String(input.summary || "").trim(),
        sourceInstitution: String(input.sourceInstitution || "").trim(),
        sourceUrl: String(input.sourceUrl || "").trim(),
        lastVerifiedAt: input.lastVerifiedAt,
        trustGrade: input.trustGrade,
        tags: JSON.stringify(normalizeTags(input.tags)),
        isTrusted
      }
    );

    const [document] = await this.query("SELECT * FROM info_documents WHERE id = :id", { id });
    return document ? normalizeDocument(document) : null;
  }

  async deleteDocument(id) {
    const result = await this.query("DELETE FROM info_documents WHERE id = :id", { id });
    return result.affectedRows > 0;
  }

  async getChecklistStatuses(babyId) {
    const rows = await this.query("SELECT * FROM checklist_statuses WHERE baby_id = :babyId", {
      babyId
    });
    return rows.map(toCamelRow).map((status) => ({
      ...status,
      completed: Boolean(status.completed)
    }));
  }

  async setChecklistStatus(babyId, itemId, completed) {
    await this.query(
      `INSERT INTO checklist_statuses (baby_id, item_id, completed)
       VALUES (:babyId, :itemId, :completed)
       ON DUPLICATE KEY UPDATE completed = VALUES(completed), updated_at = CURRENT_TIMESTAMP`,
      { babyId, itemId, completed: Boolean(completed) }
    );

    const [status] = await this.query(
      "SELECT * FROM checklist_statuses WHERE baby_id = :babyId AND item_id = :itemId",
      { babyId, itemId }
    );
    return toCamelRow(status);
  }
}
