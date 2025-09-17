// content.js
console.log('[Misinfo Guardian] content script loaded');

const PROCESSED_FLAG = '__misinfo_guardian_processed__';

// Observe page changes (for infinite scroll pages)
const observer = new MutationObserver(mutations => {
  for (const m of mutations) {
    scanAndProcess();
  }
});
observer.observe(document.body, { childList: true, subtree: true });

// initial scan
window.addEventListener('load', scanAndProcess);
setTimeout(scanAndProcess, 1500);

// Basic function: find candidate post elements
function findCandidateNodes() {
  // Heuristic: articles, posts, or divs with paragraphs
  const candidates = new Set();

  // elements commonly used: article, [role="article"], .post, .tweet, .status
  document.querySelectorAll('article, [role="article"], .post, .tweet, .status, .feed-item, .stream-item, .ytd-video-renderer').forEach(el => candidates.add(el));

  // fallback: any div with multiple paragraphs
  document.querySelectorAll('div').forEach(div => {
    if (div.querySelectorAll('p').length >= 1 && div.innerText && div.innerText.length > 80) {
      candidates.add(div);
    }
  });

  return Array.from(candidates);
}

function extractReadableText(node) {
  // pick text from paragraphs and headings within node
  const texts = [];
  node.querySelectorAll('p, span, h1, h2, h3, .tweet-text, .content').forEach(el => {
    const t = el.innerText && el.innerText.trim();
    if (t && t.length > 10) texts.push(t);
  });
  // if empty, fallback to node.innerText
  if (texts.length === 0) {
    const all = node.innerText && node.innerText.trim();
    if (all && all.length > 40) texts.push(all);
  }
  return texts.join('\n').slice(0, 4000);
}

async function scanAndProcess() {
  const nodes = findCandidateNodes();
  for (const node of nodes) {
    if (node[PROCESSED_FLAG]) continue;
    node[PROCESSED_FLAG] = true;

    const text = extractReadableText(node);
    if (!text || text.length < 30) continue;

    // ask background to classify
    chrome.runtime.sendMessage({ type: 'CLASSIFY_TEXT', text }, (resp) => {
      if (!resp || resp.error) {
        // console.warn('classification error', resp && resp.error);
        return;
      }
      const labels = resp.labels || [];
      applyDecision(node, labels);
    });
  }
}

function applyDecision(node, labels) {
  if (!Array.isArray(labels) || labels.length === 0) return;

  // get settings
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, settings => {
    const enabled = settings.enabled_categories || {};
    const threshold = settings.confidence_threshold || 0.7;

    // check labels vs enabled categories
    for (const lab of labels) {
      if (!lab || !lab.label) continue;
      const label = lab.label.toLowerCase();
      const score = lab.score || 0;

      if (enabled[label] && score >= threshold) {
        // apply blur + mute
        blurElement(node, label, score);
        muteMedia(node);
        // log event visually by appending a small banner
        addFlagBanner(node, label, score);
        break; // apply once per element
      }
    }
  });
}

function blurElement(el, label, score) {
  try {
    el.style.transition = 'filter 250ms ease, opacity 200ms';
    el.style.filter = 'blur(8px) grayscale(40%)';
    el.style.pointerEvents = 'none'; // prevent clicks through blurred content

    // overlay with reveal button
    let overlay = el.querySelector('.misinfo-guardian-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'misinfo-guardian-overlay';
      overlay.innerHTML = `
        <div class="mg-overlay-inner">
          <div class="mg-text">Content hidden — flagged: ${escapeHtml(label)}</div>
          <button class="mg-reveal-btn">Reveal</button>
        </div>
      `;
      Object.assign(overlay.style, {
        position: 'absolute',
        inset: '0',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'auto'
      });

      // position overlay relative to element
      if (getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
      }
      el.appendChild(overlay);

      overlay.querySelector('.mg-reveal-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        // temporarily unblur
        el.style.filter = '';
        el.style.pointerEvents = '';
        overlay.remove();
      });
    }
    // minimal style insertion (if not yet present)
    injectOverlayCSS();
  } catch (e) {
    console.error('blurElement error', e);
  }
}

function muteMedia(el) {
  try {
    const vids = el.querySelectorAll('video, audio');
    vids.forEach(v => {
      try {
        v.muted = true;
        if (!v.paused && v.tagName.toLowerCase() === 'video') {
          // keep playing but muted
        }
      } catch (e) {}
    });
  } catch (e) {
    console.error('muteMedia error', e);
  }
}

function addFlagBanner(el, label, score) {
  try {
    if (el.querySelector('.misinfo-flag-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'misinfo-flag-banner';
    banner.innerText = `Misinfo Guardian — flagged: ${label} (${Math.round((score||0)*100)}%)`;
    Object.assign(banner.style, {
      position: 'absolute',
      top: '6px',
      right: '6px',
      background: 'rgba(0,0,0,0.6)',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '12px',
      zIndex: 99999,
      pointerEvents: 'none'
    });
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(banner);
  } catch (e) {
    console.error('addFlagBanner error', e);
  }
}

/* small helpers */
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

let cssInjected = false;
function injectOverlayCSS() {
  if (cssInjected) return;
  cssInjected = true;
  const css = `
  .misinfo-guardian-overlay { 
    background: linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.35));
    color: white; text-align:center; z-index: 99998;
  }
  .misinfo-guardian-overlay .mg-overlay-inner { 
    display:flex; flex-direction:column; gap:8px; align-items:center; 
    padding: 12px 16px; border-radius: 8px;
  }
  .misinfo-guardian-overlay .mg-reveal-btn {
    padding: 6px 10px; border-radius:6px; border:none; cursor:pointer;
    font-weight:600;
  }`;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
}
