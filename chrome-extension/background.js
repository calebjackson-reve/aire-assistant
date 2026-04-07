// AIRE MLS Auto-Fill — Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("AIRE MLS Auto-Fill extension installed");

  // Set default server URL
  chrome.storage.local.get(["aireServerUrl"], (result) => {
    if (!result.aireServerUrl) {
      chrome.storage.local.set({ aireServerUrl: "https://aireintel.org" });
    }
  });
});

// Optional: Listen for tab updates to show badge when on MLS pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const isMLSPage =
      tab.url.includes("paragon.fnismls.com") ||
      tab.url.includes("matrix.fnismls.com");

    if (isMLSPage) {
      chrome.action.setBadgeText({ text: "MLS", tabId });
      chrome.action.setBadgeBackgroundColor({ color: "#6b7d52", tabId });
    } else {
      chrome.action.setBadgeText({ text: "", tabId });
    }
  }
});
