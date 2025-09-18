// utils/storage.js

const DEFAULT_SETTINGS = {
  hf_token: '',
  enabled_categories: {
    misinformation: true,
    violence: true,
    sexual: true,
    politics: true,
    "family-restricted": true
  },
  confidence_threshold: 0.7,
  use_api: false
};

function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, resolve);
  });
}

function saveSettings(settings) {
  return new Promise(resolve => {
    chrome.storage.sync.set(settings, resolve);
  });
}

if (typeof window !== 'undefined') {
  window.MGStorage = { getSettings, saveSettings, DEFAULT_SETTINGS };
} else if (typeof self !== 'undefined') {
  self.MGStorage = { getSettings, saveSettings, DEFAULT_SETTINGS };
}
