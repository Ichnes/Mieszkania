import assert from "node:assert/strict";
import test from "node:test";
import { createLatestRequest } from "./latest-request";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function harness() {
  const request = createLatestRequest();
  const state = { value: "existing", error: null as unknown, busy: false, completions: 0 };
  const handlers = {
    start: () => {
      state.busy = true;
      state.error = null;
    },
    success: (value: string) => {
      state.value = value;
    },
    error: (error: unknown) => {
      state.error = error;
    },
    finish: () => {
      state.busy = false;
      state.completions++;
    },
  };
  return { request, state, handlers };
}

test("late old response cannot replace the latest filters or finish its loading state", async () => {
  const { request, state, handlers } = harness();
  const old = deferred<string>();
  const latest = deferred<string>();
  let oldSignal!: AbortSignal;
  const first = request.run((signal) => {
    oldSignal = signal;
    return old.promise;
  }, handlers);
  const second = request.run(() => latest.promise, handlers);
  assert.equal(oldSignal.aborted, true);
  old.resolve("old filters");
  await first;
  assert.equal(state.value, "existing");
  assert.equal(state.busy, true);
  assert.equal(state.completions, 0);
  latest.resolve("latest filters");
  await second;
  assert.equal(state.value, "latest filters");
  assert.equal(state.busy, false);
  assert.equal(state.completions, 1);
});

test("out of order success and failure cannot overwrite an already completed newer response", async () => {
  for (const fail of [false, true]) {
    const { request, state, handlers } = harness();
    const old = deferred<string>();
    const first = request.run(() => old.promise, handlers);
    await request.run(async () => "new result", handlers);
    if (fail) old.reject(new Error("late network failure"));
    else old.resolve("stale result");
    await first;
    assert.equal(state.value, "new result");
    assert.equal(state.error, null);
    assert.equal(state.completions, 1);
  }
});

test("failure preserves existing results, publishes an error, and retry clears it", async () => {
  const { request, state, handlers } = harness();
  const failure = new TypeError("Failed to fetch");
  await request.run(async () => {
    throw failure;
  }, handlers);
  assert.equal(state.error, failure);
  assert.equal(state.value, "existing");
  assert.equal(state.busy, false);
  await request.run(async () => "retried", handlers);
  assert.equal(state.error, null);
  assert.equal(state.value, "retried");
});

test("cancel prevents publishing after unmount and allows a fresh request", async () => {
  const { request, state, handlers } = harness();
  const pending = deferred<string>();
  let signal!: AbortSignal;
  const work = request.run((value) => {
    signal = value;
    return pending.promise;
  }, handlers);
  request.cancel();
  assert.equal(signal.aborted, true);
  pending.resolve("unmounted");
  await work;
  assert.equal(state.value, "existing");
  assert.equal(state.completions, 0);
  await request.run(async () => "mounted again", handlers);
  assert.equal(state.value, "mounted again");
});
