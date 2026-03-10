// firebase.js — Comunidad Global de Fans de Conejo Malo
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDpFAL7wX__ee1bmbr25A81IBuWEnpq970",
  authDomain:        "conejomalo-global.firebaseapp.com",
  projectId:         "conejomalo-global",
  storageBucket:     "conejomalo-global.firebasestorage.app",
  messagingSenderId: "886224291739",
  appId:             "1:886224291739:web:f54c336ac7ea4e3512c33e",
  measurementId:     "G-F07TTHFS7K"
};

export const app = initializeApp(firebaseConfig);
