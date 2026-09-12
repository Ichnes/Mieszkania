import test from "node:test";
import assert from "node:assert/strict";
import { dockerUrls } from "./docker-urls.mjs";

const adapter = (address, internal = false) => [{ family: "IPv4", address, internal }];
const interfaces = {
  Ethernet: adapter("192.168.1.25"),
  WiFi: adapter("192.168.1.25"),
  Loopback: adapter("127.0.0.1", true),
  "vEthernet (WSL)": adapter("172.20.0.1"),
  disconnected: adapter("169.254.1.1"),
};
test("published custom ports yield host LAN addresses without virtual adapters or duplicates", () => {
  assert.deepEqual(dockerUrls("0.0.0.0:9090\n[::]:9090", interfaces), [
    "http://localhost:9090/oferty",
    "http://192.168.1.25:9090/oferty",
  ]);
});
test("loopback binding does not advertise LAN access; explicit binding is preserved", () => {
  assert.deepEqual(dockerUrls("127.0.0.1:8080", interfaces), ["http://127.0.0.1:8080/oferty"]);
  assert.deepEqual(dockerUrls("192.168.1.25:8080", interfaces), [
    "http://192.168.1.25:8080/oferty",
  ]);
  assert.deepEqual(dockerUrls("", interfaces), []);
});
