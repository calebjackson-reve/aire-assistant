/**
 * AIRE Voice Action Executor — Unit Tests (no DB required)
 * Tests the pure functions: requiresApproval, calculateRoi
 * Run: npx tsx scripts/test-voice-actions.ts
 */

import { requiresApproval } from "../lib/voice-action-executor";

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${desc}`);
  } else {
    failed++;
    console.log(`  ❌ ${desc}`);
  }
}

console.log(`\n🎙️ Voice Action Executor Tests`);
console.log(`${"=".repeat(50)}\n`);

// Approval gates
console.log("Approval Requirements:");
assert(requiresApproval("create_transaction") === true, "create_transaction requires approval");
assert(requiresApproval("create_addendum") === true, "create_addendum requires approval");
assert(requiresApproval("send_alert") === true, "send_alert requires approval");
assert(requiresApproval("schedule_closing") === true, "schedule_closing requires approval");
assert(requiresApproval("check_deadlines") === false, "check_deadlines does NOT require approval");
assert(requiresApproval("show_pipeline") === false, "show_pipeline does NOT require approval");
assert(requiresApproval("update_status") === false, "update_status does NOT require approval");
assert(requiresApproval("calculate_roi") === false, "calculate_roi does NOT require approval");
assert(requiresApproval("market_analysis") === false, "market_analysis does NOT require approval");
assert(requiresApproval("add_party") === false, "add_party does NOT require approval");
assert(requiresApproval("unknown") === false, "unknown does NOT require approval");

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed}/${passed + failed} passed`);
if (failed > 0) console.log(`❌ ${failed} failures`);
else console.log(`🎉 ALL TESTS PASSED`);

process.exit(failed > 0 ? 1 : 0);
