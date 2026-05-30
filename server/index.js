import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { assertAuthenticated, authStatus, isAuthEnabled, loginWithPin, logout } from "./auth.js";
import { fetchParentingNews } from "./news.js";
import { checklistTemplates, newsSources, officialDocuments, sourceRegistry } from "./seedData.js";
import { createStore } from "./store/index.js";
import { isTrustedSourceUrl } from "./trustedSources.js";

const port = Number(process.env.PORT || 4173);
const publicDir = resolve(process.cwd(), "public");
const store = await createStore();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function sendJson(response, status, data) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(data));
}

async function parseJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    const error = new Error("잘못된 JSON 요청입니다.");
    error.statusCode = 400;
    throw error;
  }
}

function requireFields(input, fields) {
  const missing = fields.filter((field) => !String(input[field] || "").trim());
  if (missing.length > 0) {
    const error = new Error(`필수 입력값이 비어 있습니다: ${missing.join(", ")}`);
    error.statusCode = 422;
    throw error;
  }
}

function validateBaby(input) {
  requireFields(input, ["name", "birthDate"]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) {
    const error = new Error("생년월일은 YYYY-MM-DD 형식이어야 합니다.");
    error.statusCode = 422;
    throw error;
  }
}

function validateRoutine(input) {
  requireFields(input, ["babyId", "entryDate", "entryTime", "category"]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.entryDate)) {
    const error = new Error("기록 날짜는 YYYY-MM-DD 형식이어야 합니다.");
    error.statusCode = 422;
    throw error;
  }
  if (!/^\d{2}:\d{2}$/.test(input.entryTime)) {
    const error = new Error("기록 시간은 HH:MM 형식이어야 합니다.");
    error.statusCode = 422;
    throw error;
  }
}

function validateRoutinePlan(input) {
  requireFields(input, ["babyId", "planTime", "category"]);
  if (!/^\d{2}:\d{2}$/.test(input.planTime)) {
    const error = new Error("일과표 시간은 HH:MM 형식이어야 합니다.");
    error.statusCode = 422;
    throw error;
  }
}

function validateDocument(input) {
  requireFields(input, ["title", "summary", "sourceInstitution", "sourceUrl", "lastVerifiedAt", "trustGrade"]);
  if (!isTrustedSourceUrl(input.sourceUrl)) {
    const error = new Error("공공기관·전문기관으로 허용된 출처 URL만 등록할 수 있습니다.");
    error.statusCode = 422;
    throw error;
  }
  if (!["A+", "A", "B"].includes(input.trustGrade)) {
    const error = new Error("신뢰 등급은 A+, A, B 중 하나여야 합니다.");
    error.statusCode = 422;
    throw error;
  }
}

function idFromPath(pathname, prefix) {
  return decodeURIComponent(pathname.slice(prefix.length));
}

