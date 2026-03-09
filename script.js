// script.js — Comunidad Global de Fans de Conejo Malo

// ---- HAMBURGER MENU ----
function toggleMenu() {
  document.querySelector('.nav-links').classList.toggle('open');
}

// ---- MODAL ----
function openModal() {
  document.getElementById('authModal').classList.add('active');
}
function closeModal() {
  document.getElementById('authModal').classList.remove('active');
}
document.getElementById('authModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ---- SCROLL REVEAL ----
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ---- HERO IMAGES SLIDESHOW ----
const heroImgs = document.querySelectorAll('.hero-bg-img');
let currentImg = 0;
if (heroImgs.length > 0) {
  heroImgs[0].style.opacity = '0.55';
  setInterval(() => {
    heroImgs[currentImg].style.opacity = '0.15';
    currentImg = (currentImg + 1) % heroImgs.length;
    heroImgs[currentImg].style.opacity = '0.55';
  }, 3000);
}
