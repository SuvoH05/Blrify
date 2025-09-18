// background.js (service worker)

const PERSPECTIVE_API_KEY = CONFIG.PERSPECTIVE_API_KEY;
const PERSPECTIVE_URL =
  "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=" + PERSPECTIVE_API_KEY;

// Normalize text a bit on the background side as well
function normalizeTextForApi(t) {
  if (!t) return "";
  return t
    .replace(/\u200B/g, "")   // remove zero-width
    .replace(/\u200C/g, "")
    .replace(/\u200D/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Call Perspective API and return array of { label, score }
async function classifyWithPerspective(text) {
  const normalized = normalizeTextForApi(text).slice(0, 10000); // API safe limit
  const body = {
    comment: { text: normalized },
    languages: ["en"],
    requestedAttributes: {
      TOXICITY: {},
      SEVERE_TOXICITY: {},
      INSULT: {},
      THREAT: {},
      PROFANITY: {},
      IDENTITY_ATTACK: {},
      SEXUALLY_EXPLICIT: {}
    }
  };

  const resp = await fetch(PERSPECTIVE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Perspective API error: ${resp.status} ${resp.statusText} ${txt}`);
  }

  const data = await resp.json();
  // data.attributeScores could be undefined if API returns weird result
  if (!data || !data.attributeScores) {
    return [];
  }

  // Map to [{ label, score }]
  const labels = Object.entries(data.attributeScores).map(([k, v]) => {
    // summaryScore may exist at v.summaryScore.value
    const score = v && v.summaryScore && typeof v.summaryScore.value === "number"
      ? v.summaryScore.value
      : 0;
    return { label: k, score };
  });

  return labels;
}

// Message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.action !== "CLASSIFY_TEXT" || !msg.text) {
    // ignore unknown messages quickly
    return false;
  }

  (async () => {
    try {
      console.log("[BG] CLASSIFY_TEXT received (truncated):", String(msg.text).slice(0, 200));
      const labels = await classifyWithPerspective(msg.text);
      console.log("[BG] Perspective labels:", labels);
      // Always return { ok: true, labels: [...] }
      sendResponse({ ok: true, labels });
    } catch (err) {
      console.error("[BG] classify error:", err);
      sendResponse({ ok: false, error: String(err), labels: [] });
    }
  })();

  // IMPORTANT: keep the message channel open for async sendResponse
  return true;
});