async function handleApi(request, response, url) {
  const { pathname, searchParams } = url;

  if (request.method === "GET" && pathname === "/api/health") {
    return sendJson(response, 200, { ok: true, mode: process.env.DB_MODE === "mysql" ? "mysql" : "file" });
  }

  if (request.method === "GET" && pathname === "/api/auth/status") {
    return sendJson(response, 200, authStatus(request));
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const input = await parseJsonBody(request);
    loginWithPin(input.pin, response);
    return sendJson(response, 200, { enabled: isAuthEnabled(), authenticated: true });
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    logout(response);
    return sendJson(response, 200, { authenticated: false });
  }

  const publicReadOnlyRoutes = new Set(["/api/search", "/api/news", "/api/sources"]);
  if (!publicReadOnlyRoutes.has(pathname)) {
    assertAuthenticated(request);
  }

  if (request.method === "GET" && pathname === "/api/babies") {
    return sendJson(response, 200, { babies: await store.listBabies() });
  }

  if (request.method === "POST" && pathname === "/api/babies") {
    const input = await parseJsonBody(request);
    validateBaby(input);
    return sendJson(response, 201, { baby: await store.createBaby(input) });
  }

  if (request.method === "PUT" && pathname.startsWith("/api/babies/")) {
    const input = await parseJsonBody(request);
    validateBaby(input);
    const baby = await store.updateBaby(idFromPath(pathname, "/api/babies/"), input);
    return baby ? sendJson(response, 200, { baby }) : sendJson(response, 404, { error: "아기 프로필을 찾을 수 없습니다." });
  }

  if (request.method === "GET" && pathname === "/api/routines") {
    const babyId = searchParams.get("babyId");
    const date = searchParams.get("date");
    if (!babyId || !date) {
      return sendJson(response, 422, { error: "babyId와 date가 필요합니다." });
    }
    return sendJson(response, 200, { entries: await store.listRoutineEntries(babyId, date) });
  }

  if (request.method === "POST" && pathname === "/api/routines") {
    const input = await parseJsonBody(request);
    validateRoutine(input);
    return sendJson(response, 201, { entry: await store.createRoutineEntry(input) });
  }

  if (request.method === "PUT" && pathname.startsWith("/api/routines/")) {
    const input = await parseJsonBody(request);
    validateRoutine(input);
    const entry = await store.updateRoutineEntry(idFromPath(pathname, "/api/routines/"), input);
    return entry ? sendJson(response, 200, { entry }) : sendJson(response, 404, { error: "기록을 찾을 수 없습니다." });
  }

  if (request.method === "DELETE" && pathname.startsWith("/api/routines/")) {
    const deleted = await store.deleteRoutineEntry(idFromPath(pathname, "/api/routines/"));
    return sendJson(response, deleted ? 200 : 404, { deleted });
  }

  if (request.method === "GET" && pathname === "/api/routine-plan") {
    const babyId = searchParams.get("babyId");
    if (!babyId) {
      return sendJson(response, 422, { error: "babyId가 필요합니다." });
    }
    return sendJson(response, 200, { items: await store.listRoutinePlanItems(babyId) });
  }

  if (request.method === "POST" && pathname === "/api/routine-plan") {
    const input = await parseJsonBody(request);
    validateRoutinePlan(input);
    return sendJson(response, 201, { item: await store.createRoutinePlanItem(input) });
  }

  if (request.method === "PUT" && pathname.startsWith("/api/routine-plan/")) {
    const input = await parseJsonBody(request);
    validateRoutinePlan(input);
    const item = await store.updateRoutinePlanItem(idFromPath(pathname, "/api/routine-plan/"), input);
    return item ? sendJson(response, 200, { item }) : sendJson(response, 404, { error: "일과표 항목을 찾을 수 없습니다." });
  }

  if (request.method === "DELETE" && pathname.startsWith("/api/routine-plan/")) {
    const deleted = await store.deleteRoutinePlanItem(idFromPath(pathname, "/api/routine-plan/"));
    return sendJson(response, deleted ? 200 : 404, { deleted });
  }

  if (request.method === "GET" && pathname === "/api/checklist") {
    const babyId = searchParams.get("babyId");
    const babies = await store.listBabies();
    const baby = babies.find((candidate) => String(candidate.id) === String(babyId));
    if (!baby) {
      return sendJson(response, 404, { error: "체크리스트를 만들 아기 프로필을 찾을 수 없습니다." });
    }

    const statuses = await store.getChecklistStatuses(babyId);
    const statusByItem = new Map(statuses.map((status) => [status.itemId, Boolean(status.completed)]));
    const items = checklistTemplates
      .filter((item) => baby.ageMonths >= item.minMonth && baby.ageMonths <= item.maxMonth)
      .map((item) => ({
        ...item,
        completed: statusByItem.get(item.id) || false
      }));

    return sendJson(response, 200, { baby, items });
  }

  if (request.method === "PATCH" && pathname.startsWith("/api/checklist/")) {
    const input = await parseJsonBody(request);
    requireFields(input, ["babyId"]);
    const itemId = idFromPath(pathname, "/api/checklist/");
    return sendJson(response, 200, {
      status: await store.setChecklistStatus(input.babyId, itemId, input.completed)
    });
  }

  if (request.method === "GET" && pathname === "/api/search") {
    const query = searchParams.get("q") || "";
    const tag = searchParams.get("tag") || "";
    return sendJson(response, 200, { documents: await store.searchDocuments({ query, tag }) });
  }

  if (request.method === "GET" && pathname === "/api/news") {
    return sendJson(response, 200, { items: await fetchParentingNews() });
  }

  if (request.method === "GET" && pathname === "/api/sources") {
    const sourceMap = new Map();
    [...sourceRegistry, ...officialDocuments, ...newsSources].forEach((source) => {
      const url = source.sourceUrl;
      if (!sourceMap.has(url)) {
        sourceMap.set(url, {
          sourceInstitution: source.sourceInstitution,
          sourceUrl: url,
          trustGrade: source.trustGrade || "A",
          useFor: source.useFor || (source.tags || []).join(", ")
        });
      }
    });
    return sendJson(response, 200, { sources: Array.from(sourceMap.values()) });
  }

  if (request.method === "GET" && pathname === "/api/documents") {
    return sendJson(response, 200, { documents: await store.listDocuments() });
  }

  if (request.method === "POST" && pathname === "/api/documents") {
    const input = await parseJsonBody(request);
    validateDocument(input);
    return sendJson(response, 201, { document: await store.createDocument(input) });
  }

  if (request.method === "PUT" && pathname.startsWith("/api/documents/")) {
    const input = await parseJsonBody(request);
    validateDocument(input);
    const document = await store.updateDocument(idFromPath(pathname, "/api/documents/"), input);
    return document ? sendJson(response, 200, { document }) : sendJson(response, 404, { error: "문서를 찾을 수 없습니다." });
  }

  if (request.method === "DELETE" && pathname.startsWith("/api/documents/")) {
    const deleted = await store.deleteDocument(idFromPath(pathname, "/api/documents/"));
    return sendJson(response, deleted ? 200 : 404, { deleted });
  }

  return sendJson(response, 404, { error: "API 경로를 찾을 수 없습니다." });
}

async function serveStatic(request, response, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");

    response.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream"
    });
    createReadStream(filePath).pipe(response);
  } catch {
    const fallback = join(publicDir, "index.html");
    response.writeHead(200, { "content-type": mimeTypes[".html"] });
    createReadStream(fallback).pipe(response);
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(request, response, url);
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, { error: error.message || "서버 오류가 발생했습니다." });
  }
});

server.listen(port, () => {
  console.log(`Care Basis is running at http://localhost:${port}`);
});
