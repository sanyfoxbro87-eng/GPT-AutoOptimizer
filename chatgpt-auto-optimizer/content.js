(() => {
  const DEFAULTS = {
    enabled: true,
    keepPairs: 10,
    simplifyOldCode: true,
    simplifyOldMedia: true,
    strictMode: true,
    showStatus: true,
    statusPosition: "bottom-right"
  };

  const STATE = {
    settings: { ...DEFAULTS },
    observer: null,
    routeObserver: null,
    panel: null,
    routeKey: "",
    scheduled: false,
    mutationCount: 0,
    prunedCount: 0,
    placeholders: new Map(),
    lastStats: null
  };

  const MESSAGE_SELECTORS = [
    '[data-message-author-role]',
    'main article',
    'main [data-testid*="conversation"] article',
    'main div[data-testid^="conversation-turn"]',
    'main [class*="conversation"] article',
    'main [class*="group"][data-testid]',
    'main article[data-testid]',
  ];

  function debounce(fn, wait) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  async function loadSettings() {
    const data = await chrome.storage.sync.get(DEFAULTS);
    STATE.settings = { ...DEFAULTS, ...data };
    chrome.runtime.sendMessage({ type: "set-badge", enabled: !!STATE.settings.enabled }).catch(() => {});
  }

  function getRouteKey() {
    return location.pathname + location.search;
  }

  function isConversationPage() {
    return /^\/c\//.test(location.pathname) || /chatgpt\.com\/?$/.test(location.href) || /^\/\?model=/.test(location.pathname + location.search);
  }

  function selectCandidates() {
    const set = new Set();
    for (const selector of MESSAGE_SELECTORS) {
      document.querySelectorAll(selector).forEach(el => {
        if (!(el instanceof HTMLElement)) return;
        if (el.closest('[data-cgpt-opt-placeholder="1"]')) return;
        if (el.dataset.cgptAutoOptimizerIgnore === "1") return;
        const text = (el.innerText || "").trim();
        const rect = el.getBoundingClientRect();
        const hasRole = !!el.getAttribute("data-message-author-role");
        const looksLikeMsg = hasRole || text.length > 20 || el.querySelector('pre, code, img, svg, p, h1, h2, h3, ul, ol');
        const visibleSized = rect.height > 24 || el.offsetHeight > 24;
        if (looksLikeMsg && visibleSized) set.add(el);
      });
    }

    // Fallback: detect major direct children in main
    if (set.size < 4) {
      const main = document.querySelector('main');
      if (main) {
        [...main.querySelectorAll(':scope > div, :scope section > div, :scope section article, :scope div > article')].forEach(el => {
          if (!(el instanceof HTMLElement)) return;
          const text = (el.innerText || "").trim();
          if (text.length > 30 && el.offsetHeight > 30) set.add(el);
        });
      }
    }

    const nodes = [...set].filter(isReasonableMessageNode);
    nodes.sort(compareNodesInDocumentOrder);
    return dedupeNested(nodes);
  }

  function compareNodesInDocumentOrder(a, b) {
    if (a === b) return 0;
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  }

  function dedupeNested(nodes) {
    return nodes.filter((node, idx) => {
      for (let i = 0; i < nodes.length; i++) {
        if (i === idx) continue;
        const other = nodes[i];
        if (other.contains(node)) return false;
      }
      return true;
    });
  }

  function isReasonableMessageNode(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (!el.isConnected) return false;
    if (el.closest('#cgpt-auto-opt-panel')) return false;
    if (el.dataset.cgptOptPlaceholder === "1") return false;
    if (el.offsetHeight < 24) return false;
    const text = (el.innerText || "").trim();
    const role = (el.getAttribute("data-message-author-role") || "").toLowerCase();
    const html = el.innerHTML || "";
    const heavy = /<pre|<code|<img|<svg|markdown|prose|assistant|user/i.test(html);
    return !!role || text.length >= 20 || heavy;
  }

  function pairCountToKeep(messages) {
    const keepPairs = Math.max(2, Number(STATE.settings.keepPairs || 10));
    return Math.min(messages.length, keepPairs * 2);
  }

  function makePlaceholder(original, index, total) {
    const text = (original.innerText || "").trim().replace(/\s+/g, " ");
    const preview = text.slice(0, 180);
    const ph = document.createElement("div");
    ph.dataset.cgptOptPlaceholder = "1";
    ph.className = "cgpt-auto-opt-placeholder";
    ph.innerHTML = `
      <div class="cgpt-auto-opt-label">Collapsed older message ${index + 1}/${total}</div>
      <div class="cgpt-auto-opt-preview">${escapeHtml(preview || "Older message collapsed to reduce lag.")}</div>
      <button type="button" class="cgpt-auto-opt-restore">Restore this message</button>
    `;
    ph.querySelector("button").addEventListener("click", () => restorePlaceholder(ph));
    return ph;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function restorePlaceholder(ph) {
    const id = ph.dataset.cgptOriginalId;
    if (!id) return;
    const item = STATE.placeholders.get(id);
    if (!item) return;
    ph.replaceWith(item.node);
    STATE.placeholders.delete(id);
    updatePanel();
  }

  function simplifyHeavyContent(node) {
    if (!(node instanceof HTMLElement)) return;
    if (STATE.settings.simplifyOldCode) {
      node.querySelectorAll('pre').forEach((pre, i) => {
        if (!(pre instanceof HTMLElement)) return;
        if (pre.dataset.cgptCodeSimplified === "1") return;
        const summary = document.createElement("details");
        summary.className = "cgpt-auto-opt-code-summary";
        summary.dataset.cgptCodeSimplified = "1";
        const lines = (pre.innerText || "").split(/\n/).length;
        summary.innerHTML = `<summary>Collapsed code block (${lines} lines)</summary>`;
        pre.parentNode?.insertBefore(summary, pre);
        summary.appendChild(pre);
      });
    }
    if (STATE.settings.simplifyOldMedia) {
      node.querySelectorAll('img, video, canvas, svg').forEach(el => {
        if (!(el instanceof HTMLElement)) return;
        if (el.dataset.cgptMediaSimplified === "1") return;
        const holder = document.createElement('div');
        holder.className = 'cgpt-auto-opt-media-summary';
        holder.textContent = 'Media hidden in older message';
        holder.dataset.cgptMediaSimplified = "1";
        el.style.display = 'none';
        el.dataset.cgptMediaSimplified = "1";
        el.parentNode?.insertBefore(holder, el);
      });
    }
  }

  function pruneMessages() {
    if (!STATE.settings.enabled || !isConversationPage()) {
      updatePanel({ found: 0, kept: 0, pruned: 0, placeholders: STATE.placeholders.size, note: "idle" });
      return;
    }

    const messages = selectCandidates();
    const keepCount = pairCountToKeep(messages);
    const keepStart = Math.max(0, messages.length - keepCount);
    const toPrune = messages.slice(0, keepStart);

    let prunedNow = 0;
    let simplifiedNow = 0;
    toPrune.forEach((node, idx) => {
      if (!(node instanceof HTMLElement)) return;
      if (!node.isConnected) return;
      if (node.dataset.cgptAlreadyPruned === "1") return;

      if (STATE.settings.strictMode) {
        const id = `msg-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`;
        const ph = makePlaceholder(node, idx, toPrune.length);
        ph.dataset.cgptOriginalId = id;
        STATE.placeholders.set(id, { node });
        node.dataset.cgptAlreadyPruned = "1";
        node.replaceWith(ph);
        prunedNow++;
      } else {
        simplifyHeavyContent(node);
        node.classList.add('cgpt-auto-opt-soft-hidden');
        node.dataset.cgptAlreadyPruned = "1";
        simplifiedNow++;
      }
    });

    STATE.prunedCount += prunedNow;
    STATE.lastStats = {
      found: messages.length,
      kept: messages.length - toPrune.length,
      pruned: prunedNow,
      simplified: simplifiedNow,
      placeholders: STATE.placeholders.size,
      route: getRouteKey()
    };
    updatePanel(STATE.lastStats);
  }

  const schedulePrune = debounce(() => {
    if (STATE.scheduled) return;
    STATE.scheduled = true;
    requestAnimationFrame(() => {
      STATE.scheduled = false;
      pruneMessages();
    });
  }, 150);

  function ensurePanel() {
    if (!STATE.settings.showStatus) {
      if (STATE.panel) STATE.panel.remove();
      STATE.panel = null;
      return;
    }

    if (!STATE.panel) {
      const panel = document.createElement('div');
      panel.id = 'cgpt-auto-opt-panel';
      panel.innerHTML = `
        <div class="cgpt-auto-opt-title">Auto Optimizer</div>
        <div class="cgpt-auto-opt-stats">Starting…</div>
        <div class="cgpt-auto-opt-actions">
          <button type="button" data-act="run">Run now</button>
          <button type="button" data-act="restore">Restore all</button>
          <button type="button" data-act="toggle">Disable</button>
        </div>
      `;
      panel.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === 'run') schedulePrune();
        if (act === 'restore') restoreAll();
        if (act === 'toggle') {
          const enabled = !STATE.settings.enabled;
          await chrome.storage.sync.set({ enabled });
        }
      });
      document.documentElement.appendChild(panel);
      STATE.panel = panel;
    }

    STATE.panel.dataset.position = STATE.settings.statusPosition || 'bottom-right';
  }

  function updatePanel(stats = null) {
    ensurePanel();
    if (!STATE.panel) return;
    const s = stats || STATE.lastStats || {};
    STATE.panel.querySelector('.cgpt-auto-opt-stats').textContent =
      `Found: ${s.found ?? 0} | Kept: ${s.kept ?? 0} | Pruned: ${s.pruned ?? 0} | Placeholders: ${s.placeholders ?? 0}`;
    STATE.panel.querySelector('[data-act="toggle"]').textContent = STATE.settings.enabled ? 'Disable' : 'Enable';
    STATE.panel.classList.toggle('is-disabled', !STATE.settings.enabled);
  }

  function restoreAll() {
    for (const [id, item] of [...STATE.placeholders.entries()]) {
      const ph = document.querySelector(`[data-cgpt-original-id="${CSS.escape(id)}"]`);
      if (ph) ph.replaceWith(item.node);
      STATE.placeholders.delete(id);
    }
    document.querySelectorAll('.cgpt-auto-opt-soft-hidden').forEach(el => {
      el.classList.remove('cgpt-auto-opt-soft-hidden');
      el.removeAttribute('data-cgpt-already-pruned');
    });
    updatePanel({ ...(STATE.lastStats || {}), placeholders: 0, pruned: 0 });
  }

  function observePage() {
    if (STATE.observer) STATE.observer.disconnect();
    STATE.observer = new MutationObserver((mutations) => {
      STATE.mutationCount += mutations.length;
      schedulePrune();
    });
    STATE.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function observeRouteChanges() {
    const pushState = history.pushState;
    const replaceState = history.replaceState;

    function handleRouteMaybeChanged() {
      const newKey = getRouteKey();
      if (newKey !== STATE.routeKey) {
        STATE.routeKey = newKey;
        restoreAll();
        setTimeout(schedulePrune, 300);
        setTimeout(schedulePrune, 1200);
      }
    }

    history.pushState = function(...args) {
      const result = pushState.apply(this, args);
      handleRouteMaybeChanged();
      return result;
    };
    history.replaceState = function(...args) {
      const result = replaceState.apply(this, args);
      handleRouteMaybeChanged();
      return result;
    };
    window.addEventListener('popstate', handleRouteMaybeChanged);
    STATE.routeObserver = handleRouteMaybeChanged;
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    let changed = false;
    for (const [key, val] of Object.entries(changes)) {
      STATE.settings[key] = val.newValue;
      changed = true;
    }
    if (changed) {
      if (!STATE.settings.enabled) restoreAll();
      ensurePanel();
      schedulePrune();
    }
  });


  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'run-now') {
      schedulePrune();
      sendResponse({ ok: true });
    }
    if (msg?.type === 'restore-all') {
      restoreAll();
      sendResponse({ ok: true });
    }
    return true;
  });

  async function init() {
    await loadSettings();
    STATE.routeKey = getRouteKey();
    ensurePanel();
    observePage();
    observeRouteChanges();
    schedulePrune();
    setTimeout(schedulePrune, 1200);
    setTimeout(schedulePrune, 3000);
  }

  init();
})();
