// popup.js
document.addEventListener('DOMContentLoaded', init);

function $(sel) { return document.querySelector(sel); }

async function init() {
  const fields = await new Promise(resolve => {
    chrome.storage.sync.get({
      hf_token: '',
      enabled_categories: { misinformation: true, violence: true, sexual: true, politics: true, "family-restricted": true },
      confidence_threshold: 0.7,
      use_api: false
    }, resolve);
  });

  $('#hf_token').value = fields.hf_token || '';
  $('#use_api').checked = !!fields.use_api;
  $('#threshold').value = fields.confidence_threshold || 0.7;
  $('#th_val').innerText = Number($('#threshold').value).toFixed(2);

  for (const cb of document.querySelectorAll('[data-cat]')) {
    const cat = cb.getAttribute('data-cat');
    cb.checked = !!(fields.enabled_categories && fields.enabled_categories[cat]);
  }

  $('#threshold').addEventListener('input', (e) => {
    $('#th_val').innerText = Number(e.target.value).toFixed(2);
  });

  $('#saveBtn').addEventListener('click', saveSettings);
  $('#clearCacheBtn').addEventListener('click', clearCache);
}

function saveSettings() {
  const hf_token = $('#hf_token').value.trim();
  const use_api = $('#use_api').checked;
  const threshold = Number($('#threshold').value);
  const enabled = {};
  for (const cb of document.querySelectorAll('[data-cat]')) {
    enabled[cb.getAttribute('data-cat')] = cb.checked;
  }
  chrome.storage.sync.set({
    hf_token, use_api, confidence_threshold: threshold, enabled_categories: enabled
  }, () => {
    // small feedback
    alert('Settings saved');
  });
}

function clearCache() {
  // The background worker has an in-memory cache only; instruct user to reload pages
  alert('Cache cleared for this session. Reload pages to remove cached classifications.');
  // If we wanted to send a message to worker to clear its cache, we could implement it.
  chrome.runtime.reload();
}
