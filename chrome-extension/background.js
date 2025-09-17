// background.js (MV3 service worker)
importScripts && importScripts(); // no-op; keeps linter quiet

const CACHE = {}; // simple in-memory cache for this service worker lifetime

// Default categories and labels for zero-shot / keyword mapping
const CATEGORY_LABELS = ["misinformation", "violence", "sexual", "politics", "family-restricted", "safe"];

// Helper: simple keyword fallback mapping
const KEYWORD_MAP = {
  "violence": ["kill", "murder", "beat", "assault", "blood", "rape", "shoot", "war"],
  "sexual": ["porn", "sex", "nude", "naked", "xxx"],
  "politics": ["election", "vote", "president", "government", "campaign", "congress", "senate"],
  "misinformation": ["miracle cure", "100% guaranteed", "hoax", "conspiracy", "fake news", "deepfake", "false"],
  "family-restricted": ["abuse", "child", "child abuse", "incest"]
};

// Rate limiter
let lastCallTime = 0;
const MIN_INTERVAL_MS = 400; // a mild throttle

// Receives messages from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CLASSIFY_TEXT') {
    handleClassify(msg.text, msg.max_labels || 3, msg.threshold || 0.7).then(res => {
      sendResponse(res);
    }).catch(err => {
      console.error('classification error', err);
      sendResponse({ error: err.message || String(err) });
    });
    return true; // indicates async response
  } else if (msg.type === 'GET_SETTINGS') {
    chrome.storage.sync.get({
      hf_token: '',
      enabled_categories: { misinformation: true, violence: true, sexual: true, politics: true, "family-restricted": true },
      confidence_threshold: 0.7,
      use_api: false
    }, (items) => sendResponse(items));
    return true;
  }
});

// Main classify handler
async function handleClassify(text, max_labels = 3, threshold = 0.7) {
  if (!text || text.trim().length === 0) return { labels: [] };

  const cacheKey = text.slice(0, 500);
  if (CACHE[cacheKey]) return CACHE[cacheKey];

  // Try API if token exists and user enabled use_api
  const settings = await new Promise(resolve => {
    chrome.storage.sync.get({ hf_token: '', use_api: false }, resolve);
  });

  let result = null;
  if (settings.use_api && settings.hf_token) {
    try {
      result = await hfZeroShot(text, settings.hf_token, max_labels);
    } catch (e) {
      console.warn('HF API failed, falling back to keywords', e);
      result = keywordDetect(text, threshold);
    }
  } else {
    result = keywordDetect(text, threshold);
  }

  CACHE[cacheKey] = result;
  return result;
}

// Hugging Face zero-shot using NLI model (server-side style)
async function hfZeroShot(text, token, max_labels = 3) {
  // Rate limit
  const now = Date.now();
  if (now - lastCallTime < MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, MIN_INTERVAL_MS));
  }
  lastCallTime = Date.now();

  // Using facebook/bart-large-mnli model for NLI-based zero-shot
  const modelEndpoint = "https://huggingface.co/facebook/bart-large-mnli";
  const payload = {
    inputs: text,
    parameters: {
      candidate_labels: CATEGORY_LABELS.join(","),
      hypothesis_template: "This example is {}."
    }
  };

  const resp = await fetch(modelEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const textErr = await resp.text();
    throw new Error(`HF error ${resp.status}: ${textErr}`);
  }

  const data = await resp.json();
  // data: { labels: [...], scores: [...] }
  const pairs = (data.labels || []).map((label, i) => ({ label, score: data.scores[i] }));
  pairs.sort((a,b) => b.score - a.score);
  return { labels: pairs.slice(0, max_labels) };
}

// Simple keyword detector fallback
function keywordDetect(text, threshold = 0.7) {
  const found = [];
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
    let hits = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) hits++;
    }
    if (hits > 0) {
      // simplistic confidence: hits / keyword count
      const confidence = Math.min(1, hits / Math.max(1, keywords.length));
      found.push({ label: category, score: confidence });
    }
  }
  // sort descending
  found.sort((a,b)=>b.score-a.score);
  return { labels: found };
}
