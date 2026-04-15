import { test } from "node:test";
import assert from "node:assert/strict";
import { pickTasks, promoteError, markCompleted, type Queue, type Task } from "./routine-dry-run-lib.ts";

function makeTask(id: string, domain: "platform" | "paragon" | "ui", priority: number, opts: Partial<Task> = {}): Task {
  return {
    id,
    domain,
    priority,
    status: "pending",
    depends_on: [],
    attempts: 0,
    max_attempts: 2,
    ...opts,
  };
}

function baseQueue(): Queue {
  return {
    version: 1,
    updated: "2026-04-14T00:00:00Z",
    paused: false,
    dry_run: false,
    max_prs_per_night: 3,
    max_paragon_tasks_per_night: 1,
    seed_tasks: [
      makeTask("a", "platform", 10),
      makeTask("b", "paragon", 10),
      makeTask("c", "paragon", 8),
      makeTask("d", "platform", 9, { depends_on: ["a"] }),
      makeTask("e", "ui", 7),
    ],
    failed_tasks: [],
    learned_rules: [],
  };
}

test("pickTasks respects priority and domain caps", () => {
  const picked = pickTasks(baseQueue());
  const ids = picked.map((t) => t.id).sort();
  assert.deepEqual(ids, ["a", "b", "e"]);
});

test("pickTasks enforces max_paragon_tasks_per_night = 1", () => {
  const picked = pickTasks(baseQueue());
  const paragonCount = picked.filter((t) => t.domain === "paragon").length;
  assert.equal(paragonCount, 1);
});

test("pickTasks respects depends_on — d blocked by a pending", () => {
  const picked = pickTasks(baseQueue());
  assert.ok(!picked.some((t) => t.id === "d"));
});

test("pickTasks caps at max_prs_per_night=3", () => {
  const picked = pickTasks(baseQueue());
  assert.ok(picked.length <= 3);
});

test("pickTasks honors paused flag", () => {
  const paused = { ...baseQueue(), paused: true };
  assert.deepEqual(pickTasks(paused), []);
});

test("promoteError inserts fix task at priority 11", () => {
  const q = baseQueue();
  const fixId = promoteError(q, "a", {
    step: "runTest",
    message: "TypeError",
    screenshot: null,
  });
  const fix = q.seed_tasks.find((t) => t.id === fixId);
  assert.ok(fix);
  assert.equal(fix.priority, 11);
  assert.equal(fix.status, "pending");
  assert.equal(fix.domain, "platform");
  const orig = q.seed_tasks.find((t) => t.id === "a");
  assert.equal(orig!.attempts, 1);
});

test("promoteError on second failure halts original task", () => {
  const q = baseQueue();
  q.seed_tasks[0].attempts = 1;
  promoteError(q, "a", { step: "runTest", message: "TypeError", screenshot: null });
  const orig = q.seed_tasks.find((t) => t.id === "a");
  assert.equal(orig!.status, "halted_for_caleb");
});

test("markCompleted updates status", () => {
  const q = baseQueue();
  markCompleted(q, "a");
  const t = q.seed_tasks.find((x) => x.id === "a");
  assert.equal(t!.status, "completed");
});
