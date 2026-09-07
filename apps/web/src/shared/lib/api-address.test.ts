import assert from "node:assert/strict";
import test from "node:test";
import { resolveApiBaseUrl } from "./api-address";

test("LAN clients use the proxy instead of their own loopback address", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]) {
    assert.equal(resolveApiBaseUrl(`http://${host}:3001`, "192.168.0.195"), "");
    assert.equal(resolveApiBaseUrl(`http://${host}:3001`, "otomieszkanie.local"), "");
  }
});

test("local development, relative prefixes and explicit remote APIs stay supported", () => {
  assert.equal(resolveApiBaseUrl("http://localhost:3001", "localhost"), "http://localhost:3001");
  assert.equal(resolveApiBaseUrl(undefined, "192.168.0.195"), "");
  assert.equal(resolveApiBaseUrl("/backend/", "192.168.0.195"), "/backend");
  assert.equal(
    resolveApiBaseUrl("https://api.example.com/", "192.168.0.195"),
    "https://api.example.com",
  );
});
