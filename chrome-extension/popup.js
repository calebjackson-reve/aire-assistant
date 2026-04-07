// AIRE MLS Auto-Fill — Popup Logic
// Fetches transactions from AIRE API and sends field data to content script

const $ = (id) => document.getElementById(id);

let transactions = [];

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // Restore saved settings
  const stored = await chrome.storage.local.get(["aireServerUrl", "aireApiToken"]);
  if (stored.aireServerUrl) $("serverUrl").value = stored.aireServerUrl;
  if (stored.aireApiToken) {
    $("apiToken").value = stored.aireApiToken;
    await loadTransactions();
  }

  // Save token
  $("btnSaveToken").addEventListener("click", async () => {
    const url = $("serverUrl").value.replace(/\/+$/, "");
    const token = $("apiToken").value.trim();

    if (!token) {
      showStatus("Please enter an API token.", "error");
      return;
    }

    await chrome.storage.local.set({ aireServerUrl: url, aireApiToken: token });
    showStatus("Token saved. Loading transactions...", "loading");
    await loadTransactions();
  });

  // Transaction selection change
  $("transactionSelect").addEventListener("change", () => {
    const txnId = $("transactionSelect").value;
    const txn = transactions.find((t) => t.id === txnId);

    if (txn) {
      $("txnInfo").classList.add("visible");
      $("txnProperty").textContent = txn.propertyAddress || "N/A";
      $("txnStatus").textContent = txn.status || "N/A";
      $("txnPrice").textContent = txn.listPrice
        ? `$${Number(txn.listPrice).toLocaleString()}`
        : txn.salePrice
        ? `$${Number(txn.salePrice).toLocaleString()}`
        : "N/A";
      $("btnFill").disabled = false;
    } else {
      $("txnInfo").classList.remove("visible");
      $("btnFill").disabled = true;
    }
  });

  // Fill button
  $("btnFill").addEventListener("click", async () => {
    const txnId = $("transactionSelect").value;
    if (!txnId) return;

    showStatus("Preparing MLS field data...", "loading");

    try {
      const fields = await fetchMLSFields(txnId);

      // Send to content script on the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        showStatus("No active tab found.", "error");
        return;
      }

      // Check if we're on a Paragon/Matrix page
      const isMLSPage =
        tab.url &&
        (tab.url.includes("paragon.fnismls.com") || tab.url.includes("matrix.fnismls.com"));

      if (!isMLSPage) {
        showStatus(
          "Navigate to a Paragon MLS listing form first.",
          "error"
        );
        return;
      }

      chrome.tabs.sendMessage(
        tab.id,
        { action: "fillMLS", fields },
        (response) => {
          if (chrome.runtime.lastError) {
            showStatus(
              "Could not connect to MLS page. Try refreshing the page.",
              "error"
            );
          } else if (response && response.status === "started") {
            showStatus("Auto-fill started! Check the MLS page.", "success");
          }
        }
      );
    } catch (err) {
      showStatus(`Error: ${err.message}`, "error");
    }
  });
});

// ── API Calls ─────────────────────────────────────────────────────────────────

async function loadTransactions() {
  const url = $("serverUrl").value.replace(/\/+$/, "");
  const token = await getToken();

  if (!token) {
    showStatus("No API token configured.", "error");
    return;
  }

  showStatus("Loading transactions...", "loading");

  try {
    const res = await fetch(`${url}/api/transactions`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        showStatus("Invalid API token. Please check and save again.", "error");
      } else {
        showStatus(`Server error: ${res.status}`, "error");
      }
      return;
    }

    const data = await res.json();
    transactions = Array.isArray(data) ? data : data.transactions || [];

    const select = $("transactionSelect");
    select.innerHTML = '<option value="">-- Select a transaction --</option>';

    transactions.forEach((txn) => {
      const opt = document.createElement("option");
      opt.value = txn.id;
      const addr = txn.propertyAddress || "No address";
      const status = txn.status || "";
      opt.textContent = `${addr} (${status})`;
      select.appendChild(opt);
    });

    select.disabled = false;
    $("connectionDot").classList.add("connected");
    showStatus(`Loaded ${transactions.length} transaction(s).`, "success");
  } catch (err) {
    showStatus(`Connection failed: ${err.message}`, "error");
    $("connectionDot").classList.remove("connected");
  }
}

async function fetchMLSFields(txnId) {
  const url = $("serverUrl").value.replace(/\/+$/, "");
  const token = await getToken();
  const txn = transactions.find((t) => t.id === txnId);

  if (!txn) throw new Error("Transaction not found");

  // Try dedicated MLS fields endpoint first, fall back to building from transaction data
  try {
    const res = await fetch(`${url}/api/transactions/${txnId}/mls-fields`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      return data.fields || data;
    }
  } catch {
    // Endpoint may not exist yet; fall back to mapping from transaction data
  }

  // Map transaction data to common Paragon MLS field numbers
  // These field numbers are based on typical Paragon Residential listing input forms
  return buildMLSFieldMap(txn);
}

