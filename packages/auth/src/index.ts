import * as argon2 from "argon2";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  sub: string;
  email: string;
  typ: "access" | "refresh";
  orgId?: string;
  role?: string;
  sid?: string;
}

export interface AuthConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string | number;
  refreshTtl: string | number;
  apiKeyPepper: string;
  otpPepper: string;
  encryptionKeyHex: string;
}

export function loadAuthConfig(): AuthConfig {
  return {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
    apiKeyPepper: required("API_KEY_PEPPER"),
    otpPepper: required("OTP_PEPPER"),
    encryptionKeyHex: required("ENCRYPTION_KEY"),
  };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function signAccessToken(cfg: AuthConfig, payload: Omit<JwtPayload, "typ">): string {
  return jwt.sign({ ...payload, typ: "access" }, cfg.accessSecret, {
    expiresIn: cfg.accessTtl as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(cfg: AuthConfig, payload: Omit<JwtPayload, "typ">): string {
  return jwt.sign({ ...payload, typ: "refresh" }, cfg.refreshSecret, {
    expiresIn: cfg.refreshTtl as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(cfg: AuthConfig, token: string): JwtPayload {
  const payload = jwt.verify(token, cfg.accessSecret) as JwtPayload;
  if (payload.typ !== "access") throw new Error("invalid_token_type");
  return payload;
}

export function verifyRefreshToken(cfg: AuthConfig, token: string): JwtPayload {
  const payload = jwt.verify(token, cfg.refreshSecret) as JwtPayload;
  if (payload.typ !== "refresh") throw new Error("invalid_token_type");
  return payload;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateApiKey(environment: "test" | "live"): {
  raw: string;
  prefix: string;
  lastFour: string;
} {
  const body = randomBytes(24).toString("base64url");
  const raw = `sk_${environment}_${body}`;
  return { raw, prefix: raw.slice(0, 12), lastFour: raw.slice(-4) };
}

export function hashApiKey(raw: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}${raw}`).digest("hex");
}

export function generateOtp(length = 6): string {
  const max = 10 ** length;
  const n = randomBytes(4).readUInt32BE(0) % max;
  return n.toString().padStart(length, "0");
}

export function hashOtp(code: string, pepper: string, verificationId: string): string {
  return createHmac("sha256", pepper).update(`${verificationId}:${code}`).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function encryptAesGcm(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptAesGcm(payload: string, keyHex: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

export function signWebhookPayload(secret: string, body: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function generateDeviceToken(): { raw: string; prefix: string; hash: string } {
  const raw = `dev_${randomBytes(32).toString("base64url")}`;
  return {
    raw,
    prefix: raw.slice(0, 12),
    hash: createHash("sha256").update(raw).digest("hex"),
  };
}

export function hashDeviceToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function randomUrlToken(): string {
  return randomBytes(32).toString("base64url");
}
