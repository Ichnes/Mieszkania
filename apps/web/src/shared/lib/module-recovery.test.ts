import assert from "node:assert/strict";
import test from "node:test";
import { moduleReloadKey, recoverModuleError } from "./module-recovery";

test("a missing module reloads once, keeping a cooldown across page reloads", () => {
  const values = new Map<string, string>();
  let reloads = 0;
  const env = {
    online: true,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    },
    now: 100_000,
    reload: () => {
      reloads++;
    },
  };
  assert.ok(
    recoverModuleError(
      new TypeError("Failed to fetch dynamically imported module: /assets/old.js"),
      env,
    ),
  );
  assert.equal(values.get(moduleReloadKey), "100000");
  assert.equal(
    recoverModuleError(new TypeError("Importing a module script failed."), {
      ...env,
      now: 101_000,
    }),
    false,
  );
  assert.equal(reloads, 1);
  assert.ok(
    recoverModuleError(new TypeError("Importing a module script failed."), {
      ...env,
      now: 161_000,
    }),
  );
});

test("offline, ordinary render errors and blocked storage never trigger automatic reloads", () => {
  const env = {
    online: true,
    storage: { getItem: () => null, setItem: () => {} },
    now: 100_000,
    reload: () => {
      assert.fail("unexpected reload");
    },
  };
  const error = new Error("Failed to fetch dynamically imported module");
  assert.equal(recoverModuleError(error, { ...env, online: false }), false);
  assert.equal(recoverModuleError(new Error("Unexpected application error"), env), false);
  assert.equal(
    recoverModuleError(error, {
      ...env,
      storage: {
        ...env.storage,
        getItem: () => {
          throw new Error("Storage blocked");
        },
      },
    }),
    false,
  );
});
