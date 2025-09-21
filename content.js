// content.js
// Replace your current content.js with this file.

// ---- Config ----
const DEFAULT_THRESHOLD = 0.75; // default toxicity threshold to blur
const SELECTOR = "article div[data-testid='tweetText']"; // X/Twitter selector

console.log("[MG] content script loaded");

// Normalize text for classifier (collapse spaces, remove zero-width)
function normalizeText(t) {
  if (!t) return "";
  return t
    .replace(/\u200B/g, "")        // remove zero-width
    .replace(/\u200C/g, "")
    .replace(/\u200D/g, "")
    .replace(/\s+/g, " ")          // collapse whitespace/newlines
    .trim();
}

// Read threshold from storage (returns a Promise)
function getThreshold() {
  return new Promise(resolve => {
    try {
      chrome.storage.local.get({ threshold: DEFAULT_THRESHOLD }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn("[MG] storage.get error:", chrome.runtime.lastError);
          resolve(DEFAULT_THRESHOLD);
        } else {
          const t = parseFloat(res.threshold);
          resolve(Number.isFinite(t) ? t : DEFAULT_THRESHOLD);
        }
      });
    } catch (e) {
      resolve(DEFAULT_THRESHOLD);
    }
  });
}

// Check if extension is enabled (returns a Promise)
function getExtensionEnabled() {
  return new Promise(resolve => {
    try {
      chrome.storage.sync.get({ extensionEnabled: true }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn("[MG] storage.get error:", chrome.runtime.lastError);
          resolve(true); // default to enabled
        } else {
          resolve(res.extensionEnabled !== false); // default to true
        }
      });
    } catch (e) {
      resolve(true); // default to enabled
    }
  });
}

// Wrapper to call background classifier and return a Promise
function classifyViaBackground(text) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "CLASSIFY_TEXT", text }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("[MG] runtime.lastError -> background call:", chrome.runtime.lastError);
        resolve(null);
        return;
      }
      resolve(response || null);
    });
    
  });
}

// Main scanner for posts/tweets
async function scanAndProcessOnce() {
  // First check if extension is enabled
  const isEnabled = await getExtensionEnabled();
  if (!isEnabled) {
    console.log("[MG] Extension is disabled, skipping scan");
    return; // Exit early if extension is turned off
  }

  const threshold = await getThreshold();
  const nodes = Array.from(document.querySelectorAll(SELECTOR));

  for (const textNode of nodes) {
    // Avoid reprocessing the same text node
    if (textNode.dataset.mgScanned) continue;
    textNode.dataset.mgScanned = "1";

    const raw = textNode.innerText || "";
    const text = normalizeText(raw);

    if (!text || text.length < 3) continue;

    // For debug: show the text being classified (limited length)
    console.log("[MG] Scanning post:", JSON.stringify(text.slice(0, 300)));

    // Ask background for classification
    const resp = await classifyViaBackground(text);

    if (!resp) {
      console.warn("[MG] No response from classifier for text:", text.slice(0, 120));
      continue;
    }

    // Expecting resp to be { ok: true, labels: [ { label, score }, ... ] }
    if (!resp.ok || !Array.isArray(resp.labels)) {
      console.warn("[MG] classifier response unexpected:", resp);
      continue;
    }

    // Find any label above threshold
    const flagged = resp.labels.find(l => {
      const s = typeof l.score === "number" ? l.score : (l.score && l.score.value) || 0;
      return s >= threshold;
    });

    if (flagged) {
      // normalize returned label/score shape
      const label = flagged.label || (flagged.attribute || "flagged");
      const score = (typeof flagged.score === "number") ? flagged.score :
                    (flagged.score && flagged.score.value) ? flagged.score.value : 1.0;

      // Grab the full article element to blur (safer than only text node)
      const articleEl = textNode.closest("article") || textNode.parentElement || textNode;

      console.log("[MG] Blurring post due to:", label, score);
      try {
        if (window.MGBlur && typeof window.MGBlur.blurElement === "function") {
          window.MGBlur.blurElement(articleEl, label, score);
        } else if (typeof MGBlur !== "undefined" && typeof MGBlur.blurElement === "function") {
          MGBlur.blurElement(articleEl, label, score);
        } else if (typeof blurElement === "function") {
          // fallback if old alias exists
          blurElement(articleEl, label, score);
        } else {
          // ultimate fallback: simple inline blur
          articleEl.style.filter = "blur(6px)";
          articleEl.title = `Hidden: ${label} (${Math.round(score*100)}%)`;
        }
      } catch (err) {
        console.error("[MG] error while blurring:", err);
      }
    } else {
    }
  }
}

// Keep scanning as new content loads (infinite scroll)
const observer = new MutationObserver((mutations) => {
  // Debounce by scheduling a scan (fast)
  if (window.__mg_scan_timeout) clearTimeout(window.__mg_scan_timeout);
  window.__mg_scan_timeout = setTimeout(() => {
    scanAndProcessOnce().catch(e => console.error("[MG] scan error:", e));
  }, 300);
});
observer.observe(document.body, { childList: true, subtree: true });

// run initial scans
scanAndProcessOnce().catch(e => console.error("[MG] initial scan error:", e));
setInterval(() => scanAndProcessOnce().catch(e => console.error("[MG] periodic scan error:", e)), 4000);

// Listen for settings updates from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'settingsUpdated') {
    console.log("[MG] Settings updated:", message.settings);
    
    // If extension was just turned off, we could optionally un-blur content
    if (!message.settings.extensionEnabled) {
      console.log("[MG] Extension turned OFF - stopping scans");
      // Optionally un-blur previously blurred content
      unblurAllContent();
    } else {
      console.log("[MG] Extension turned ON - resuming scans");
      // Trigger a fresh scan
      scanAndProcessOnce().catch(e => console.error("[MG] settings update scan error:", e));
    }
  }
  
  if (message.action === 'cacheCleared') {
    console.log("[MG] Cache cleared");
  }
});

// Function to remove blur from all previously blurred content
function unblurAllContent() {
  try {
    // Find all elements that might have been blurred
    const blurredElements = document.querySelectorAll('[style*="blur"]');
    blurredElements.forEach(element => {
      // Remove blur filter
      if (element.style.filter && element.style.filter.includes('blur')) {
        element.style.filter = element.style.filter.replace(/blur\([^)]*\)/g, '').trim();
        if (!element.style.filter) {
          element.style.removeProperty('filter');
        }
      }
      // Remove title attribute that shows blur reason
      if (element.title && element.title.includes('Hidden:')) {
        element.removeAttribute('title');
      }
    });
    
    // Also try to find elements blurred by the blur utility if it exists
    if (window.MGBlur && typeof window.MGBlur.unblurAll === "function") {
      window.MGBlur.unblurAll();
    }
    
    console.log("[MG] Unblurred all content");
  } catch (err) {
    console.error("[MG] Error unblurring content:", err);
  }
}
