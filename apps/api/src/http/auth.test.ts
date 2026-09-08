import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerAuth } from "./auth";
import { createAccount } from "../services/auth/passwords";
test("optional auth protects reads/writes/media, validates origin, expires sessions and revokes logout", async () => {
  let time = 1000;
  const account = await createAccount("owner@example.test", "test password for auth");
  const app = Fastify();
  registerAuth(app, {
    enabled: true,
    secure: true,
    origin: "https://home.example.test",
    accounts: [account],
    now: () => time,
  });
  app.get("/api/private", async () => ({ ok: true }));
  app.post("/api/private", async () => ({ ok: true }));
  app.get("/api/media/test", async () => ({ ok: true }));
  const headers = { origin: "https://home.example.test", "x-app-request": "1" };
  const login = () =>
    app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers,
      payload: { email: account.email, password: "test password for auth" },
    });
  try {
    assert.equal((await app.inject("/api/private")).statusCode, 401);
    assert.equal((await app.inject("/api/media/test")).statusCode, 401);
    assert.equal((await app.inject("/api/auth/status")).json().authenticated, false);
    const result = await login();
    assert.equal(result.statusCode, 200);
    const setCookie = String(result.headers["set-cookie"]);
    assert.match(setCookie, /HttpOnly; SameSite=Strict/);
    assert.match(setCookie, /; Secure/);
    const cookie = setCookie.split(";")[0];
    assert.equal((await app.inject({ url: "/api/private", headers: { cookie } })).statusCode, 200);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/private",
          headers: { ...headers, cookie, origin: "https://evil.test" },
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (await app.inject({ method: "POST", url: "/api/private", headers: { cookie } })).statusCode,
      403,
    );
    assert.equal(
      (await app.inject({ method: "POST", url: "/api/private", headers: { ...headers, cookie } }))
        .statusCode,
      200,
    );
    await app.inject({ method: "POST", url: "/api/auth/logout", headers: { ...headers, cookie } });
    assert.equal((await app.inject({ url: "/api/private", headers: { cookie } })).statusCode, 401);
    const second = String((await login()).headers["set-cookie"]).split(";")[0];
    time += 8 * 60 * 60 * 1000 + 1;
    assert.equal(
      (await app.inject({ url: "/api/private", headers: { cookie: second } })).statusCode,
      401,
    );
    const forged = await app.inject({
      url: "/api/private",
      headers: { cookie: "__Host-mieszkania_session=forged" },
    });
    assert.equal(forged.statusCode, 401);
  } finally {
    await app.close();
  }
});
test("disabled auth needs no account and login attempts are limited when enabled", async () => {
  const local = Fastify();
  registerAuth(local, { enabled: false });
  local.get("/api/private", async () => ({ ok: true }));
  assert.equal((await local.inject("/api/private")).statusCode, 200);
  assert.equal((await local.inject("/api/auth/status")).json().enabled, false);
  await local.close();
  const app = Fastify();
  registerAuth(app, { enabled: true, accounts: [] });
  try {
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/auth/login",
            headers: { "x-app-request": "1" },
            payload: { email: "missing@example.test", password: "wrong" },
          })
        ).statusCode,
        401,
      );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/login",
          headers: { "x-app-request": "1" },
          payload: { email: "missing@example.test", password: "wrong" },
        })
      ).statusCode,
      429,
    );
  } finally {
    await app.close();
  }
});
