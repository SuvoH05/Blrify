// utils/classifier.js

const API_KEY = CONFIG.PERSPECTIVE_API_KEY;  
const API_URL = "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=" + API_KEY;

async function classifyText(text) {
  const requestBody = {
    comment: { text: text },
    languages: ["en"],
    requestedAttributes: {
      TOXICITY: {},
      INSULT: {},
      THREAT: {},
      PROFANITY: {}
    }
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!data.attributeScores) {
      console.warn("No scores returned:", data);
      return { labels: [] };
    }

    // Convert Perspective scores to { label, score }
    const labels = Object.keys(data.attributeScores).map(key => ({
      label: key.toLowerCase(),
      score: data.attributeScores[key].summaryScore.value
    }));

    return { labels };
  } catch (error) {
    console.error("Perspective API error:", error);
    return { labels: [] };
  }
}
