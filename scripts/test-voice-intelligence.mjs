/**
 * Voice Intelligence Test Script
 *
 * Tests the normalizeTranscript layer (typo correction + synonym expansion)
 * without needing a server, database, or API key.
 *
 * Run: node scripts/test-voice-intelligence.mjs
 */

// ─── Copy of production logic (extracted for standalone testing) ───

const TYPO_CORRECTIONS = {
  "creat": "create", "crate": "create", "craete": "create",
  "addendm": "addendum", "adendum": "addendum", "addndum": "addendum", "addnedum": "addendum",
  "puchase": "purchase", "purchse": "purchase", "purhcase": "purchase",
  "agreemnt": "agreement", "agrement": "agreement", "agreemen": "agreement",
  "transction": "transaction", "transation": "transaction", "trasaction": "transaction",
  "deadlin": "deadline", "deadlne": "deadline",
  "stauts": "status", "staus": "status", "satuts": "status", "statue": "status",
  "insepction": "inspection", "inpsection": "inspection", "inspction": "inspection",
  "closng": "closing", "closeing": "closing",
  "appraisl": "appraisal", "appraisla": "appraisal", "appraial": "appraisal",
  "fianncing": "financing", "financng": "financing", "finacing": "financing",
  "complinace": "compliance", "compliane": "compliance",
  "pipline": "pipeline", "pipleine": "pipeline",
  "analsysis": "analysis", "anaylsis": "analysis", "analsis": "analysis",
  "schedul": "schedule", "schdule": "schedule", "scheduel": "schedule",
};

const PHRASE_SYNONYMS = {
  "the contract": "the purchase agreement",
  "the agreement": "the purchase agreement",
  "that thing": "that document",
  "the thing": "the document",
  "the docs": "the documents",
  "write up": "create",
  "put together": "create",
  "draw up": "create",
  "fire off": "send",
  "where are we": "what is the status",
  "what's going on": "what is the status",
  "what's the deal": "what is the status",
  "how's it going": "what is the status",
  "update me": "what is the status",
  "the other side": "the other party",
  "my deals": "my pipeline",
  "all deals": "my pipeline",
  "active deals": "my pipeline",
  "what's on my plate": "show my pipeline",
  "remind me": "check deadlines",
  "what's due": "check deadlines",
  "what's next": "check deadlines",
  "set closing": "schedule closing",
  "book closing": "schedule closing",
};

const CORRECT_WORDS = [...new Set(Object.values(TYPO_CORRECTIONS))];

function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

function normalizeTranscript(raw) {
  let text = raw.toLowerCase().trim();

  const words = text.split(/\s+/);
  const corrected = words.map((word) => {
    const match = word.match(/^([a-z']+)([^a-z']*)$/);
    if (!match) return word;
    const [, clean, punct] = match;

    if (TYPO_CORRECTIONS[clean]) return TYPO_CORRECTIONS[clean] + punct;

    if (clean.length > 4) {
      let bestWord = "";
      let bestDist = 3;
      for (const correct of CORRECT_WORDS) {
        const dist = levenshtein(clean, correct);
        if (dist < bestDist && dist <= 2) {
          bestDist = dist;
          bestWord = correct;
        }
      }
      if (bestWord) return bestWord + punct;
    }
    return word;
  });
  text = corrected.join(" ");

  const sortedPhrases = Object.entries(PHRASE_SYNONYMS).sort((a, b) => b[0].length - a[0].length);
  for (const [phrase, canonical] of sortedPhrases) {
    if (text.includes(phrase)) {
      text = text.replace(phrase, canonical);
    }
  }

  return text;
}

// ─── Test Cases ───────────────────────────────────────────

