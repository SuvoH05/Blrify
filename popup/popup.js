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
  
  // Load saved preference or use system preference
  chrome.storage.sync.get(['darkMode'], (result) => {
    const isDarkMode = result.darkMode !== undefined ? result.darkMode : systemPrefersDark;
    
    darkModeToggle.checked = isDarkMode;
    applyDarkMode(isDarkMode);
  });
  
  // Listen for toggle changes
  darkModeToggle.addEventListener('change', (e) => {
    const isDarkMode = e.target.checked;
    applyDarkMode(isDarkMode);
    chrome.storage.sync.set({ darkMode: isDarkMode });
  });
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    chrome.storage.sync.get(['darkMode'], (result) => {
      // Only auto-switch if user hasn't manually set a preference
      if (result.darkMode === undefined) {
        const isDarkMode = e.matches;
        darkModeToggle.checked = isDarkMode;
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
  
  // Always hide PIN sections - they only appear in modal when turning OFF
  pinSetupSection.style.display = 'none';
  pinChangeSection.style.display = 'none';
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
  const modalPinInput = document.getElementById('modal_pin');
  const errorDiv = document.getElementById('pin_error');
  
  if (!isPinProtected) {
    // No PIN set - show setup modal
    modalContent.innerHTML = `
      <h3>Set PIN to Turn OFF Extension</h3>
      <input type="password" id="modal_pin" placeholder="Enter 6-digit PIN" maxlength="6" />
      <div class="modal-actions">
        <button id="confirm_pin_btn">Set PIN & Turn OFF</button>
        <button id="cancel_pin_btn">Cancel</button>
      </div>
      <div id="pin_error" class="error-message"></div>
      <small style="color: var(--text-secondary); margin-top: 10px; display: block;">
        You need to set a 6-digit PIN to turn OFF the extension for security.
      </small>
    `;
    
    // Re-attach event listeners for new buttons
    document.getElementById('confirm_pin_btn').addEventListener('click', setPin);
    document.getElementById('cancel_pin_btn').addEventListener('click', closePinModal);
    document.getElementById('modal_pin').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        setPin();
      }
    });
  } else {
    // PIN exists - show verification modal
    modalContent.innerHTML = `
      <h3>Enter PIN to Turn OFF Extension</h3>
      <input type="password" id="modal_pin" placeholder="Enter 6-digit PIN" maxlength="6" />
      <div class="modal-actions">
        <button id="confirm_pin_btn">Confirm</button>
        <button id="cancel_pin_btn">Cancel</button>
      </div>
      <div id="pin_error" class="error-message"></div>
    `;
    
    // Re-attach event listeners for new buttons
    document.getElementById('confirm_pin_btn').addEventListener('click', verifyPin);
    document.getElementById('cancel_pin_btn').addEventListener('click', closePinModal);
    document.getElementById('modal_pin').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        verifyPin();
      }
    });
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
    // Correct PIN, allow toggle
    document.getElementById('pin_modal').style.display = 'none';
    document.getElementById('extension_toggle').checked = false;
    saveSettings();
  } else {
    showPinError('Incorrect PIN');
    modalPinInput.value = '';
  }
}

