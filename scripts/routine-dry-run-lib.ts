export type TaskDomain = "platform" | "paragon" | "ui";
export type TaskStatus = "pending" | "completed" | "halted_for_caleb" | "failed";

export type Task = {
  id: string;
  domain: TaskDomain;
  priority: number;
  status: TaskStatus;
  depends_on: string[];
  attempts: number;
  max_attempts: number;
  skill?: string | null;
  brief?: string;
  acceptance?: string[];
  created_at?: string;
  root_cause?: string;
  evidence?: string;
};

export type Queue = {
  version: number;
  updated: string;
  paused: boolean;
  dry_run: boolean;
  max_prs_per_night: number;
  max_paragon_tasks_per_night: number;
  seed_tasks: Task[];
  failed_tasks: unknown[];
  learned_rules: unknown[];
};

export type ErrorDetail = {
  step: string;
  message: string;
  screenshot: string | null;
};

export function pickTasks(queue: Queue): Task[] {
  if (queue.paused) return [];

  const completedIds = new Set(
    queue.seed_tasks.filter((t) => t.status === "completed").map((t) => t.id),
  );

  const eligible = queue.seed_tasks
    .filter((t) => t.status === "pending")
    .filter((t) => t.depends_on.every((dep) => completedIds.has(dep)))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  const picked: Task[] = [];
  let paragonCount = 0;
  const domainsPicked = new Set<TaskDomain>();

  for (const t of eligible) {
    if (picked.length >= queue.max_prs_per_night) break;
    if (t.domain === "paragon" && paragonCount >= queue.max_paragon_tasks_per_night) continue;
    if (domainsPicked.has(t.domain)) continue;
    picked.push(t);
    domainsPicked.add(t.domain);
    if (t.domain === "paragon") paragonCount++;
  }

  return picked;
}

export function promoteError(queue: Queue, taskId: string, error: ErrorDetail): string {
  const task = queue.seed_tasks.find((t) => t.id === taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  task.attempts += 1;

  if (task.attempts >= task.max_attempts) {
    task.status = "halted_for_caleb";
    return "";
  }

  const fixId = `fix-${taskId}-${Date.now()}`;
  queue.seed_tasks.unshift({
    id: fixId,
    domain: task.domain,
    priority: 11,
    status: "pending",
    depends_on: [],
    attempts: 0,
    max_attempts: 1,
    root_cause: error.message,
    evidence: error.screenshot ?? undefined,
    brief: `Re-investigate step "${error.step}" of task ${taskId}. Root cause: ${error.message}.`,
    acceptance: [`Original task ${taskId} retry succeeds`],
  });
  return fixId;
}

export function markCompleted(queue: Queue, taskId: string): void {
  const task = queue.seed_tasks.find((t) => t.id === taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  task.status = "completed";
}
