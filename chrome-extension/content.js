// AIRE MLS Auto-Fill — Content Script
// Runs on Paragon MLS pages, listens for fill commands from the popup

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fillMLS") {
    fillParagonForm(message.fields);
    sendResponse({ status: "started" });
  }
  return true; // keep message channel open for async
});

async function fillParagonForm(fields) {
  const statusBar = createStatusBar();
  const entries = Object.entries(fields).filter(
    ([, v]) => v != null && v !== ""
  );
  let filled = 0;
  let skipped = 0;
  const total = entries.length;

  statusBar.update(`Starting auto-fill (${total} fields)...`, 0, total);

  for (const [fieldKey, value] of entries) {
    statusBar.update(
      `Filling ${fieldKey}: ${truncate(String(value), 40)}...`,
      filled,
      total
    );

    const element = findField(fieldKey);

    if (element) {
      const tag = element.tagName;

      if (tag === "SELECT") {
        fillSelect(element, String(value));
      } else if (tag === "INPUT" && element.type === "checkbox") {
        fillCheckbox(element, value);
      } else if (tag === "INPUT" && element.type === "radio") {
        fillRadio(element, String(value));
      } else if (tag === "INPUT" || tag === "TEXTAREA") {
        fillInput(element, String(value));
      }

      // Mark as filled
      element.classList.add("aire-filled");
      filled++;
    } else {
      skipped++;
    }

    // Small delay between fields to let Paragon's JS react
    await sleep(80);
  }

  // Highlight required fields that are still empty
  highlightEmptyRequired();

  const msg =
    skipped > 0
      ? `Done! Filled ${filled} of ${total} fields. ${skipped} field(s) not found on this page.`
      : `Done! Successfully filled ${filled} fields.`;

  statusBar.update(msg, filled, total);
  setTimeout(() => statusBar.remove(), 8000);
}

// ── Field Finder ──────────────────────────────────────────────────────────────

function findField(fieldKey) {
  // Strategy 1: Direct RESO/Paragon field name selectors
  const directSelectors = [
    `[name="${fieldKey}"]`,
    `[id="${fieldKey}"]`,
    `[data-field="${fieldKey}"]`,
    `[name="field_${fieldKey}"]`,
    `[id="field_${fieldKey}"]`,
    `[data-field-name="${fieldKey}"]`,
  ];

  for (const sel of directSelectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }

  // Strategy 2: Partial name/id match (case-insensitive)
  const lowerKey = fieldKey.toLowerCase();
  const allInputs = document.querySelectorAll("input, select, textarea");
  for (const el of allInputs) {
    const name = (el.name || "").toLowerCase();
    const id = (el.id || "").toLowerCase();
    if (
      (name && name.includes(lowerKey)) ||
      (id && id.includes(lowerKey))
    ) {
      return el;
    }
  }

  // Strategy 3: Find by label text near the field
  const labelTexts = buildLabelMap();
  const normalizedKey = fieldKey
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase();

  for (const [text, el] of labelTexts) {
    if (
      text.includes(lowerKey) ||
      text.includes(normalizedKey) ||
      lowerKey.includes(text)
    ) {
      return el;
    }
  }

  // Strategy 4: Paragon-specific field number pattern in label "(68)"
  const fieldNumMatch = fieldKey.match(/^(\d+)$/);
  if (fieldNumMatch) {
    const labels = document.querySelectorAll("td, label, th, span");
    for (const label of labels) {
      if (label.textContent.includes(`(${fieldKey})`)) {
        const row = label.closest("tr");
        if (row) {
          const input = row.querySelector("input, select, textarea");
          if (input) return input;
        }
        // Try next sibling
        const next = label.nextElementSibling;
        if (next) {
          const input = next.querySelector("input, select, textarea") || next;
          if (
            input.tagName === "INPUT" ||
            input.tagName === "SELECT" ||
            input.tagName === "TEXTAREA"
          ) {
            return input;
          }
        }
      }
    }
  }

  return null;
}

function buildLabelMap() {
  const map = [];
  const labels = document.querySelectorAll("label");

  for (const label of labels) {
    const forId = label.getAttribute("for");
    let input = null;

    if (forId) {
      input = document.getElementById(forId);
    }
    if (!input) {
      input = label.querySelector("input, select, textarea");
    }
    if (!input) {
      // Try adjacent element
      const next = label.nextElementSibling;
      if (
        next &&
        (next.tagName === "INPUT" ||
          next.tagName === "SELECT" ||
          next.tagName === "TEXTAREA")
      ) {
        input = next;
      }
    }

    if (input) {
      const text = label.textContent.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      map.push([text, input]);
    }
  }

  // Also check table cell labels (common in Paragon)
  const cells = document.querySelectorAll("td, th");
  for (const cell of cells) {
    const text = cell.textContent.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    if (text.length > 2 && text.length < 60) {
      const row = cell.closest("tr");
      if (row) {
        const input = row.querySelector("input, select, textarea");
        if (input) {
          map.push([text, input]);
        }
      }
    }
  }

  return map;
}

