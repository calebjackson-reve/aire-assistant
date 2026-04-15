import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { pickTasks, type Queue } from "./routine-dry-run-lib.ts";

const QUEUE_PATH = path.resolve("docs/routines/queue.yaml");

const raw = readFileSync(QUEUE_PATH, "utf-8");
const queue = parse(raw) as Queue;

console.log(`\n=== Conductor Dry Run — ${new Date().toISOString()} ===\n`);
console.log(`Queue: ${QUEUE_PATH}`);
console.log(`paused=${queue.paused}  dry_run=${queue.dry_run}  max_prs=${queue.max_prs_per_night}  max_paragon=${queue.max_paragon_tasks_per_night}`);
console.log(`Pending tasks: ${queue.seed_tasks.filter((t) => t.status === "pending").length}`);
console.log(`Completed tasks: ${queue.seed_tasks.filter((t) => t.status === "completed").length}`);
console.log(`Halted (waiting on Caleb): ${queue.seed_tasks.filter((t) => t.status === "halted_for_caleb").length}`);

const picked = pickTasks(queue);
console.log(`\n--- Would dispatch ${picked.length} task(s) tonight ---\n`);
for (const t of picked) {
  console.log(`  [${t.priority}] ${t.id}  domain=${t.domain}  skill=${t.skill ?? "-"}`);
}

console.log(`\n--- Would NOT dispatch ---\n`);
for (const t of queue.seed_tasks.filter((x) => x.status === "pending" && !picked.includes(x))) {
  const reason: string[] = [];
  if (t.depends_on.length > 0) {
    const unmet = t.depends_on.filter(
      (d) => !queue.seed_tasks.find((x) => x.id === d && x.status === "completed"),
    );
    if (unmet.length) reason.push(`blocked_by=${unmet.join(",")}`);
  }
  if (picked.some((p) => p.domain === t.domain)) reason.push(`domain_taken(${t.domain})`);
  if (!reason.length) reason.push("capacity");
  console.log(`  [${t.priority}] ${t.id}  (${reason.join(", ")})`);
}
console.log("");
