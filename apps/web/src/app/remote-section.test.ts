import assert from "node:assert/strict";
import test from "node:test";
import { createRemoteSection } from "./remote-section";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

test("slow summary and failed calendar do not block a successful list or each other", async () => {
  const slow = deferred<number>();
  const summary = createRemoteSection(() => slow.promise, "Summary failed");
  const calendar = createRemoteSection(async () => {
    throw new Error("HTTP 500");
  }, "Calendar failed");
  const list = createRemoteSection(async () => ["offer"], "List failed");
  const pending = summary.reload();
  await Promise.all([calendar.reload(), list.reload()]);
  assert.equal(summary.getSnapshot().status, "loading");
  assert.deepEqual(calendar.getSnapshot(), {
    status: "error",
    data: null,
    error: "Calendar failed",
  });
  assert.deepEqual(list.getSnapshot().data, ["offer"]);
  slow.resolve(5);
  await pending;
  assert.equal(summary.getSnapshot().data, 5);
  assert.equal(calendar.getSnapshot().status, "error");
});

test("retry preserves previous data, reports failure and recovers without reloading other sections", async () => {
  let fail = false;
  const section = createRemoteSection(async () => {
    if (fail) throw new Error("Offline");
    return { total: 2 };
  }, "Failed");
  let notifications = 0;
  const unsubscribe = section.subscribe(() => notifications++);
  await section.reload();
  fail = true;
  await section.reload();
  assert.deepEqual(section.getSnapshot(), { status: "error", data: { total: 2 }, error: "Failed" });
  fail = false;
  await section.reload();
  assert.equal(section.getSnapshot().status, "ready");
  assert.equal(section.getSnapshot().error, null);
  assert.equal(notifications, 6);
  unsubscribe();
  section.updateData(() => ({ total: 3 }));
  assert.equal(section.getSnapshot().data?.total, 3);
  assert.equal(notifications, 6);
});

test("leaving a page cancels pending work; late success and failure cannot overwrite a later visit", async () => {
  const requests: Array<ReturnType<typeof deferred<number>> & { signal: AbortSignal }> = [];
  const section = createRemoteSection((signal) => {
    const request = { ...deferred<number>(), signal };
    requests.push(request);
    return request.promise;
  }, "Failed");
  const first = section.reload();
  section.cancel();
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(section.getSnapshot().status, "idle");
  const second = section.reload();
  requests[1].resolve(2);
  await second;
  requests[0].resolve(1);
  await first;
  assert.equal(section.getSnapshot().data, 2);
  const third = section.reload();
  const fourth = section.reload();
  requests[2].reject(new Error("Late failure"));
  await third;
  assert.equal(section.getSnapshot().status, "loading");
  requests[3].resolve(4);
  await fourth;
  assert.equal(section.getSnapshot().data, 4);
});
