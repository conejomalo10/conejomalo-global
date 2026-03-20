// ═══════════════════════════════════════════════════
//  PWA — Comunidad Global de Fans de Conejo Malo
//  Install prompt + Service Worker registration
// ═══════════════════════════════════════════════════

(function() {
  'use strict';

  let deferredPrompt = null;

  // ── CREATE INSTALL BANNER ──
  function createInstallBanner() {
    // Don't create twice
    if (document.getElementById('pwaInstallBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwaInstallBanner';
    banner.style.cssText = `
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: 99998;
      background: linear-gradient(135deg, #1a0533 0%, #2d0a5e 100%);
      border-top: 1px solid rgba(255,75,241,0.40);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 -4px 30px rgba(0,0,0,0.60);
      transform: translateY(100%);
      transition: transform 0.4s ease;
    `;

    banner.innerHTML = `
      <div style="font-size:36px;flex-shrink:0;line-height:1">🐰</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:'Montserrat',sans-serif;font-size:13px;font-weight:800;color:#fff;margin-bottom:2px">
          Install Conejo Malo App
        </div>
        <div style="font-family:'Montserrat',sans-serif;font-size:11px;color:rgba(255,255,255,0.55);line-height:1.4">
          Add to your home screen for quick access — works offline too!
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0">
        <button id="pwaInstallBtn" style="
          background: linear-gradient(135deg, #ff0066, #ff4bf1);
          border: none; border-radius: 999px;
          color: #fff; font-family: 'Montserrat', sans-serif;
          font-size: 12px; font-weight: 800;
          padding: 9px 16px; cursor: pointer;
          white-space: nowrap; touch-action: manipulation;
        ">📲 Install</button>
        <button id="pwaDismissBtn" style="
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 999px; color: rgba(255,255,255,0.55);
          font-family: 'Montserrat', sans-serif;
          font-size: 12px; font-weight: 700;
          padding: 9px 12px; cursor: pointer;
          touch-action: manipulation;
        ">✕</button>
      </div>
    `;

    document.body.appendChild(banner);

    // Slide up after short delay
    setTimeout(() => {
      banner.style.transform = 'translateY(0)';
    }, 100);

    // Install button
    document.getElementById('pwaInstallBtn').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      banner.style.transform = 'translateY(100%)';
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('PWA installed ✅');
        showInstallSuccess();
      }
      deferredPrompt = null;
      setTimeout(() => banner.remove(), 500);
    });

    // Dismiss button
    document.getElementById('pwaDismissBtn').addEventListener('click', () => {
      banner.style.transform = 'translateY(100%)';
      setTimeout(() => banner.remove(), 400);
      // Don't show again for 3 days
      localStorage.setItem('pwa_dismissed', Date.now().toString());
    });
  }

  // ── SHOW SUCCESS TOAST ──
  function showInstallSuccess() {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 24px; left: 50%;
      transform: translateX(-50%);
      background: rgba(0,255,136,0.15);
      border: 1px solid rgba(0,255,136,0.40);
      border-radius: 999px; padding: 12px 24px;
      font-family: 'Montserrat', sans-serif;
      font-size: 14px; font-weight: 700; color: #00ff88;
      z-index: 99999; white-space: nowrap;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    `;
    toast.textContent = '✅ App installed! Check your home screen 🐰';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // ── LISTEN FOR INSTALL PROMPT ──
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Don't show if dismissed recently (within 3 days)
    const dismissed = localStorage.getItem('pwa_dismissed');
    if (dismissed) {
      const daysSince = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);
      if (daysSince < 3) return;
    }

    // Don't show if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Show banner after 3 seconds
    setTimeout(createInstallBanner, 3000);
  });

  // ── ALREADY INSTALLED ──
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) banner.remove();
    console.log('PWA installed successfully');
  });

  // ── iOS SAFARI SPECIFIC PROMPT ──
  // iOS doesn't fire beforeinstallprompt — show manual instructions
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }
  function isInStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  if (isIOS() && !isInStandaloneMode()) {
    const dismissed = localStorage.getItem('ios_pwa_dismissed');
    if (!dismissed || (Date.now() - parseInt(dismissed)) > 3 * 24 * 60 * 60 * 1000) {
      setTimeout(() => {
        const banner = document.createElement('div');
        banner.id = 'iosPwaBanner';
        banner.style.cssText = `
          position: fixed; bottom: 0; left: 0; right: 0;
          z-index: 99998;
          background: linear-gradient(135deg, #1a0533, #2d0a5e);
          border-top: 1px solid rgba(255,75,241,0.40);
          padding: 16px; text-align: center;
          box-shadow: 0 -4px 30px rgba(0,0,0,0.60);
          transform: translateY(100%);
          transition: transform 0.4s ease;
        `;
        banner.innerHTML = `
          <div style="font-size:28px;margin-bottom:8px">🐰📲</div>
          <div style="font-family:'Montserrat',sans-serif;font-size:13px;font-weight:800;color:#fff;margin-bottom:6px">
            Install Conejo Malo App
          </div>
          <div style="font-family:'Montserrat',sans-serif;font-size:12px;color:rgba(255,255,255,0.65);line-height:1.6;margin-bottom:14px">
            Tap <strong style="color:#fff">Share</strong> <span style="font-size:16px">⎋</span> then
            <strong style="color:#fff">"Add to Home Screen"</strong> <span style="font-size:16px">➕</span>
          </div>
          <button onclick="
            this.closest('#iosPwaBanner').style.transform='translateY(100%)';
            setTimeout(()=>this.closest('#iosPwaBanner').remove(),400);
            localStorage.setItem('ios_pwa_dismissed','${Date.now()}');
          " style="
            background: rgba(255,255,255,0.10);
            border: 1px solid rgba(255,255,255,0.20);
            border-radius: 999px; color: rgba(255,255,255,0.65);
            font-family: 'Montserrat', sans-serif;
            font-size: 12px; font-weight: 700;
            padding: 8px 20px; cursor: pointer;
          ">Got it ✓</button>
        `;
        document.body.appendChild(banner);
        setTimeout(() => { banner.style.transform = 'translateY(0)'; }, 100);
      }, 4000);
    }
  }

  // ── SERVICE WORKER REGISTRATION ──
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SW registered ✅', reg.scope))
        .catch(err => console.log('SW registration skipped:', err.message));
    });
  }

})();
