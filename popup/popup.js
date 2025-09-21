document.addEventListener('DOMContentLoaded', function() {
  // Initialize all components
  initDarkMode();
  initControls();
  initPinSystem();
  loadSettings();
  setupEventListeners();
});

// PIN System Variables
let securityPin = null;
let isPinProtected = false;

// Dark mode functionality
function initDarkMode() {
  const darkModeToggle = document.getElementById('dark_mode');

  // Check system preference
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  chrome.storage.sync.get(['darkMode'], (result) => {
    const isDarkMode = result.darkMode !== undefined ? result.darkMode : systemPrefersDark;
    if (darkModeToggle) {
      darkModeToggle.checked = isDarkMode;
    }
    applyDarkMode(isDarkMode);
  });

  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', (e) => {
      const isDarkMode = e.target.checked;
      applyDarkMode(isDarkMode);
      chrome.storage.sync.set({ darkMode: isDarkMode });
    });
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    chrome.storage.sync.get(['darkMode'], (result) => {
      if (result.darkMode === undefined) {
        const isDarkMode = e.matches;
        if (darkModeToggle) darkModeToggle.checked = isDarkMode;
        applyDarkMode(isDarkMode);
      }
    });
  });
}

function applyDarkMode(isDark) {
  document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

// Initialize PIN system
function initPinSystem() {
  chrome.storage.sync.get(['securityPin'], (result) => {
    securityPin = result.securityPin;
    isPinProtected = !!securityPin;
    updatePinUI();
  });
}

function updatePinUI() {
  const pinSetupSection = document.getElementById('pin_setup_section');
  const pinChangeSection = document.getElementById('pin_change_section');
  if (pinSetupSection) pinSetupSection.style.display = 'none';
  if (pinChangeSection) pinChangeSection.style.display = 'none';
}

// Hash PIN for security
async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Set new PIN from modal
async function setPin() {
  const pinInput = document.getElementById('modal_pin');
  const pin = pinInput.value.trim();

  if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    showPinError('PIN must be exactly 6 digits');
    return;
  }

  const hashedPin = await hashPin(pin);
  chrome.storage.sync.set({ securityPin: hashedPin }, () => {
    securityPin = hashedPin;
    isPinProtected = true;
    document.getElementById('pin_modal').style.display = 'none';
    document.getElementById('extension_toggle').checked = false;
    saveSettings();
    showSuccess('PIN set and extension turned OFF!');
  });
}

// Show PIN modal when trying to turn off extension
function showPinModal() {
  const modal = document.getElementById('pin_modal');
  const modalContent = modal.querySelector('.modal-content');

  if (!isPinProtected) {
    modalContent.innerHTML = `
      <h3>Set PIN to Turn OFF Extension</h3>
      <input type="password" id="modal_pin" placeholder="Enter 6-digit PIN" maxlength="6" />
      <div class="modal-actions">
        <button id="confirm_pin_btn">Set PIN & Turn OFF</button>
        <button id="cancel_pin_btn">Cancel</button>
      </div>
      <div id="pin_error" class="error-message"></div>
    `;

    document.getElementById('confirm_pin_btn').addEventListener('click', setPin);
    document.getElementById('cancel_pin_btn').addEventListener('click', closePinModal);
  } else {
    modalContent.innerHTML = `
      <h3>Enter PIN to Turn OFF Extension</h3>
      <input type="password" id="modal_pin" placeholder="Enter 6-digit PIN" maxlength="6" />
      <div class="modal-actions">
        <button id="confirm_pin_btn">Confirm</button>
        <button id="cancel_pin_btn">Cancel</button>
      </div>
      <div id="pin_error" class="error-message"></div>
    `;

    document.getElementById('confirm_pin_btn').addEventListener('click', verifyPin);
    document.getElementById('cancel_pin_btn').addEventListener('click', closePinModal);
  }

  modal.style.display = 'block';
  document.getElementById('modal_pin').value = '';
  document.getElementById('pin_error').style.display = 'none';
  document.getElementById('modal_pin').focus();
  return false;
}

// Verify PIN from modal
async function verifyPin() {
  const modalPinInput = document.getElementById('modal_pin');
  const pin = modalPinInput.value.trim();

  if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    showPinError('PIN must be 6 digits');
    return;
  }

  const hashedPin = await hashPin(pin);
  if (hashedPin === securityPin) {
    document.getElementById('pin_modal').style.display = 'none';
    document.getElementById('extension_toggle').checked = false;
    saveSettings();
  } else {
    showPinError('Incorrect PIN');
    modalPinInput.value = '';
  }
}

