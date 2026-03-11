// posts.js — Community Post System — Comunidad Global de Fans de Conejo Malo
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc,
  doc, query, orderBy, onSnapshot, updateDoc,
  increment, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { app } from "./firebase.js";

const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser    = null;
let currentFilter  = 'all';
let currentPostType = 'post';
let deferredPrompt = null;

// ---- RANK SYSTEM ----
function getRank(postCount) {
  if (postCount >= 30) return { label: '👑 Legend Fan',  color: '#ffd700' };
  if (postCount >= 15) return { label: '🔥 Elite Fan',   color: '#ff6600' };
  if (postCount >=  5) return { label: '⭐ Super Fan',   color: '#c0c0c0' };
  return                      { label: '🌱 New Fan',     color: '#88cc88' };
}

// ---- TIME FORMATTER ----
function timeAgo(timestamp) {
  if (!timestamp) return 'just now';
  const now  = Date.now();
  const then = timestamp.toMillis ? timestamp.toMillis() : timestamp;
  const diff = Math.floor((now - then) / 1000);
  if (diff <  60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

// ---- POST TYPE SETTER ----
window.setPostType = function(type, btn) {
  currentPostType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

// ---- CHAR COUNT ----
document.getElementById('postInput')?.addEventListener('input', function() {
  const count = this.value.length;
  const el = document.getElementById('charCount');
  if (el) {
    el.textContent = count + '/500';
    el.style.color = count > 450 ? '#ff6666' : 'rgba(255,255,255,0.40)';
  }
});

// ---- SUBMIT POST ----
window.submitPost = async function() {
  if (!currentUser) { showToast('⚠️ Please login first!'); return; }
  const input = document.getElementById('postInput');
  const text  = input?.value?.trim();
  if (!text) { showToast('✏️ Write something first!'); return; }
  if (text.length > 500) { showToast('⚠️ Max 500 characters!'); return; }

  const btn = document.querySelector('.post-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Posting...'; }

  try {
    await addDoc(collection(db, 'posts'), {
      text,
      type:      currentPostType,
      authorId:  currentUser.uid,
      authorEmail: currentUser.email,
      authorName: currentUser.displayName || currentUser.email.split('@')[0],
      likes:     0,
      likedBy:   [],
      createdAt: serverTimestamp()
    });
    input.value = '';
    document.getElementById('charCount').textContent = '0/500';
    showToast('🚀 Posted successfully!');
  } catch (err) {
    showToast('❌ Error posting: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Post 🚀'; }
  }
};

// ---- FILTER FEED ----
window.filterFeed = function(type, btn) {
  currentFilter = type;
  document.querySelectorAll('.feed-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadPosts();
};

// ---- LOAD POSTS (REALTIME) ----
function loadPosts() {
  const feed    = document.getElementById('postFeed');
  const loading = document.getElementById('feedLoading');
  const empty   = document.getElementById('emptyFeed');
  if (!feed) return;

  if (loading) loading.style.display = 'block';
  feed.innerHTML = '';

  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));

  onSnapshot(q, (snapshot) => {
    if (loading) loading.style.display = 'none';

    let posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Update stats
    const totalPostsEl = document.getElementById('totalPosts');
    if (totalPostsEl) totalPostsEl.textContent = posts.length;

    // Filter
    if (currentFilter !== 'all') {
      posts = posts.filter(p => p.type === currentFilter);
    }

    feed.innerHTML = '';

    if (posts.length === 0) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    posts.forEach(post => {
      const card = buildPostCard(post);
      feed.appendChild(card);
    });

    // Update user rank based on their post count
    if (currentUser) {
      const myPosts = snapshot.docs.filter(d => d.data().authorId === currentUser.uid).length;
      const rank = getRank(myPosts);
      const badge = document.getElementById('fanRankBadge');
      if (badge) {
        badge.textContent = rank.label;
        badge.style.color = rank.color;
        badge.style.borderColor = rank.color;
      }
    }
  });
}

// ---- BUILD POST CARD ----
function buildPostCard(post) {
  const card = document.createElement('div');
  card.className = 'post-card';
  card.id = 'post-' + post.id;

  const isOwner  = currentUser && currentUser.uid === post.authorId;
  const hasLiked = currentUser && post.likedBy && post.likedBy.includes(currentUser.uid);
  const initials = (post.authorName || 'F')[0].toUpperCase();

  const typeLabels = {
    post: '💬 Post', news: '📰 News',
    fanart: '🎨 Fan Art', question: '❓ Question'
  };

  card.innerHTML = `
    <div class="post-header">
      <div class="post-user-avatar">${initials}</div>
      <div class="post-meta">
        <div class="post-author">${escapeHtml(post.authorName || 'Fan')}</div>
        <div class="post-time">${timeAgo(post.createdAt)}</div>
      </div>
      <span class="post-type-tag">${typeLabels[post.type] || '💬 Post'}</span>
    </div>
    <div class="post-body">${escapeHtml(post.text)}</div>
    <div class="post-footer">
      <button class="post-action-btn ${hasLiked ? 'liked' : ''}"
        onclick="toggleLike('${post.id}', ${hasLiked})">
        ❤️ ${post.likes || 0}
      </button>
      ${isOwner ? `<button class="post-action-btn delete-btn" onclick="deletePost('${post.id}')">🗑️ Delete</button>` : ''}
    </div>
  `;
  return card;
}

// ---- LIKE / UNLIKE ----
window.toggleLike = async function(postId, hasLiked) {
  if (!currentUser) { showToast('⚠️ Login to like posts!'); return; }
  const ref = doc(db, 'posts', postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const likedBy = snap.data().likedBy || [];

  if (hasLiked) {
    await updateDoc(ref, {
      likes:   increment(-1),
      likedBy: likedBy.filter(id => id !== currentUser.uid)
    });
  } else {
    await updateDoc(ref, {
      likes:   increment(1),
      likedBy: [...likedBy, currentUser.uid]
    });
    showToast('❤️ Liked!');
  }
};

// ---- DELETE POST ----
window.deletePost = async function(postId) {
  if (!currentUser) return;
  if (!confirm('Delete this post?')) return;
  try {
    await deleteDoc(doc(db, 'posts', postId));
    showToast('🗑️ Post deleted!');
  } catch (err) {
    showToast('❌ Error: ' + err.message);
  }
};

// ---- TOAST ----
window.showToast = function(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
};

// ---- HTML ESCAPE ----
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- AUTH GUARD ---- 
onAuthStateChanged(auth, user => {
  const dashboard   = document.getElementById('communityDashboard');
  const denied      = document.getElementById('accessDenied');
  const navLogout   = document.getElementById('navLogoutBtn');

  if (user) {
    currentUser = user;
    if (dashboard) dashboard.style.display = 'block';
    if (denied)    denied.style.display    = 'none';
    if (navLogout) navLogout.style.display  = 'inline-block';

    // Set welcome message
    const name = user.displayName || user.email.split('@')[0];
    const welcomeEl = document.getElementById('welcomeMsg');
    const emailEl   = document.getElementById('userEmail');
    if (welcomeEl) welcomeEl.textContent = '👋 Welcome, ' + name + '!';
    if (emailEl)   emailEl.textContent   = user.email;

    // Load posts
    loadPosts();

    // Fake member count (replace with real Firestore count later)
    const membersEl = document.getElementById('totalMembers');
    if (membersEl) membersEl.textContent = '1,000+';

  } else {
    currentUser = null;
    if (dashboard) dashboard.style.display = 'none';
    if (denied)    denied.style.display    = 'block';
    if (navLogout) navLogout.style.display  = 'none';
  }
});
