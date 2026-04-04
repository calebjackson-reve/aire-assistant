/**
 * Agent test harness output utilities.
 * Validates output and prints formatted results with PASS/FAIL status.
 */

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

export function printResult(
  agentName: string,
  output: unknown,
  requiredKeys?: string[],
  startTime?: number
) {
  const elapsed = startTime ? Date.now() - startTime : 0;

  console.log("");
  console.log(`${BOLD}${CYAN}━━━ ${agentName} ━━━${RESET}`);
  console.log(`${DIM}Processing time: ${elapsed}ms${RESET}`);
  console.log("");

  // Validate required keys if provided
  if (requiredKeys && requiredKeys.length > 0) {
    if (!output || typeof output !== "object") {
      console.log(`  ${RED}${BOLD}✗ FAIL${RESET} — Output is not an object`);
    } else {
      const obj = output as Record<string, unknown>;
      const missing = requiredKeys.filter((k) => !(k in obj));
      if (missing.length === 0) {
        console.log(`  ${GREEN}${BOLD}✓ PASS${RESET} — All ${requiredKeys.length} required fields present`);
      } else {
        console.log(`  ${RED}${BOLD}✗ FAIL${RESET} — Missing fields: ${missing.join(", ")}`);
      }
    }
  } else {
    console.log(`  ${YELLOW}⚠ NO SCHEMA${RESET} — Output not validated`);
  }

  console.log("");

  // Print the output
  if (output === null || output === undefined) {
    console.log(`  ${RED}(no output)${RESET}`);
  } else if (typeof output === "object") {
    const json = JSON.stringify(output, null, 2);
    const lines = json.split("\n");
    for (const line of lines) {
      const colored = line
        .replace(/"([^"]+)":/g, `${CYAN}"$1"${RESET}:`)
        .replace(/: "([^"]*)"(,?)$/g, `: ${GREEN}"$1"${RESET}$2`)
        .replace(/: (\d+\.?\d*)(,?)$/g, `: ${YELLOW}$1${RESET}$2`)
        .replace(/: (true|false)(,?)$/g, `: ${YELLOW}$1${RESET}$2`)
        .replace(/: (null)(,?)$/g, `: ${DIM}null${RESET}$2`);
      console.log(`  ${colored}`);
    }
  } else {
    console.log(`  ${String(output)}`);
  }

  console.log("");
  console.log(`${DIM}${"─".repeat(60)}${RESET}`);

  // Return pass/fail for summary
  if (requiredKeys && output && typeof output === "object") {
    const obj = output as Record<string, unknown>;
    return requiredKeys.every((k) => k in obj);
  }
  return true;
}

export function printHeader(title: string) {
  console.log("");
  console.log(`${BOLD}${CYAN}╔${"═".repeat(58)}╗${RESET}`);
  console.log(`${BOLD}${CYAN}║${RESET}  ${BOLD}AIRE Agent Test Harness${RESET}${" ".repeat(34)}${BOLD}${CYAN}║${RESET}`);
  console.log(`${BOLD}${CYAN}║${RESET}  ${DIM}${title}${RESET}${" ".repeat(Math.max(0, 56 - title.length))}${BOLD}${CYAN}║${RESET}`);
  console.log(`${BOLD}${CYAN}╚${"═".repeat(58)}╝${RESET}`);
  console.log("");
}

export function printSummary(results: { agent: string; passed: boolean; time: number }[]) {
  console.log("");
  console.log(`${BOLD}Summary${RESET}`);
  console.log(`${DIM}${"─".repeat(40)}${RESET}`);

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  for (const r of results) {
    const icon = r.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`  ${icon} ${r.agent} ${DIM}(${r.time}ms)${RESET}`);
  }

  console.log("");
  if (failed === 0) {
    console.log(`  ${GREEN}${BOLD}All ${passed} tests passed${RESET}`);
  } else {
    console.log(`  ${GREEN}${passed} passed${RESET}, ${RED}${failed} failed${RESET}`);
  }
  console.log("");
}
