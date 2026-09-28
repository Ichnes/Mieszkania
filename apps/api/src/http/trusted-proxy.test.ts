import assert from "node:assert/strict";
import test from "node:test";
import { parseTrustedProxies } from "./trusted-proxy";
test("forwarded addresses are only trusted for explicit IPs or CIDRs", () => {
  assert.equal(parseTrustedProxies(""), false);
  assert.deepEqual(parseTrustedProxies("127.0.0.1, 172.20.0.0/24"), ["127.0.0.1", "172.20.0.0/24"]);
  for (const value of ["true", "*", "proxy.local", "1.2.3.4/33", "::1/129"])
    assert.throws(() => parseTrustedProxies(value));
});