function buildMLSFieldMap(txn) {
  const fields = {};

  // Property address fields
  if (txn.propertyAddress) {
    const parts = parseAddress(txn.propertyAddress);
    if (parts.streetNumber) fields["StreetNumber"] = parts.streetNumber;
    if (parts.streetDir) fields["StreetDirPrefix"] = parts.streetDir;
    if (parts.streetName) fields["StreetName"] = parts.streetName;
    if (parts.streetType) fields["StreetSuffix"] = parts.streetType;
    if (parts.unit) fields["UnitNumber"] = parts.unit;
    if (parts.city) fields["City"] = parts.city;
    if (parts.state) fields["StateOrProvince"] = parts.state;
    if (parts.zip) fields["PostalCode"] = parts.zip;
  }

  // Price fields
  if (txn.listPrice) fields["ListPrice"] = txn.listPrice;
  if (txn.salePrice) fields["ClosePrice"] = txn.salePrice;
  if (txn.originalPrice) fields["OriginalListPrice"] = txn.originalPrice;

  // Property details
  if (txn.propertyType) fields["PropertyType"] = txn.propertyType;
  if (txn.propertySubType) fields["PropertySubType"] = txn.propertySubType;
  if (txn.bedrooms) fields["BedroomsTotal"] = txn.bedrooms;
  if (txn.bathrooms) fields["BathroomsTotalInteger"] = txn.bathrooms;
  if (txn.squareFeet) fields["LivingArea"] = txn.squareFeet;
  if (txn.lotSize) fields["LotSizeArea"] = txn.lotSize;
  if (txn.yearBuilt) fields["YearBuilt"] = txn.yearBuilt;
  if (txn.stories) fields["StoriesTotal"] = txn.stories;
  if (txn.garageSpaces) fields["GarageSpaces"] = txn.garageSpaces;

  // Dates
  if (txn.listingDate) fields["ListingContractDate"] = formatDate(txn.listingDate);
  if (txn.closingDate) fields["CloseDate"] = formatDate(txn.closingDate);
  if (txn.expirationDate) fields["ExpirationDate"] = formatDate(txn.expirationDate);

  // Agent / office info
  if (txn.listingAgentName) fields["ListAgentFullName"] = txn.listingAgentName;
  if (txn.listingAgentPhone) fields["ListAgentDirectPhone"] = txn.listingAgentPhone;
  if (txn.listingAgentEmail) fields["ListAgentEmail"] = txn.listingAgentEmail;
  if (txn.listingOfficeName) fields["ListOfficeName"] = txn.listingOfficeName;

  // Buyer/seller info from parties
  if (txn.parties && Array.isArray(txn.parties)) {
    const seller = txn.parties.find((p) => p.role === "SELLER" || p.role === "seller");
    const buyer = txn.parties.find((p) => p.role === "BUYER" || p.role === "buyer");

    if (seller) {
      if (seller.name) fields["OwnerName"] = seller.name;
      if (seller.phone) fields["OwnerPhone"] = seller.phone;
    }
    if (buyer) {
      if (buyer.name) fields["BuyerAgentFullName"] = buyer.name;
    }
  }

  // MLS number
  if (txn.mlsNumber) fields["ListingId"] = txn.mlsNumber;

  // Description / remarks
  if (txn.publicRemarks) fields["PublicRemarks"] = txn.publicRemarks;
  if (txn.privateRemarks) fields["PrivateRemarks"] = txn.privateRemarks;
  if (txn.directions) fields["Directions"] = txn.directions;

  // Parish / county (Louisiana-specific)
  if (txn.parish) fields["CountyOrParish"] = txn.parish;
  if (txn.county) fields["CountyOrParish"] = txn.county;
  if (txn.subdivision) fields["SubdivisionName"] = txn.subdivision;
  if (txn.legalDescription) fields["TaxLegalDescription"] = txn.legalDescription;

  return fields;
}

function parseAddress(address) {
  const result = {};
  if (!address) return result;

  // Simple address parser for "123 N Main St, Unit 4, Baton Rouge, LA 70801"
  const parts = address.split(",").map((s) => s.trim());

  if (parts.length >= 1) {
    const street = parts[0];
    const streetMatch = street.match(
      /^(\d+)\s+(N|S|E|W|NE|NW|SE|SW)?\s*(.+?)\s+(St|Ave|Blvd|Dr|Ln|Rd|Way|Ct|Pl|Cir|Pkwy|Hwy|Loop)\.?$/i
    );
    if (streetMatch) {
      result.streetNumber = streetMatch[1];
      result.streetDir = streetMatch[2] || "";
      result.streetName = streetMatch[3];
      result.streetType = streetMatch[4];
    } else {
      // Fallback: first token is number, rest is street
      const tokens = street.split(/\s+/);
      if (/^\d+$/.test(tokens[0])) {
        result.streetNumber = tokens[0];
        result.streetName = tokens.slice(1).join(" ");
      } else {
        result.streetName = street;
      }
    }
  }

  // Check for unit in second part
  if (parts.length >= 2) {
    const unitMatch = parts[1].match(/^(Unit|Apt|Suite|Ste|#)\s*(.+)$/i);
    if (unitMatch) {
      result.unit = unitMatch[2];
      if (parts.length >= 3) result.city = parts[2];
    } else {
      result.city = parts[1];
    }
  }

  // State and zip in last part
  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    const stateZip = last.match(/([A-Z]{2})\s+(\d{5}(-\d{4})?)/);
    if (stateZip) {
      result.state = stateZip[1];
      result.zip = stateZip[2];
      if (!result.city && parts.length >= 3) {
        result.city = parts[parts.length - 2];
      }
    } else if (/^[A-Z]{2}$/.test(last)) {
      result.state = last;
    } else if (!result.city) {
      result.city = last;
    }
  }

  return result;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getToken() {
  const stored = await chrome.storage.local.get(["aireApiToken"]);
  return stored.aireApiToken || $("apiToken").value.trim();
}

function showStatus(msg, type) {
  const status = $("status");
  const text = $("statusText");
  const spinner = $("statusSpinner");

  status.className = `status visible ${type}`;
  text.textContent = msg;
  spinner.style.display = type === "loading" ? "block" : "none";

  if (type === "success") {
    setTimeout(() => {
      status.classList.remove("visible");
    }, 4000);
  }
}
