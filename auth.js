// auth.js — Comunidad Global de Fans de Conejo Malo
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { app } from "./firebase.js";

const auth = getAuth(app);

window.register = function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) { alert("Please enter email and password."); return; }
  createUserWithEmailAndPassword(auth, email, password)
    .then(() => { closeModal(); window.location.href = "community.html"; })
    .catch(err => alert("❌ Registration error: " + err.message));
};

window.login = function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) { alert("Please enter email and password."); return; }
  signInWithEmailAndPassword(auth, email, password)
    .then(() => { closeModal(); window.location.href = "community.html"; })
    .catch(err => alert("❌ Login error: " + err.message));
};

window.logout = function () {
  signOut(auth)
    .then(() => { alert("👋 Logged out!"); window.location.href = "index.html"; })
    .catch(err => alert("❌ Logout error: " + err.message));
};

onAuthStateChanged(auth, user => {
  const status = document.getElementById("status");
  const logoutBtn = document.getElementById("logoutBtn");
  if (user) {
    if (status) status.textContent = "✅ Logged in as: " + user.email;
    if (logoutBtn) logoutBtn.style.display = "inline-block";
  } else {
    if (status) status.textContent = "Not logged in";
    if (logoutBtn) logoutBtn.style.display = "none";
  }
});