// ── Field Fillers ─────────────────────────────────────────────────────────────

function fillInput(el, value) {
  // Clear existing value first
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value"
  )?.set;

  const setter =
    el.tagName === "TEXTAREA" ? nativeTextareaValueSetter : nativeInputValueSetter;

  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }

  // Dispatch events in the order Paragon expects
  el.dispatchEvent(new Event("focus", { bubbles: true }));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));

  // Also try React synthetic events (Paragon may use React in newer versions)
  el.dispatchEvent(
    new Event("input", { bubbles: true, cancelable: true })
  );
}

function fillSelect(el, value) {
  const options = Array.from(el.options);
  const lowerValue = value.toLowerCase();

  // Try exact match first, then partial
  let match = options.find(
    (o) =>
      o.text.toLowerCase() === lowerValue || o.value.toLowerCase() === lowerValue
  );

  if (!match) {
    match = options.find(
      (o) =>
        o.text.toLowerCase().includes(lowerValue) ||
        o.value.toLowerCase().includes(lowerValue)
    );
  }

  if (!match) {
    // Try matching individual words
    const words = lowerValue.split(/\s+/);
    match = options.find((o) => {
      const optText = o.text.toLowerCase();
      return words.every((w) => optText.includes(w));
    });
  }

  if (match) {
    el.value = match.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }
}

function fillCheckbox(el, value) {
  const shouldCheck =
    value === true ||
    value === "true" ||
    value === "Yes" ||
    value === "yes" ||
    value === "1" ||
    value === 1;

  if (el.checked !== shouldCheck) {
    el.click();
  }
}

function fillRadio(el, value) {
  // Find the radio button with matching value in the same group
  const name = el.name;
  if (!name) return;

  const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
  for (const radio of radios) {
    if (
      radio.value.toLowerCase() === value.toLowerCase() ||
      radio.nextSibling?.textContent?.trim().toLowerCase() === value.toLowerCase()
    ) {
      radio.click();
      return;
    }
  }
}

// ── Required Field Highlighter ────────────────────────────────────────────────

function highlightEmptyRequired() {
  const required = document.querySelectorAll(
    "input[required], select[required], textarea[required], " +
    ".required input, .required select, .required textarea, " +
    "[data-required='true'] input, [data-required='true'] select"
  );

  for (const el of required) {
    if (!el.value || el.value.trim() === "") {
      el.classList.add("aire-missing");
    }
  }
}

// ── Status Bar ────────────────────────────────────────────────────────────────

function createStatusBar() {
  // Remove existing status bar if any
  const existing = document.getElementById("aire-status-bar");
  if (existing) existing.remove();

  const bar = document.createElement("div");
  bar.id = "aire-status-bar";
  bar.style.cssText = `
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 99999;
    background: #1e2416; color: #f5f2ea; padding: 12px 20px;
    font-family: system-ui, -apple-system, sans-serif; font-size: 14px;
    display: flex; align-items: center; gap: 12px;
    border-top: 2px solid #6b7d52; box-shadow: 0 -4px 12px rgba(0,0,0,0.3);
  `;

  const logo = document.createElement("span");
  logo.textContent = "AIRE";
  logo.style.cssText =
    "font-weight: bold; color: #c8a870; font-style: italic; font-size: 16px; flex-shrink: 0;";

  const text = document.createElement("span");
  text.id = "aire-status-text";
  text.textContent = "Starting auto-fill...";
  text.style.cssText = "flex-shrink: 0; max-width: 50%;";

  const progressContainer = document.createElement("div");
  progressContainer.style.cssText =
    "flex: 1; height: 4px; background: rgba(245,242,234,0.1); border-radius: 2px; overflow: hidden;";

  const progressBar = document.createElement("div");
  progressBar.id = "aire-progress-bar";
  progressBar.style.cssText =
    "height: 100%; width: 0%; background: linear-gradient(90deg, #6b7d52, #c8a870); transition: width 0.3s ease;";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "x";
  closeBtn.style.cssText = `
    background: none; border: 1px solid #3d4a30; color: #8a9a7a;
    width: 24px; height: 24px; border-radius: 4px; cursor: pointer;
    font-size: 12px; flex-shrink: 0; display: flex; align-items: center;
    justify-content: center;
  `;
  closeBtn.addEventListener("click", () => bar.remove());

  progressContainer.appendChild(progressBar);
  bar.appendChild(logo);
  bar.appendChild(text);
  bar.appendChild(progressContainer);
  bar.appendChild(closeBtn);
  document.body.appendChild(bar);

  return {
    update(msg, filled, total) {
      const textEl = document.getElementById("aire-status-text");
      const progressEl = document.getElementById("aire-progress-bar");
      if (textEl) textEl.textContent = msg;
      if (progressEl && total > 0) {
        progressEl.style.width = `${Math.round((filled / total) * 100)}%`;
      }
    },
    remove() {
      bar.remove();
    },
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function truncate(str, len) {
  return str.length > len ? str.substring(0, len) + "..." : str;
}