// Show PIN error in modal
function showPinError(message) {
  const errorDiv = document.getElementById('pin_error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

// Close PIN modal
function closePinModal() {
  document.getElementById('pin_modal').style.display = 'none';
  // Reset toggle to ON position
  document.getElementById('extension_toggle').checked = true;
}

// Initialize form controls
function initControls() {
  const thresholdSlider = document.getElementById('threshold');
  const thresholdValue = document.getElementById('th_val');
  
  // Update threshold display
  thresholdSlider.addEventListener('input', function() {
    thresholdValue.textContent = parseFloat(this.value).toFixed(2);
  });
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
    // Load extension toggle (default to enabled)
    const extensionEnabled = result.extensionEnabled !== undefined ? result.extensionEnabled : true;
    document.getElementById('extension_toggle').checked = extensionEnabled;
    
    // Load API toggle
    if (result.useApi !== undefined) {
      document.getElementById('use_api').checked = result.useApi;
    }
    
    // Load HF token
    if (result.hfToken) {
      document.getElementById('hf_token').value = result.hfToken;
    }
    
    // Load threshold
    if (result.threshold !== undefined) {
      const threshold = result.threshold;
      document.getElementById('threshold').value = threshold;
      document.getElementById('th_val').textContent = parseFloat(threshold).toFixed(2);
    }
    
    // Load enabled categories
    const enabledCategories = result.enabledCategories || [
      'misinformation', 'violence', 'sexual', 'politics', 'family-restricted'
    ];
    
    const categoryCheckboxes = document.querySelectorAll('[data-cat]');
    categoryCheckboxes.forEach(checkbox => {
      const category = checkbox.getAttribute('data-cat');
      checkbox.checked = enabledCategories.includes(category);
    });
  });
}

// Setup event listeners
function setupEventListeners() {
  // Extension toggle with PIN protection
  document.getElementById('extension_toggle').addEventListener('change', (e) => {
    if (!e.target.checked) {
      // Trying to turn OFF - check for PIN
      e.preventDefault();
      if (!showPinModal()) {
        e.target.checked = true; // Reset if PIN modal shown
        return;
      }
    }
    // Allow turning ON without PIN
    debounce(saveSettings, 500)();
  });
  
  // Close modal on background click
  document.getElementById('pin_modal').addEventListener('click', (e) => {
    if (e.target.id === 'pin_modal') {
      closePinModal();
    }
  });
  
  // Save button
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  
  // Clear cache button
  document.getElementById('clearCacheBtn').addEventListener('click', clearCache);
  
  // Auto-save on changes
  const autoSaveElements = [
    'use_api',
    'hf_token',
    'threshold'
  ];
  
  autoSaveElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', debounce(saveSettings, 500));
    }
  });
  
  // Auto-save category changes
  const categoryCheckboxes = document.querySelectorAll('[data-cat]');
  categoryCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', debounce(saveSettings, 500));
  });
}

// Save all settings
function saveSettings() {
  const extensionEnabled = document.getElementById('extension_toggle').checked;
  const useApi = document.getElementById('use_api').checked;
  const hfToken = document.getElementById('hf_token').value.trim();
  const threshold = parseFloat(document.getElementById('threshold').value);
  
  // Get enabled categories
  const enabledCategories = [];
  const categoryCheckboxes = document.querySelectorAll('[data-cat]:checked');
  categoryCheckboxes.forEach(checkbox => {
    enabledCategories.push(checkbox.getAttribute('data-cat'));
  });
  
  // Save to storage
  chrome.storage.sync.set({
    extensionEnabled: extensionEnabled,
    useApi: useApi,
    hfToken: hfToken,
    threshold: threshold,
    enabledCategories: enabledCategories
  }, function() {
    // Visual feedback
    showSaveNotification();
    
    // Notify content script of changes
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'settingsUpdated',
          settings: {
            extensionEnabled: extensionEnabled,
            useApi: useApi,
            hfToken: hfToken,
            threshold: threshold,
            enabledCategories: enabledCategories
          }
        });
      }
    });
  });
}

// Clear cache
function clearCache() {
  chrome.storage.local.clear(function() {
    showClearNotification();
    
    // Notify content script
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'cacheCleared'
        });
      }
    });
  });
}

// Show save notification
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

// Show clear notification
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

// Show error message
function showError(message) {
  // You can implement a toast notification here
  alert(message);
}

// Show success message
function showSuccess(message) {
  // You can implement a toast notification here
  alert(message);
}

// Debounce function for auto-save
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Handle errors
window.addEventListener('error', function(e) {
  console.error('Popup error:', e.error);
});