import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
export type LocalAccount = { email: string; salt: string; hash: string };
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, options, (error, key) => (error ? reject(error) : resolve(key))),
  );
}
export async function createAccount(email: string, password: string): Promise<LocalAccount> {
  email = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error("Podaj poprawny email.");
  if (password.length < 12 || password.length > 128)
    throw new Error("Hasło musi mieć 12–128 znaków.");
  const salt = randomBytes(24).toString("hex");
  return { email, salt, hash: (await derive(password, salt)).toString("hex") };
}
export async function verifyPassword(password: string, account?: LocalAccount) {
  const key = await derive(
    password,
    account?.salt ?? "000000000000000000000000000000000000000000000000",
  );
  const expected = Buffer.from(account?.hash ?? "00".repeat(64), "hex");
  return expected.length === key.length && timingSafeEqual(key, expected) && Boolean(account);
}
