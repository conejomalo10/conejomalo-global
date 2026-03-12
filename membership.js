// membership.js — Membership Request System — Conejo Malo Global
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, updateDoc,
  doc, query, where, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { app } from "./firebase.js";

const auth = getAuth(app);
const db   = getFirestore(app);

const ADMIN_EMAILS     = ["official.deconejomalo@gmail.com"];
const SUB_ADMIN_EMAILS = []; // Add sub-admin emails here

let currentUser   = null;
let isAdmin       = false;
let isSubAdmin    = false;
let selectedTier  = null;

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  MODAL CONTROLS
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.showMembershipModal = function() {
  const modal = document.getElementById('membershipModal');
  if (modal) { modal.classList.add('open'); goBackToStep1(); }
};

window.hideMembershipModal = function() {
  const modal = document.getElementById('membershipModal');
  if (modal) modal.classList.remove('open');
};

window.closeMembershipModal = function(e) {
  if (e.target.id === 'membershipModal') hideMembershipModal();
};

window.goBackToStep1 = function() {
  document.getElementById('modalStep1').style.display = 'block';
  document.getElementById('modalStep2').style.display = 'none';
  document.getElementById('modalStep3').style.display = 'none';
  selectedTier = null;
  // Hide crypto dropdown if open
  const dd = document.getElementById('cryptoDropdown');
  if (dd) dd.style.display = 'none';
  const arrow = document.getElementById('cryptoArrow');
  if (arrow) arrow.textContent = '▼';
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  TIER SELECTION
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.selectTier = function(tier) {
  selectedTier = tier;
  document.getElementById('modalStep1').style.display = 'none';
  document.getElementById('modalStep2').style.display = 'block';
  const label = document.getElementById('selectedTierLabel');
  const icons = { VIP: '⭐ VIP', VVIP: '💎 VVIP', VVVIP: '👑 VVVIP' };
  if (label) label.textContent = icons[tier] || tier;
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  CRYPTO DROPDOWN TOGGLE
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.toggleCryptoMenu = function() {
  const dd    = document.getElementById('cryptoDropdown');
  const arrow = document.getElementById('cryptoArrow');
  if (!dd) return;
  const isOpen = dd.style.display === 'block';
  dd.style.display    = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? '▼' : '▲';
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  SUBMIT MEMBERSHIP REQUEST
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.submitMembershipRequest = async function(paymentMethod) {
  if (!currentUser) {
    hideMembershipModal();
    window.location.href = 'index.html';
    return;
  }
  if (!selectedTier) { showToast('⚠️ Please select a tier first'); return; }

  try {
    // Save request to Firestore
    await addDoc(collection(db, 'membershipRequests'), {
      userId:        currentUser.uid,
      userEmail:     currentUser.email,
      userName:      currentUser.displayName || currentUser.email.split('@')[0],
      tier:          selectedTier,
      paymentMethod: paymentMethod,
      status:        'pending',
      createdAt:     serverTimestamp()
    });

    // Show success step
    document.getElementById('modalStep2').style.display = 'none';
    document.getElementById('modalStep3').style.display = 'block';
    const confirmedTier    = document.getElementById('confirmedTier');
    const confirmedPayment = document.getElementById('confirmedPayment');
    if (confirmedTier)    confirmedTier.textContent    = selectedTier;
    if (confirmedPayment) confirmedPayment.textContent = paymentMethod;

    // Close crypto dropdown
    const dd = document.getElementById('cryptoDropdown');
    if (dd) dd.style.display = 'none';

    showToast('✅ Request submitted!');
  } catch (err) {
    console.error(err);
    showToast('❌ Error: ' + err.message);
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

      item.innerHTML = `
        <div class="request-item-header">
          <span class="request-item-name">👤 ${escMembership(r.userName)}</span>
          <span class="request-item-tier" style="background:rgba(255,255,255,0.08);border:1px solid ${tierColor};color:${tierColor}">
            ${r.tier === 'VIP' ? '⭐' : r.tier === 'VVIP' ? '💎' : '👑'} ${r.tier}
          </span>
        </div>
        <div class="request-item-meta">
          📧 ${escMembership(r.userEmail)} · 💳 ${escMembership(r.paymentMethod)} · 🕐 ${timeAgoMs(r.createdAt)}
        </div>
        <div class="request-item-actions">
          <button class="approve-btn" onclick="approveRequest('${docSnap.id}','${r.userId}','${r.tier}','${r.userEmail}')">
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
//  APPROVE REQUEST
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.approveRequest = async function(requestId, userId, tier, userEmail) {
  if (!isAdmin && !isSubAdmin) return;
  if (!confirm(`Approve ${tier} membership for ${userEmail}?`)) return;

  try {
    // Update request status
    await updateDoc(doc(db, 'membershipRequests', requestId), {
      status:     'approved',
      approvedBy: currentUser.email,
      approvedAt: serverTimestamp()
    });

    // Assign membership to user in Firestore
    await updateDoc(doc(db, 'users', userId), {
      membership:   tier,
      memberSince:  serverTimestamp(),
      assignedBy:   currentUser.email
    });

    showToast(`✅ ${tier} membership assigned to ${userEmail}!`);
  } catch (err) {
    // If user doc doesn't exist, create it
    try {
      const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
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

      showToast(`✅ ${tier} membership assigned!`);
    } catch (e) {
      showToast('❌ Error: ' + e.message);
    }
  }
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  REJECT REQUEST
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.rejectRequest = async function(requestId) {
  if (!isAdmin && !isSubAdmin) return;
  if (!confirm('Reject this membership request?')) return;
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

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  HELPERS
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
function escMembership(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgoMs(timestamp) {
  if (!timestamp) return 'just now';
  const now  = Date.now();
  const then = timestamp.toMillis ? timestamp.toMillis() : timestamp;
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  AUTH LISTENER
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    isAdmin     = ADMIN_EMAILS.includes(user.email);
    isSubAdmin  = SUB_ADMIN_EMAILS.includes(user.email);
    if (isAdmin || isSubAdmin) loadAdminRequests();
  } else {
    currentUser = null; isAdmin = false; isSubAdmin = false;
  }
});
