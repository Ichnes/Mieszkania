import assert from "node:assert/strict";
import test from "node:test";
import type { OtodomQueueStatusResponse } from "@mieszkania/shared";
import { queuePollDelay, startQueueMonitor } from "./queue-monitor";

const idle: OtodomQueueStatusResponse = {
  sourceKey: "test",
  counts: { pending: 0, processing: 0, completed: 4, failed: 2 },
  pendingNew: 0,
  pendingPriceUpdates: 0,
  recentFailures: [],
};

test("polling slows down at rest and when paused but speeds up for work and errors", () => {
  assert.equal(queuePollDelay([idle], false), 30_000);
  assert.equal(queuePollDelay([idle], true), 5_000);
  const ready = { ...idle, counts: { ...idle.counts, pending: 4 } };
  assert.equal(queuePollDelay([ready], false), 5_000);
  assert.equal(queuePollDelay([ready], false, true), 30_000);
  assert.equal(
    queuePollDelay([{ ...idle, counts: { ...idle.counts, processing: 1 } }], false, true),
    5_000,
  );
  const now = Date.parse("2026-09-28T12:00:00Z");
  const delayed = {
    ...ready,
    readyPending: 0,
    delayedPending: 4,
    nextAttemptAt: new Date(now + 10_000).toISOString(),
  };
  assert.equal(queuePollDelay([delayed], false, false, now), 10_750);
  assert.equal(
    queuePollDelay(
      [{ ...delayed, nextAttemptAt: new Date(now - 10_000).toISOString() }],
      false,
      false,
      now,
    ),
    5_000,
  );
  assert.equal(
    queuePollDelay([{ ...delayed, nextAttemptAt: "invalid" }], false, false, now),
    30_000,
  );
});

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
test("monitor hides polling, resumes immediately, avoids overlap and stops cleanly", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const visibility = Object.assign(new EventTarget(), { hidden: true });
  let calls = 0;
  let release!: () => void;
  const stop = startQueueMonitor(
    async () => {
      calls++;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    () => 30_000,
    visibility,
  );
  assert.equal(calls, 0);
  t.mock.timers.tick(30_000);
  assert.equal(calls, 0);
  visibility.hidden = false;
  visibility.dispatchEvent(new Event("visibilitychange"));
  assert.equal(calls, 1);
  visibility.dispatchEvent(new Event("visibilitychange"));
  t.mock.timers.tick(60_000);
  assert.equal(calls, 1);
  release();
  await settle();
  t.mock.timers.tick(30_000);
  assert.equal(calls, 2);
  stop();
  release();
  await settle();
  t.mock.timers.tick(60_000);
  visibility.dispatchEvent(new Event("visibilitychange"));
  assert.equal(calls, 2);
});

test("monitor schedules another attempt after a rejected read and uses the current delay", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const visibility = Object.assign(new EventTarget(), { hidden: false });
  let calls = 0;
  let delay = 5_000;
  const stop = startQueueMonitor(
    async () => {
      calls++;
      if (calls === 1) throw new Error("offline");
      delay = 30_000;
    },
    () => delay,
    visibility,
  );
  t.after(stop);
  await settle();
  t.mock.timers.tick(5_000);
  await settle();
  assert.equal(calls, 2);
  t.mock.timers.tick(29_999);
  assert.equal(calls, 2);
  t.mock.timers.tick(1);
  assert.equal(calls, 3);
});
