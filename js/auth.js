import { auth } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

function getVal(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function showStatus(msg, isError = false) {
  const el = document.getElementById("status");
  if (!el) return;
  el.innerText = msg;
  el.style.color = isError ? "#ff6b6b" : "rgba(255,255,255,0.72)";
}

function setLogout(show) {
  const btn = document.getElementById("logoutBtn");
  if (btn) btn.style.display = show ? "inline-block" : "none";
}

function validate(email, password) {
  if (!email || !password) {
    showStatus("⚠️ Please enter your email and password.", true);
    return false;
  }
  if (password.length < 6) {
    showStatus("⚠️ Password must be at least 6 characters.", true);
    return false;
  }
  return true;
}

window.register = async function () {
  const email    = getVal("email");
  const password = getVal("password");
  if (!validate(email, password)) return;
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    closeModal();
    showStatus("✅ Welcome! You are now registered.");
  } catch (e) {
    showStatus("❌ " + friendlyError(e.code), true);
  }
};

window.login = async function () {
  const email    = getVal("email");
  const password = getVal("password");
  if (!validate(email, password)) return;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    closeModal();
    showStatus("✅ Welcome back!");
  } catch (e) {
    showStatus("❌ " + friendlyError(e.code), true);
  }
};

window.logout = function () {
  signOut(auth).then(() => showStatus("👋 Logged out successfully."));
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    showStatus("✅ Logged in as " + user.email);
    setLogout(true);
  } else {
    showStatus("Not logged in");
    setLogout(false);
  }
});

function friendlyError(code) {
  const map = {
    "auth/email-already-in-use":   "That email is already registered. Try logging in.",
    "auth/invalid-email":          "Please enter a valid email address.",
    "auth/weak-password":          "Password must be at least 6 characters.",
    "auth/user-not-found":         "No account found with that email.",
    "auth/wrong-password":         "Incorrect password. Please try again.",
    "auth/too-many-requests":      "Too many attempts. Please wait a moment.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/invalid-credential":     "Invalid email or password. Please try again.",
  };
  return map[code] || "Something went wrong. Please try again.";
}
