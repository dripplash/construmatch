import { promisify } from "node:util";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const scryptAsync = promisify(scrypt);
const params = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const keyLength = 64;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 200) throw new Error("Password length rejected");
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, keyLength, params) as Buffer;
  return ["scrypt", params.N, params.r, params.p, salt.toString("base64url"), derived.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, n, r, p, saltValue, hashValue] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, "base64url");
  const derived = await scryptAsync(password, Buffer.from(saltValue, "base64url"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: params.maxmem,
  }) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
