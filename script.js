window.openModal = function () {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
  setTimeout(() => document.getElementById("email")?.focus(), 300);
};

window.closeModal = function () {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  modal.classList.remove("active");
  document.body.style.overflow = "";
};

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("authModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

window.toggleMenu = function () {
  document.querySelector(".nav-links")?.classList.toggle("open");
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-links a").forEach(link => {
    link.addEventListener("click", () => {
      document.querySelector(".nav-links")?.classList.remove("open");
    });
  });
});

window.addEventListener("scroll", () => {
  const nav = document.querySelector(".navbar");
  if (!nav) return;
  nav.style.background = window.scrollY > 60
    ? "rgba(0,0,0,0.65)"
    : "rgba(0,0,0,0.35)";
});

document.addEventListener("DOMContentLoaded", () => {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add("visible");
    }),
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
});
