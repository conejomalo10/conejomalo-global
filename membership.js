// membership.js — Membership Request System — Conejo Malo Global
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc,
  doc, query, where, orderBy, onSnapshot, serverTimestamp, setDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { app } from "./firebase.js";

const auth = getAuth(app);
const db   = getFirestore(app);

const ADMIN_EMAILS    = ["official.deconejomalo@gmail.com"];
let SUB_ADMIN_EMAILS = []; // Loaded from Firestore

let currentUser  = null;
let isAdmin      = false;
let isSubAdmin   = false;
let selectedTier = null;

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  MODAL OPEN / CLOSE
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.showMembershipModal = function() {
  const modal = document.getElementById('membershipModal');
  if (modal) { modal.classList.add('open'); goToStep(1); }
};

window.hideMembershipModal = function() {
  const modal = document.getElementById('membershipModal');
  if (modal) modal.classList.remove('open');
};

window.closeMembershipModal = function(e) {
  if (e.target.id === 'membershipModal') hideMembershipModal();
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  STEP NAVIGATION
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.goToStep = function(step) {
  [1,2,3,4].forEach(n => {
    const el = document.getElementById('modalStep' + n);
    if (el) el.style.display = n === step ? 'block' : 'none';
  });
  // Reset crypto dropdown on step change
  const dd = document.getElementById('cryptoDropdown');
  if (dd) dd.style.display = 'none';
  const arrow = document.getElementById('cryptoArrow');
  if (arrow) arrow.textContent = '▼';
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  TIER SELECTION → go to registration form
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.selectTier = function(tier) {
  selectedTier = tier;
  const icons = { VIP: '⭐ VIP', VVIP: '💎 VVIP', VVVIP: '👑 VVVIP' };

  // Pre-fill email if logged in
  if (currentUser) {
    const emailField = document.getElementById('regEmail');
    if (emailField && !emailField.value) emailField.value = currentUser.email;
  }

  const label1 = document.getElementById('selectedTierLabel');
  const label2 = document.getElementById('selectedTierLabel2');
  if (label1) label1.textContent = icons[tier] || tier;
  if (label2) label2.textContent = icons[tier] || tier;

  goToStep(2); // → Registration form
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  REGISTRATION FORM → validate → go to payment
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.goToStep = function(step) {
  // If going from step 2 to step 3, validate form first
  if (step === 3) {
    const firstName = document.getElementById('regFirstName')?.value?.trim();
    const lastName  = document.getElementById('regLastName')?.value?.trim();
    const country   = document.getElementById('regCountry')?.value;
    const email     = document.getElementById('regEmail')?.value?.trim();

    if (!firstName) { showToast('⚠️ Please enter your first name'); return; }
    if (!lastName)  { showToast('⚠️ Please enter your last name'); return; }
    if (!email)     { showToast('⚠️ Please enter your email'); return; }
    if (!email.includes('@')) { showToast('⚠️ Please enter a valid email'); return; }
    if (!country)   { showToast('⚠️ Please select your country'); return; }
    // Update selectedTierLabel2 in payment step
    const label2 = document.getElementById('selectedTierLabel2');
    if (label2) { const icons = { VIP:'⭐ VIP', VVIP:'💎 VVIP', VVVIP:'👑 VVVIP' }; label2.textContent = icons[selectedTier]||selectedTier; }
  }

  [1,2,3,4].forEach(n => {
    const el = document.getElementById('modalStep' + n);
    if (el) el.style.display = n === step ? 'block' : 'none';
  });

  const dd = document.getElementById('cryptoDropdown');
  if (dd) dd.style.display = 'none';
  const arrow = document.getElementById('cryptoArrow');
  if (arrow) arrow.textContent = '▼';
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  CRYPTO DROPDOWN
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.toggleCryptoMenu = function() {
  const dd    = document.getElementById('cryptoDropdown');
  const arrow = document.getElementById('cryptoArrow');
  if (!dd) return;
  const isOpen = dd.style.display === 'block';
  dd.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? '▼' : '▲';
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  SUBMIT MEMBERSHIP REQUEST
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.submitMembershipRequest = async function(paymentMethod) {
  if (!selectedTier) { showToast('⚠️ No tier selected'); return; }

  const firstName  = document.getElementById('regFirstName')?.value?.trim()  || '';
  const middleName = document.getElementById('regMiddleName')?.value?.trim() || '';
  const lastName   = document.getElementById('regLastName')?.value?.trim()   || '';
  const country    = document.getElementById('regCountry')?.value            || '';
  const email      = document.getElementById('regEmail')?.value?.trim()      || (currentUser?.email || '');
  const phone      = document.getElementById('regPhone')?.value?.trim()      || '';

  try {
    await addDoc(collection(db, 'membershipRequests'), {
      userId:        currentUser?.uid || 'visitor',
      userEmail:     email,
      email:         email,
      phone:         phone,
      userName:      [firstName, middleName, lastName].filter(Boolean).join(' '),
      firstName,
      middleName,
      lastName,
      country,
      tier:          selectedTier,
      paymentMethod,
      status:        'pending',
      createdAt:     serverTimestamp()
    });

    // Show success
    const confirmedTier    = document.getElementById('confirmedTier');
    const confirmedPayment = document.getElementById('confirmedPayment');
    if (confirmedTier)    confirmedTier.textContent    = selectedTier;
    if (confirmedPayment) confirmedPayment.textContent = paymentMethod;

    goToStep(4); // Success step
    showToast('✅ Request submitted successfully!');
  } catch (err) {
    console.error(err);
    showToast('❌ Error submitting: ' + err.message);
  }
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  LOAD ADMIN REQUESTS (realtime)
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
function loadAdminRequests() {
  const q = query(
    collection(db, 'membershipRequests'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  onSnapshot(q, (snapshot) => {
    const count       = snapshot.docs.length;
    const notifCount  = document.getElementById('notifCount');
    const requestList = document.getElementById('requestsList');

    if (notifCount) notifCount.textContent = count;

    if (!requestList) return;

    if (count === 0) {
      requestList.innerHTML = '<p style="color:rgba(255,255,255,0.45);font-size:13px">No pending requests.</p>';
      return;
    }

    requestList.innerHTML = '';
    snapshot.docs.forEach(docSnap => {
      const r    = docSnap.data();
      const item = document.createElement('div');
      item.className = 'request-item';

      const tierColors = { VIP: '#c0c0c0', VVIP: '#64b4ff', VVVIP: '#ffd700' };
      const tierColor  = tierColors[r.tier] || '#fff';
      const tierIcon   = r.tier === 'VIP' ? '⭐' : r.tier === 'VVIP' ? '💎' : '👑';

      item.innerHTML = `
        <div class="request-item-header">
          <span class="request-item-name">👤 ${esc(r.userName || r.userEmail)}</span>
          <span class="request-item-tier" style="background:rgba(255,255,255,0.08);border:1px solid ${tierColor};color:${tierColor}">
            ${tierIcon} ${r.tier}
          </span>
        </div>
        <div class="request-item-meta">
          📧 ${esc(r.userEmail||r.email||'—')} · 📱 ${esc(r.phone||'—')} · 🌍 ${esc(r.country||'—')} · 💳 ${esc(r.paymentMethod||'—')} · 🕐 ${timeAgo(r.createdAt)}
        </div>
        <div class="request-item-actions">
          <button class="approve-btn" onclick="approveRequest('${docSnap.id}','${r.userId}','${r.tier}','${esc(r.userEmail)}')">
            ✅ Approve & Assign
          </button>
          <button class="reject-btn" onclick="rejectRequest('${docSnap.id}')">
            ❌ Reject
          </button>
        </div>`;
      requestList.appendChild(item);
    });
  });
}

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  APPROVE
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.approveRequest = async function(requestId, userId, tier, userEmail) {
  if (!isAdmin && !isSubAdmin) return;
  if (!confirm(`Approve ${tier} membership for ${userEmail}?`)) return;
  try {
    await setDoc(doc(db, 'users', userId), {
      membership:  tier,
      memberSince: serverTimestamp(),
      assignedBy:  currentUser.email
    }, { merge: true });

    await updateDoc(doc(db, 'membershipRequests', requestId), {
      status:     'approved',
      approvedBy: currentUser.email,
      approvedAt: serverTimestamp()
    });

    showToast(`✅ ${tier} assigned to ${userEmail}!`);
  } catch (err) { showToast('❌ ' + err.message); }
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  REJECT
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.rejectRequest = async function(requestId) {
  if (!isAdmin && !isSubAdmin) return;
  if (!confirm('Reject this request?')) return;
  try {
    await updateDoc(doc(db, 'membershipRequests', requestId), {
      status:     'rejected',
      rejectedBy: currentUser.email,
      rejectedAt: serverTimestamp()
    });
    showToast('Request rejected.');
  } catch (err) { showToast('❌ ' + err.message); }
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  TOGGLE ADMIN PANEL
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.toggleAdminPanel = function() {
  const panel = document.getElementById('adminRequestsPanel');
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
};

// ── HELPERS ──
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function timeAgo(timestamp) {
  if (!timestamp) return 'just now';
  const diff = Math.floor((Date.now() - (timestamp.toMillis?.() || timestamp)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
}

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  AUTH
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    isAdmin     = ADMIN_EMAILS.includes(user.email);
    try {
      const snap = await getDocs(collection(db, 'admins'));
      SUB_ADMIN_EMAILS = snap.docs.filter(d=>d.data().role==='subadmin').map(d=>d.data().email).filter(Boolean);
    } catch(e) { console.warn('Sub admins:', e); }
    isSubAdmin  = SUB_ADMIN_EMAILS.includes(user.email);
    if (isAdmin || isSubAdmin) loadAdminRequests();
  } else {
    currentUser = null; isAdmin = false; isSubAdmin = false;
  }
});
