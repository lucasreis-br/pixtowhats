import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = process.env.COOKIE_NAME || "session";

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET missing");
  return s;
}

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlJson(obj: any) {
  return b64url(Buffer.from(JSON.stringify(obj)));
}

function signHS256(data: string, secret: string) {
  return b64url(crypto.createHmac("sha256", secret).update(data).digest());
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function decodeB64UrlToString(s: string) {
  const pad = 4 - (s.length % 4 || 4);
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(base64, "base64").toString("utf8");
}

export type SessionPayload = {
  customer_id: number;
  phone: string;
  exp: number;
  iat: number;
};

export function setSession(payload: { customer_id: number; phone: string }) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 24 * 30; // 30 dias

  const header = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, iat: now, exp };

  const p1 = b64urlJson(header);
  const p2 = b64urlJson(body);
  const data = `${p1}.${p2}`;
  const sig = signHS256(data, getSecret());
  const token = `${data}.${sig}`;

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSession() {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
}

export function readSession(): { customer_id: number; phone: string } | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [p1, p2, sig] = parts;
  const data = `${p1}.${p2}`;
  const expected = signHS256(data, getSecret());
  if (sig !== expected) return null;

  const payloadStr = decodeB64UrlToString(p2);
  const payload = safeJsonParse(payloadStr) as SessionPayload | null;
  if (!payload) return null;

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) return null;

  if (!payload.customer_id || !payload.phone) return null;

  return { customer_id: Number(payload.customer_id), phone: String(payload.phone) };
}

export function normalizePhone(raw: any) {
  return String(raw || "").replace(/\D/g, "");
}

// Password hash (scrypt) - sem libs
export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 32);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const parts = String(stored || "").split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const salt = Buffer.from(parts[1], "hex");
  const hash = Buffer.from(parts[2], "hex");
  const derived = crypto.scryptSync(password, salt, 32);

  if (hash.length !== derived.length) return false;
  return crypto.timingSafeEqual(hash, derived);
}
