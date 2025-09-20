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
      // debug: show scores if you want (commented out)
      // console.log("[MG] no labels above threshold. resp.labels:", resp.labels);
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
