// script.js — Comunidad Global de Fans de Conejo Malo

function toggleMenu() {
  document.querySelector('.nav-links').classList.toggle('open');
}
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

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// HERO IMAGE SLIDESHOW
const heroImgs = document.querySelectorAll('.hero-bg-img');
let currentImg = 0;
if (heroImgs.length > 0) {
  setInterval(() => {
    heroImgs[currentImg].style.opacity = '0';
    currentImg = (currentImg + 1) % heroImgs.length;
    heroImgs[currentImg].style.opacity = '0.60';
  }, 3500);
}
