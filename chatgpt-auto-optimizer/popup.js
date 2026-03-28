const DEFAULTS = {
  enabled: true,
  keepPairs: 10,
  simplifyOldCode: true,
  simplifyOldMedia: true,
  strictMode: true,
  showStatus: true,
  statusPosition: "bottom-right"
};

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

async function load() {
  const data = await chrome.storage.sync.get(DEFAULTS);
  document.getElementById('enabled').checked = !!data.enabled;
  document.getElementById('keepPairs').value = data.keepPairs;
  document.getElementById('simplifyOldCode').checked = !!data.simplifyOldCode;
  document.getElementById('simplifyOldMedia').checked = !!data.simplifyOldMedia;
  document.getElementById('strictMode').checked = !!data.strictMode;
  document.getElementById('showStatus').checked = !!data.showStatus;
  document.getElementById('statusPosition').value = data.statusPosition || "bottom-right";
}

async function save() {
  const payload = {
    enabled: document.getElementById('enabled').checked,
    keepPairs: Number(document.getElementById('keepPairs').value || 10),
    simplifyOldCode: document.getElementById('simplifyOldCode').checked,
    simplifyOldMedia: document.getElementById('simplifyOldMedia').checked,
    strictMode: document.getElementById('strictMode').checked,
    showStatus: document.getElementById('showStatus').checked,
    statusPosition: document.getElementById('statusPosition').value
  };
  await chrome.storage.sync.set(payload);
  setStatus('Saved.');
}

async function sendToCurrentTab(action) {
  const tab = await getCurrentTab();
  if (!tab?.id) {
    setStatus('No active tab found.');
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: action });
    setStatus(action === 'restore-all' ? 'Restore sent.' : 'Run sent.');
  } catch (e) {
    setStatus('Open a ChatGPT tab first.');
  }
}

document.getElementById('save').addEventListener('click', save);
document.getElementById('restore').addEventListener('click', () => sendToCurrentTab('restore-all'));
document.getElementById('run').addEventListener('click', () => sendToCurrentTab('run-now'));

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'popup-status') setStatus(msg.text || '');
});

load();
