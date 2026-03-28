const DEFAULTS = {
  enabled: true,
  keepPairs: 10,
  simplifyOldCode: true,
  simplifyOldMedia: true,
  strictMode: true,
  showStatus: true,
  statusPosition: "bottom-right"
};

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get(DEFAULTS);
  await chrome.storage.sync.set({ ...DEFAULTS, ...data });
  await chrome.action.setBadgeText({ text: "ON" });
  await chrome.action.setBadgeBackgroundColor({ color: "#198754" });
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync") return;
  if (changes.enabled) {
    const enabled = changes.enabled.newValue;
    await chrome.action.setBadgeText({ text: enabled ? "ON" : "OFF" });
    await chrome.action.setBadgeBackgroundColor({ color: enabled ? "#198754" : "#6c757d" });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "set-badge") {
    chrome.action.setBadgeText({ text: msg.enabled ? "ON" : "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: msg.enabled ? "#198754" : "#6c757d" });
    sendResponse({ ok: true });
  }
  if (msg?.type === "get-tab-id") {
    sendResponse({ ok: true, tabId: sender?.tab?.id ?? null });
  }
  return true;
});