const tests = [
  // ── TYPO CORRECTIONS ──
  { category: "TYPO", input: "creat addendm for hvac", expect_contains: "create addendum", expect_not_contains: null },
  { category: "TYPO", input: "send puchase agreemnt", expect_contains: "purchase agreement", expect_not_contains: null },
  { category: "TYPO", input: "whats the statue", expect_contains: "status", expect_not_contains: "statue" },
  { category: "TYPO", input: "check deadlne for main st", expect_contains: "deadline", expect_not_contains: null },
  { category: "TYPO", input: "schedul closng for friday", expect_contains: "schedule closing", expect_not_contains: null },
  { category: "TYPO", input: "show pipline", expect_contains: "pipeline", expect_not_contains: null },
  { category: "TYPO", input: "run complinace scan", expect_contains: "compliance", expect_not_contains: null },
  { category: "TYPO", input: "craete transction at 500 elm", expect_contains: "create transaction", expect_not_contains: null },
  { category: "TYPO", input: "anaylsis for baton rouge market", expect_contains: "analysis", expect_not_contains: null },
  { category: "TYPO", input: "insepction deadlne coming up", expect_contains: "inspection deadline", expect_not_contains: null },

  // ── PHRASE SYNONYMS ──
  { category: "PHRASE", input: "send the contract to John", expect_contains: "the purchase agreement", expect_not_contains: null },
  { category: "PHRASE", input: "what's on my plate", expect_contains: "show my pipeline", expect_not_contains: null },
  { category: "PHRASE", input: "what's the deal with walnut street", expect_contains: "what is the status", expect_not_contains: null },
  { category: "PHRASE", input: "remind me about the inspection", expect_contains: "check deadlines", expect_not_contains: null },
  { category: "PHRASE", input: "book closing for may 15th", expect_contains: "schedule closing", expect_not_contains: null },
  { category: "PHRASE", input: "fire off the docs to seller", expect_contains: "send", expect_not_contains: null },
  { category: "PHRASE", input: "how's it going with 5834 guice", expect_contains: "what is the status", expect_not_contains: null },
  { category: "PHRASE", input: "what's due this week", expect_contains: "check deadlines", expect_not_contains: null },
  { category: "PHRASE", input: "put together a repair request", expect_contains: "create", expect_not_contains: null },

  // ── SAFE — should NOT corrupt these ──
  { category: "SAFE", input: "make sure the buyer signs the document", expect_contains: "make sure", expect_not_contains: "create sure" },
  { category: "SAFE", input: "send the draft to the seller", expect_contains: "draft", expect_not_contains: null },
  { category: "SAFE", input: "the party needs to sign paperwork", expect_contains: "party", expect_not_contains: "purchase agreementy" },
  { category: "SAFE", input: "push the closing date back", expect_contains: "push", expect_not_contains: null },
  { category: "SAFE", input: "forward this to the parish office", expect_contains: "parish", expect_not_contains: null },
  { category: "SAFE", input: "the client wants to counter", expect_contains: "counter", expect_not_contains: null },

  // ── COMBINED (typo + synonym) ──
  { category: "COMBO", input: "craete addendm for the contract on walnut", expect_contains: "create addendum", expect_not_contains: null },
  { category: "COMBO", input: "whats the statue of my deals", expect_contains: "status", expect_not_contains: "statue" },
  { category: "COMBO", input: "schedul closng and fire off the docs", expect_contains: "schedule closing", expect_not_contains: null },

  // ── NOVEL TYPOS (fuzzy Levenshtein against correct words) ──
  { category: "FUZZY", input: "cretae addendum for hvac", expect_contains: "create addendum", expect_not_contains: null },
  { category: "FUZZY", input: "schedulee closing for friday", expect_contains: "schedule closing", expect_not_contains: null },
  { category: "FUZZY", input: "transacton at 123 main", expect_contains: "transaction", expect_not_contains: null },
  { category: "FUZZY", input: "compliancee scan on walnut", expect_contains: "compliance", expect_not_contains: null },
];

// ─── Run Tests ────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

console.log("═══════════════════════════════════════════════════════════");
console.log("  AIRE Voice Intelligence — Normalizer Test Suite");
console.log("═══════════════════════════════════════════════════════════\n");

for (const t of tests) {
  const result = normalizeTranscript(t.input);
  const containsOk = result.includes(t.expect_contains);
  const notContainsOk = !t.expect_not_contains || !result.includes(t.expect_not_contains);
  const ok = containsOk && notContainsOk;

  if (ok) {
    passed++;
    console.log(`  ✓ [${t.category}] "${t.input}"`);
    console.log(`    → "${result}"`);
  } else {
    failed++;
    const reason = !containsOk
      ? `missing "${t.expect_contains}"`
      : `contains unwanted "${t.expect_not_contains}"`;
    console.log(`  ✗ [${t.category}] "${t.input}"`);
    console.log(`    → "${result}"`);
    console.log(`    FAIL: ${reason}`);
    failures.push({ ...t, result, reason });
  }
}

console.log("\n═══════════════════════════════════════════════════════════");
console.log(`  RESULTS: ${passed}/${tests.length} passed, ${failed} failed`);
console.log(`  Success rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
console.log("═══════════════════════════════════════════════════════════");

if (failures.length > 0) {
  console.log("\n  FAILURES:");
  for (const f of failures) {
    console.log(`    [${f.category}] "${f.input}" → "${f.result}" (${f.reason})`);
  }
}

console.log("\n  NOTE: This tests the normalizer layer only.");
console.log("  AI classification (Claude) handles: casual language mapping,");
console.log("  pronoun resolution, ambiguity detection, and entity extraction.");
console.log("  Those require the live API — test via the VoiceCommandBar UI.\n");

process.exit(failed > 0 ? 1 : 0);
