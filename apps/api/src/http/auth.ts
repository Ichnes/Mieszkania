import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { storageRoot } from "../config";
import { verifyPassword, type LocalAccount } from "../services/auth/passwords";

type AuthOptions = {
  enabled?: boolean;
  secure?: boolean;
  origin?: string;
  accounts?: LocalAccount[];
  now?: () => number;
};
export function registerAuth(app: FastifyInstance, options: AuthOptions = {}) {
  const enabled = options.enabled ?? process.env.AUTH_ENABLED === "true";
  const secure = options.secure ?? process.env.AUTH_COOKIE_SECURE === "true";
  const origin = options.origin ?? (process.env.APP_ORIGIN || undefined);
  const now = options.now ?? Date.now;
  const cookieName = secure ? "__Host-mieszkania_session" : "mieszkania_session";
  const duration = 8 * 60 * 60 * 1000;
  const sessions = new Map<string, { email: string; expires: number }>();
  const attempts = new Map<string, { count: number; until: number }>();
  let accounts: LocalAccount[] = options.accounts ?? [];
  let passwordJobs = 0;
  const key = (token: string) => createHash("sha256").update(token).digest("hex");
  const token = (request: FastifyRequest) =>
    (request.headers.cookie ?? "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1) ?? "";
  const session = (request: FastifyRequest) => {
    const hash = key(token(request));
    const value = sessions.get(hash);
    if (value && value.expires > now()) return value;
    sessions.delete(hash);
    return undefined;
  };
  const cookie = (value: string, maxAge: number) =>
    `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
  app.addHook("onReady", async () => {
    if (!enabled || options.accounts) return;
    const data = JSON.parse(
      await readFile(resolve(storageRoot, "auth", "accounts.json"), "utf8"),
    ) as { version: number; accounts: LocalAccount[] };
    if (
      data.version !== 1 ||
      !Array.isArray(data.accounts) ||
      !data.accounts.length ||
      data.accounts.some(
        (a) => !a.email || !/^[a-f0-9]{48}$/.test(a.salt) || !/^[a-f0-9]{128}$/.test(a.hash),
      )
    )
      throw new Error("Nieprawidłowy plik kont. Uruchom npm run auth:user.");
    accounts = data.accounts;
  });
  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("X-Frame-Options", "DENY");
    const path = request.url.split("?")[0];
    if (path.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    const unsafe = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    // Exact origins plus a custom header reject cross-site forms and fetches.
    const expectedOrigin = origin ?? `${request.protocol}://${request.headers.host}`;
    if (
      unsafe &&
      ((request.headers.origin && request.headers.origin !== expectedOrigin) ||
        (enabled && request.headers["x-app-request"] !== "1"))
    ) {
      return reply.code(403).send({ message: "Niedozwolone źródło żądania." });
    }
    if (!enabled || path === "/health" || ["/api/auth/status", "/api/auth/login"].includes(path))
      return;
    if (!session(request))
      return reply.code(401).send({ message: "Zaloguj się, aby kontynuować." });
  });
  app.get("/api/auth/status", async (request) => ({
    enabled,
    authenticated: !enabled || Boolean(session(request)),
    email: enabled ? session(request)?.email : undefined,
  }));
  app.post<{ Body: { email: string; password: string } }>(
    "/api/auth/login",
    {
      bodyLimit: 2048,
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["email", "password"],
          properties: {
            email: { type: "string", maxLength: 254 },
            password: { type: "string", minLength: 1, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => {
      if (!enabled) return reply.code(404).send({ message: "Logowanie jest wyłączone." });
      for (const [ip, value] of attempts) if (value.until <= now()) attempts.delete(ip);
      let attempt = attempts.get(request.ip);
      if (!attempt) {
        if (attempts.size >= 5000)
          return reply.code(429).send({ message: "Spróbuj ponownie później." });
        attempt = { count: 0, until: now() + 15 * 60 * 1000 };
        attempts.set(request.ip, attempt);
      }
      if (attempt.count >= 10 || passwordJobs >= 4) {
        reply.header("Retry-After", "900");
        return reply.code(429).send({ message: "Zbyt wiele prób. Spróbuj ponownie za 15 minut." });
      }
      attempt.count++;
      passwordJobs++;
      const account = accounts.find((a) => a.email === request.body.email.trim().toLowerCase());
      let valid = false;
      try {
        valid = await verifyPassword(request.body.password, account);
      } finally {
        passwordJobs--;
      }
      if (!valid || !account)
        return reply.code(401).send({ message: "Nieprawidłowy email lub hasło." });
      sessions.delete(key(token(request)));
      for (const [hash, value] of sessions) if (value.expires <= now()) sessions.delete(hash);
      if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value!);
      const newToken = randomBytes(32).toString("hex");
      sessions.set(key(newToken), { email: account.email, expires: now() + duration });
      reply.header("Set-Cookie", cookie(newToken, duration / 1000));
      return { authenticated: true, email: account.email };
    },
  );
  app.post("/api/auth/logout", async (request, reply) => {
    sessions.delete(key(token(request)));
    reply.header("Set-Cookie", cookie("", 0));
    return { ok: true };
  });
  app.addHook("onClose", async () => {
    sessions.clear();
    attempts.clear();
  });
}
