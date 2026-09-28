import assert from "node:assert/strict";
import test from "node:test";
import { isPublicAddress, validatePublicUrl, publicFetch } from "./public-fetch";

test("outbound requests reject private, mapped, reserved and credentialed targets", async () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "172.31.1.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "2002:7f00:1::",
    "2001:db8::1",
  ])
    assert.equal(isPublicAddress(address), false, address);
  for (const address of ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])
    assert.equal(isPublicAddress(address), true);
  for (const url of [
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com:8080",
    "https://127.1",
    "https://2130706433",
    "https://[::ffff:127.0.0.1]",
    "https://localhost",
  ])
    assert.throws(() => validatePublicUrl(url), Error, url);
  await assert.rejects(publicFetch("https://127.0.0.1/private"));
});
