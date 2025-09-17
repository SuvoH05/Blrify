// utils/classifier.js

const CATEGORY_LABELS = ["misinformation", "violence", "sexual", "politics", "family-restricted", "safe"];

const KEYWORD_MAP = {
  "violence": ["kill", "murder", "beat", "assault", "blood", "rape", "shoot", "war"],
  "sexual": ["porn", "sex", "nude", "naked", "xxx"],
  "politics": ["election", "vote", "president", "government", "campaign", "congress", "senate"],
  "misinformation": ["miracle cure", "100% guaranteed", "hoax", "conspiracy", "fake news", "deepfake", "false"],
  "family-restricted": ["abuse", "child", "child abuse", "incest"]
};

// Simple keyword detector
function keywordDetect(text, threshold = 0.7) {
  const found = [];
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
    let hits = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) hits++;
    }
    if (hits > 0) {
      const confidence = Math.min(1, hits / Math.max(1, keywords.length));
      found.push({ label: category, score: confidence });
    }
  }
  found.sort((a,b)=>b.score-a.score);
  return { labels: found };
}

// Hugging Face zero-shot
async function hfZeroShot(text, token, max_labels = 3) {
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

  if (!resp.ok) throw new Error(`HF error ${resp.status}`);

  const data = await resp.json();
  const pairs = (data.labels || []).map((label, i) => ({ label, score: data.scores[i] }));
  pairs.sort((a,b) => b.score - a.score);
  return { labels: pairs.slice(0, max_labels) };
}

if (typeof window !== 'undefined') {
  window.MGClassifier = { hfZeroShot, keywordDetect, CATEGORY_LABELS };
} else if (typeof self !== 'undefined') {
  self.MGClassifier = { hfZeroShot, keywordDetect, CATEGORY_LABELS };
}
