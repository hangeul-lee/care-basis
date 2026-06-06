import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { officialDocuments } from "../seedData.js";
import { enrichBaby, makeId, normalizeTags } from "../utils.js";
import { inferTrustGrade, isTrustedSourceUrl } from "../trustedSources.js";

const emptyData = {
  babies: [],
  routineEntries: [],
  routinePlanItems: [],
  infoDocuments: [],
  newsArticles: [],
  checklistStatuses: []
};

export class FileStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async init() {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      const current = JSON.parse(await readFile(this.filePath, "utf-8"));
      const seededByUrl = new Map(officialDocuments.map((document) => [document.sourceUrl, document]));
      const existingUrls = new Set(current.infoDocuments.map((document) => document.sourceUrl));
      const refreshedDocuments = current.infoDocuments.map((document) => {
        const seeded = seededByUrl.get(document.sourceUrl);
        if (!seeded) return document;

        return {
          ...document,
          tags: normalizeTags(seeded.tags),
          summary: seeded.summary,
          trustGrade: seeded.trustGrade,
          sourceInstitution: seeded.sourceInstitution,
          title: seeded.title,
          lastVerifiedAt: seeded.lastVerifiedAt,
          isTrusted: isTrustedSourceUrl(seeded.sourceUrl),
          updatedAt: new Date().toISOString()
        };
      });
      const missingDocuments = officialDocuments
        .filter((document) => !existingUrls.has(document.sourceUrl))
        .map((document) => ({
          id: makeId("doc"),
          ...document,
          tags: normalizeTags(document.tags),
          isTrusted: isTrustedSourceUrl(document.sourceUrl),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));

      if (missingDocuments.length > 0) {
        await this.write({
          ...current,
          infoDocuments: [...refreshedDocuments, ...missingDocuments]
        });
      } else {
        await this.write({
          ...current,
          infoDocuments: refreshedDocuments
        });
      }
    } catch {
      const seeded = {
        ...emptyData,
        infoDocuments: officialDocuments.map((document) => ({
          id: makeId("doc"),
          ...document,
          tags: normalizeTags(document.tags),
          isTrusted: isTrustedSourceUrl(document.sourceUrl),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }))
      };
      await this.write(seeded);
    }
  }

  async read() {
    const raw = await readFile(this.filePath, "utf-8");
    const data = JSON.parse(raw);
    return {
      ...emptyData,
      ...data,
      routinePlanItems: data.routinePlanItems || [],
      newsArticles: data.newsArticles || []
    };
  }

  async write(data) {
    await writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  }

  async listBabies() {
    const data = await this.read();
    return data.babies.map(enrichBaby);
  }

  async createBaby(input) {
    const data = await this.read();
    const baby = {
      id: makeId("baby"),
      name: String(input.name || "").trim(),
      birthDate: input.birthDate,
      sex: input.sex || "unspecified",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    data.babies.push(baby);
    await this.write(data);
    return enrichBaby(baby);
  }

  async updateBaby(id, input) {
    const data = await this.read();
    const index = data.babies.findIndex((baby) => baby.id === id);
    if (index === -1) return null;

    data.babies[index] = {
      ...data.babies[index],
      name: String(input.name || data.babies[index].name).trim(),
      birthDate: input.birthDate || data.babies[index].birthDate,
      sex: input.sex || data.babies[index].sex,
      updatedAt: new Date().toISOString()
    };

    await this.write(data);
    return enrichBaby(data.babies[index]);
  }

  async listRoutineEntries(babyId, date) {
    const data = await this.read();
    return data.routineEntries
      .filter((entry) => entry.babyId === babyId && entry.entryDate === date)
      .sort((a, b) => `${a.entryTime}`.localeCompare(`${b.entryTime}`));
  }

  async createRoutineEntry(input) {
    const data = await this.read();
    const entry = {
      id: makeId("routine"),
      babyId: input.babyId,
      entryDate: input.entryDate,
      entryTime: input.entryTime,
      category: input.category,
      amount: input.amount || "",
      note: input.note || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    data.routineEntries.push(entry);
    await this.write(data);
    return entry;
  }

  async updateRoutineEntry(id, input) {
    const data = await this.read();
    const index = data.routineEntries.findIndex((entry) => entry.id === id);
    if (index === -1) return null;

    data.routineEntries[index] = {
      ...data.routineEntries[index],
      entryTime: input.entryTime || data.routineEntries[index].entryTime,
      category: input.category || data.routineEntries[index].category,
      amount: input.amount ?? data.routineEntries[index].amount,
      note: input.note ?? data.routineEntries[index].note,
      updatedAt: new Date().toISOString()
    };

    await this.write(data);
    return data.routineEntries[index];
  }

  async deleteRoutineEntry(id) {
    const data = await this.read();
    const before = data.routineEntries.length;
    data.routineEntries = data.routineEntries.filter((entry) => entry.id !== id);
    await this.write(data);
    return data.routineEntries.length !== before;
  }

  async listRoutinePlanItems(babyId) {
    const data = await this.read();
    return data.routinePlanItems
      .filter((item) => item.babyId === babyId)
      .sort((a, b) => `${a.planTime}`.localeCompare(`${b.planTime}`));
  }

  async createRoutinePlanItem(input) {
    const data = await this.read();
    const item = {
      id: makeId("plan"),
      babyId: input.babyId,
      planTime: input.planTime,
      category: input.category,
      amount: input.amount || "",
      note: input.note || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    data.routinePlanItems.push(item);
    await this.write(data);
    return item;
  }

  async updateRoutinePlanItem(id, input) {
    const data = await this.read();
    const index = data.routinePlanItems.findIndex((item) => item.id === id);
    if (index === -1) return null;

    data.routinePlanItems[index] = {
      ...data.routinePlanItems[index],
      planTime: input.planTime || data.routinePlanItems[index].planTime,
      category: input.category || data.routinePlanItems[index].category,
      amount: input.amount ?? data.routinePlanItems[index].amount,
      note: input.note ?? data.routinePlanItems[index].note,
      updatedAt: new Date().toISOString()
    };

    await this.write(data);
    return data.routinePlanItems[index];
  }

  async deleteRoutinePlanItem(id) {
    const data = await this.read();
    const before = data.routinePlanItems.length;
    data.routinePlanItems = data.routinePlanItems.filter((item) => item.id !== id);
    await this.write(data);
    return data.routinePlanItems.length !== before;
  }

  async listDocuments() {
    const data = await this.read();
    return data.infoDocuments.sort((a, b) => a.title.localeCompare(b.title, "ko"));
  }

  async searchDocuments({ query = "", tag = "" }) {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedTag = tag.trim();
    const documents = await this.listDocuments();

    return documents.filter((document) => {
      if (!document.isTrusted) return false;

      const haystack = [
        document.title,
        document.summary,
        document.sourceInstitution,
        ...(document.tags || [])
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesTag = !normalizedTag || (document.tags || []).includes(normalizedTag);
      return matchesQuery && matchesTag;
    });
  }

  async createDocument(input) {
    const data = await this.read();
    const isTrusted = isTrustedSourceUrl(input.sourceUrl);
    const document = {
      id: makeId("doc"),
      title: String(input.title || "").trim(),
      summary: String(input.summary || "").trim(),
      sourceInstitution: String(input.sourceInstitution || "").trim(),
      sourceUrl: String(input.sourceUrl || "").trim(),
      lastVerifiedAt: input.lastVerifiedAt || new Date().toISOString().slice(0, 10),
      trustGrade: input.trustGrade || inferTrustGrade(input.sourceInstitution, input.sourceUrl),
      tags: normalizeTags(input.tags),
      isTrusted,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    data.infoDocuments.push(document);
    await this.write(data);
    return document;
  }

  async updateDocument(id, input) {
    const data = await this.read();
    const index = data.infoDocuments.findIndex((document) => document.id === id);
    if (index === -1) return null;

    const next = {
      ...data.infoDocuments[index],
      title: String(input.title || data.infoDocuments[index].title).trim(),
      summary: String(input.summary || data.infoDocuments[index].summary).trim(),
      sourceInstitution: String(input.sourceInstitution || data.infoDocuments[index].sourceInstitution).trim(),
      sourceUrl: String(input.sourceUrl || data.infoDocuments[index].sourceUrl).trim(),
      lastVerifiedAt: input.lastVerifiedAt || data.infoDocuments[index].lastVerifiedAt,
      trustGrade: input.trustGrade || data.infoDocuments[index].trustGrade,
      tags: normalizeTags(input.tags ?? data.infoDocuments[index].tags),
      updatedAt: new Date().toISOString()
    };
    next.isTrusted = isTrustedSourceUrl(next.sourceUrl);

    data.infoDocuments[index] = next;
    await this.write(data);
    return next;
  }

  async deleteDocument(id) {
    const data = await this.read();
    const before = data.infoDocuments.length;
    data.infoDocuments = data.infoDocuments.filter((document) => document.id !== id);
    await this.write(data);
    return data.infoDocuments.length !== before;
  }

  async archiveNewsArticles(items) {
    if (!items.length) return { savedCount: 0 };

    const data = await this.read();
    const indexByUrl = new Map(data.newsArticles.map((item, index) => [item.sourceUrl, index]));
    const now = new Date().toISOString();

    items.forEach((item) => {
      const article = {
        id: makeId("news"),
        title: String(item.title || "").trim(),
        summary: String(item.summary || "").trim(),
        sourceInstitution: String(item.sourceInstitution || "").trim(),
        sourceUrl: String(item.sourceUrl || "").trim(),
        publishedAt: item.publishedAt || "",
        category: item.category || "생활/돌봄",
        trustGrade: item.trustGrade || inferTrustGrade(item.sourceInstitution, item.sourceUrl),
        tags: normalizeTags(item.tags),
        archivedAt: now,
        updatedAt: now
      };

      const index = indexByUrl.get(article.sourceUrl);
      if (index === undefined) {
        data.newsArticles.push(article);
        indexByUrl.set(article.sourceUrl, data.newsArticles.length - 1);
      } else {
        data.newsArticles[index] = {
          ...data.newsArticles[index],
          ...article,
          id: data.newsArticles[index].id,
          archivedAt: data.newsArticles[index].archivedAt || now
        };
      }
    });

    await this.write(data);
    return { savedCount: items.length };
  }

  async listNewsArticles({ category = "", query = "" } = {}) {
    const data = await this.read();
    const normalizedCategory = category.trim();
    const normalizedQuery = query.trim().toLowerCase();

    return data.newsArticles
      .filter((item) => {
        const matchesCategory = !normalizedCategory || normalizedCategory === "전체" || item.category === normalizedCategory;
        const haystack = [
          item.title,
          item.summary,
          item.sourceInstitution,
          item.category,
          ...(item.tags || [])
        ]
          .join(" ")
          .toLowerCase();
        const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
        return matchesCategory && matchesQuery;
      })
      .sort((a, b) => {
        const publishedCompare = String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
        if (publishedCompare !== 0) return publishedCompare;
        return String(b.archivedAt || "").localeCompare(String(a.archivedAt || ""));
      })
      .slice(0, 500);
  }

  async getChecklistStatuses(babyId) {
    const data = await this.read();
    return data.checklistStatuses.filter((status) => status.babyId === babyId);
  }

  async setChecklistStatus(babyId, itemId, completed) {
    const data = await this.read();
    const index = data.checklistStatuses.findIndex(
      (status) => status.babyId === babyId && status.itemId === itemId
    );

    const status = {
      babyId,
      itemId,
      completed: Boolean(completed),
      updatedAt: new Date().toISOString()
    };

    if (index === -1) {
      data.checklistStatuses.push(status);
    } else {
      data.checklistStatuses[index] = status;
    }

    await this.write(data);
    return status;
  }
}