function showPinError(message) {
  const errorDiv = document.getElementById('pin_error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function closePinModal() {
  document.getElementById('pin_modal').style.display = 'none';
  document.getElementById('extension_toggle').checked = true;
}

// Initialize form controls
function initControls() {
  const thresholdSlider = document.getElementById('threshold');
  const thresholdValue = document.getElementById('th_val');
  if (thresholdSlider && thresholdValue) {
    thresholdSlider.addEventListener('input', function() {
      thresholdValue.textContent = parseFloat(this.value).toFixed(2);
    });
  }
}

// Load saved settings
function loadSettings() {
  chrome.storage.sync.get([
    'extensionEnabled',
    'useApi',
    'hfToken',
    'threshold',
    'enabledCategories'
  ], function(result) {
    const extensionEnabled = result.extensionEnabled !== undefined ? result.extensionEnabled : true;
    document.getElementById('extension_toggle').checked = extensionEnabled;

    const useApiEl = document.getElementById('use_api');
    if (useApiEl && result.useApi !== undefined) {
      useApiEl.checked = result.useApi;
    }

    const hfTokenEl = document.getElementById('hf_token');
    if (hfTokenEl && result.hfToken) {
      hfTokenEl.value = result.hfToken;
    }

    if (result.threshold !== undefined) {
      const threshold = result.threshold;
      document.getElementById('threshold').value = threshold;
      document.getElementById('th_val').textContent = parseFloat(threshold).toFixed(2);
    }

    const enabledCategories = result.enabledCategories || [
      'misinformation', 'violence', 'sexual', 'politics', 'family-restricted'
    ];
    document.querySelectorAll('[data-cat]').forEach(checkbox => {
      const category = checkbox.getAttribute('data-cat');
      checkbox.checked = enabledCategories.includes(category);
    });
  });
}

// Setup event listeners
function setupEventListeners() {
  const extToggle = document.getElementById('extension_toggle');
  if (extToggle) {
    extToggle.addEventListener('change', (e) => {
      if (!e.target.checked) {
        e.preventDefault();
        if (!showPinModal()) {
          e.target.checked = true;
          return;
        }
      }
      debounce(saveSettings, 500)();
    });
  }

  document.getElementById('pin_modal').addEventListener('click', (e) => {
    if (e.target.id === 'pin_modal') {
      closePinModal();
    }
  });

  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('clearCacheBtn').addEventListener('click', clearCache);

  const useApiCheckbox = document.getElementById('use_api');
  if (useApiCheckbox) {
    useApiCheckbox.addEventListener('change', debounce(saveSettings, 500));
  }

  const hfTokenInput = document.getElementById('hf_token');
  if (hfTokenInput) {
    hfTokenInput.addEventListener('input', debounce(saveSettings, 500));
  }

  document.querySelectorAll('[data-cat]').forEach(checkbox => {
    checkbox.addEventListener('change', debounce(saveSettings, 500));
  });
}

// Save all settings
function saveSettings() {
  const extensionEnabled = document.getElementById('extension_toggle').checked;

  const useApiEl = document.getElementById('use_api');
  const useApi = useApiEl ? useApiEl.checked : false;

  const hfTokenEl = document.getElementById('hf_token');
  const hfToken = hfTokenEl ? hfTokenEl.value.trim() : "";

  const threshold = parseFloat(document.getElementById('threshold').value);

  const enabledCategories = [];
  document.querySelectorAll('[data-cat]:checked').forEach(checkbox => {
    enabledCategories.push(checkbox.getAttribute('data-cat'));
  });

  chrome.storage.sync.set({
    extensionEnabled,
    useApi,
    hfToken,
    threshold,
    enabledCategories
  }, function() {
    showSaveNotification();
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'settingsUpdated',
          settings: { extensionEnabled, useApi, hfToken, threshold, enabledCategories }
        });
      }
    });
  });
}

// Clear cache
function clearCache() {
  chrome.storage.local.clear(function() {
    showClearNotification();
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'cacheCleared' });
      }
    });
  });
}

// Notifications
function showSaveNotification() {
  const saveBtn = document.getElementById('saveBtn');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'Saved!';
  saveBtn.style.backgroundColor = '#28a745';
  setTimeout(() => {
    saveBtn.textContent = originalText;
    saveBtn.style.backgroundColor = '';
  }, 1500);
}

function showClearNotification() {
  const clearBtn = document.getElementById('clearCacheBtn');
  const originalText = clearBtn.textContent;
  clearBtn.textContent = 'Cleared!';
  clearBtn.style.backgroundColor = '#28a745';
  setTimeout(() => {
    clearBtn.textContent = originalText;
    clearBtn.style.backgroundColor = '';
  }, 1500);
}

function showError(message) {
  alert(message);
}
function showSuccess(message) {
  alert(message);
}

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

window.addEventListener('error', function(e) {
  console.error('Popup error:', e.error);
});
