// pwa.js — PWA Install Handler — Conejo Malo Global

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('✅ SW registered:', reg.scope))
      .catch(err => console.log('❌ SW error:', err));
  });
}

// Capture install prompt
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Show install card in sidebar
  const installCard = document.getElementById('installCard');
  if (installCard) installCard.style.display = 'block';
});

// Install button handler
window.installPWA = function() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(result => {
    if (result.outcome === 'accepted') {
      if (window.showToast) showToast('✅ App installed! Check your home screen!');
    }
    deferredPrompt = null;
    const installCard = document.getElementById('installCard');
    if (installCard) installCard.style.display = 'none';
  });
};

// Hide install card after install
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const installCard = document.getElementById('installCard');
  if (installCard) installCard.style.display = 'none';
  if (window.showToast) showToast('🎉 App installed successfully!');
});
