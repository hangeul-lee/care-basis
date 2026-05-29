import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const cookieName = "care_basis_auth";
const maxAgeSeconds = 60 * 60 * 24 * 30;

export function isAuthEnabled() {
  return Boolean(process.env.APP_PIN);
}

function authSecret() {
  return process.env.AUTH_SECRET || process.env.APP_PIN || "local-development-secret";
}

function sign(payload) {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return index === -1
          ? [decodeURIComponent(item), ""]
          : [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))];
      })
  );
}

function makeToken() {
  const payload = JSON.stringify({
    exp: Date.now() + maxAgeSeconds * 1000,
    nonce: randomBytes(12).toString("base64url")
  });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyAuth(request) {
  if (!isAuthEnabled()) return true;

  const token = parseCookies(request)[cookieName];
  if (!token) return false;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload))) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8"));
    return Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

export function authStatus(request) {
  return {
    enabled: isAuthEnabled(),
    authenticated: verifyAuth(request)
  };
}

export function assertAuthenticated(request) {
  if (verifyAuth(request)) return;

  const error = new Error("로그인이 필요합니다.");
  error.statusCode = 401;
  throw error;
}

export function loginWithPin(pin, response) {
  if (!isAuthEnabled()) {
    return true;
  }

  if (!safeEqual(String(pin || ""), process.env.APP_PIN)) {
    const error = new Error("PIN이 올바르지 않습니다.");
    error.statusCode = 401;
    throw error;
  }

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "set-cookie",
    `${cookieName}=${encodeURIComponent(makeToken())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`
  );
  return true;
}

export function logout(response) {
  response.setHeader(
    "set-cookie",
    `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}
