import { initializeApp } from
"https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";

import { getAuth } from
"https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const firebaseConfig = {

apiKey: "YOUR_API_KEY",
authDomain: "conejomalo-global.firebaseapp.com",
projectId: "conejomalo-global",
storageBucket: "conejomalo-global.appspot.com",
messagingSenderId: "886224291739",
appId: "1:886224291739:web:f54c336ac7ea4e3512c33e"

};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
