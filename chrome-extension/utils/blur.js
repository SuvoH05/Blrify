// utils/blur.js

function blurElement(el, label, score) {
  el.style.transition = 'filter 250ms ease';
  el.style.filter = 'blur(45px) grayscale(40%)';
  el.style.pointerEvents = 'none';

  let overlay = el.querySelector('.misinfo-guardian-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'misinfo-guardian-overlay';
    overlay.innerHTML = `
      <div class="mg-overlay-inner">
        <div class="mg-text">Flagged: ${label}</div>
        <button class="mg-reveal-btn">Reveal</button>
      </div>
    `;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    Object.assign(overlay.style, {
      position: 'absolute',
      inset: '0',
      background: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      color: 'white',
      zIndex: 9999
    });
    el.appendChild(overlay);

    overlay.querySelector('.mg-reveal-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      el.style.filter = '';
      el.style.pointerEvents = '';
      overlay.remove();
    });
  }
}

function muteMedia(el) {
  const vids = el.querySelectorAll('video, audio');
  vids.forEach(v => { v.muted = true; });
}

if (typeof window !== 'undefined') {
  window.MGBlur = { blurElement, muteMedia };
} else if (typeof self !== 'undefined') {
  self.MGBlur = { blurElement, muteMedia };
}
