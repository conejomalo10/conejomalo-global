// posts.js — Community Post System — Comunidad Global de Fans de Conejo Malo
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc,
  doc, query, orderBy, onSnapshot, updateDoc,
  increment, serverTimestamp, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { app } from "./firebase.js";

const auth = getAuth(app);
const db   = getFirestore(app);

// ── CLOUDINARY CONFIG ──
const CLOUDINARY_CLOUD_NAME    = "dhazrf2xr";
const CLOUDINARY_UPLOAD_PRESET = "conejomalo_media";
const CLOUDINARY_UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

// ── ADMIN EMAILS ──
const ADMIN_EMAILS = ["officialdeconejomalo@gmail.com"];

let currentUser     = null;
let currentFilter   = 'all';
let currentPostType = 'post';
let isAdmin         = false;

// Pending media files (before post is submitted)
const pendingMedia = { photo: [], video: [], audio: [] };

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  RANK SYSTEM
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
function getRank(postCount) {
  if (postCount >= 30) return { label: '👑 Legend Fan', color: '#ffd700' };
  if (postCount >= 15) return { label: '🔥 Elite Fan',  color: '#ff6600' };
  if (postCount >=  5) return { label: '⭐ Super Fan',  color: '#c0c0c0' };
  return                      { label: '🌱 New Fan',    color: '#88cc88' };
}

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  TIME FORMATTER
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
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

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  HTML ESCAPE
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  POST TYPE SETTER
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.setPostType = function(type, btn) {
  currentPostType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  CHAR COUNT
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
document.getElementById('postInput')?.addEventListener('input', function() {
  const count = this.value.length;
  const el = document.getElementById('charCount');
  if (el) {
    el.textContent = count + '/500';
    el.style.color = count > 450 ? '#ff6666' : 'rgba(255,255,255,0.40)';
  }
});

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  MEDIA TABS
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.switchMediaTab = function(btn, type) {
  document.querySelectorAll('.media-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.media-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const panel = document.getElementById('panel-' + type);
  if (panel) panel.classList.add('active');
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  DRAG & DROP
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.handleDrag = function(e, over, zoneId) {
  e.preventDefault();
  const zone = document.getElementById(zoneId);
  if (zone) zone.classList.toggle('dragover', over);
};

window.handleDrop = function(e, type) {
  e.preventDefault();
  const zoneMap = { photo: 'photoDrop', video: 'videoDrop', audio: 'audioDrop' };
  const zone = document.getElementById(zoneMap[type]);
  if (zone) zone.classList.remove('dragover');
  handleMediaFiles(e.dataTransfer.files, type);
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  FILE VALIDATION & PREVIEW
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.handleMediaFiles = function(files, type) {
  const maxMB = { photo: 10, video: 100, audio: 50 };
  [...files].forEach(file => {
    if (type === 'photo' && !file.type.startsWith('image/'))
      return showToast('⚠️ Only image files allowed');
    if (type === 'video' && !file.type.startsWith('video/'))
      return showToast('⚠️ Only video files allowed');
    if (type === 'audio' && !file.type.startsWith('audio/'))
      return showToast('⚠️ Only audio files allowed');
    if (file.size > maxMB[type] * 1024 * 1024)
      return showToast(`⚠️ File too large (max ${maxMB[type]}MB)`);

    const url = URL.createObjectURL(file);
    const idx = pendingMedia[type].length;
    pendingMedia[type].push({ file, url });
    renderMediaPreview(type, idx, url, file);
  });
};

function renderMediaPreview(type, idx, url, file) {
  if (type === 'photo') {
    const grid = document.getElementById('photoPreviews');
    if (!grid) return;
    const div = document.createElement('div');
    div.className = 'preview-item';
    div.innerHTML = `
      <img src="${url}" alt="${escapeHtml(file.name)}">
      <button class="preview-remove" onclick="removeMedia('photo',${idx},this.closest('.preview-item'))">✕</button>`;
    grid.appendChild(div);

  } else if (type === 'video') {
    const grid = document.getElementById('videoPreviews');
    if (!grid) return;
    const div = document.createElement('div');
    div.className = 'preview-item';
    div.style.aspectRatio = '16/9';
    div.innerHTML = `
      <video src="${url}" controls></video>
      <button class="preview-remove" onclick="removeMedia('video',${idx},this.closest('.preview-item'))">✕</button>`;
    grid.appendChild(div);

  } else {
    const container = document.getElementById('audioPreviews');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'audio-preview-item';
    div.innerHTML = `
      <div class="audio-preview-icon">🎵</div>
      <div class="audio-preview-info">
        <div class="audio-preview-name">${escapeHtml(file.name)}</div>
        <div class="audio-preview-size">${(file.size/1024/1024).toFixed(2)} MB</div>
        <audio src="${url}" controls></audio>
      </div>
      <button class="audio-preview-remove" onclick="removeMedia('audio',${idx},this.closest('.audio-preview-item'))">✕</button>`;
    container.appendChild(div);
  }
}

window.removeMedia = function(type, idx, el) {
  pendingMedia[type][idx] = null;
  if (el) el.remove();
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  UPLOAD TO CLOUDINARY (100% FREE)
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', 'conejomalo_community');

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Upload failed');
  }

  const data = await response.json();
  return data.secure_url;
}

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  SUBMIT POST
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.submitPost = async function() {
  if (!currentUser) { showToast('⚠️ Please login first!'); return; }

  const input  = document.getElementById('postInput');
  const text   = input?.value?.trim();
  const photos = pendingMedia.photo.filter(Boolean);
  const videos = pendingMedia.video.filter(Boolean);
  const audios = pendingMedia.audio.filter(Boolean);

  if (!text && !photos.length && !videos.length && !audios.length) {
    showToast('✏️ Write something or attach media first!');
    return;
  }
  if (text.length > 500) { showToast('⚠️ Max 500 characters!'); return; }

  const btn = document.querySelector('.post-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }
  showToast('⏳ Uploading media, please wait...');

  try {
    // Upload all files to Cloudinary in parallel
    const [photoURLs, videoURLs, audioData] = await Promise.all([
      Promise.all(photos.map(f => uploadToCloudinary(f.file))),
      Promise.all(videos.map(f => uploadToCloudinary(f.file))),
      Promise.all(audios.map(async f => ({
        url:  await uploadToCloudinary(f.file),
        name: f.file.name
      })))
    ]);

    // Save post to Firestore with Cloudinary URLs
    await addDoc(collection(db, 'posts'), {
      text:        text || '',
      type:        currentPostType,
      authorId:    currentUser.uid,
      authorEmail: currentUser.email,
      authorName:  currentUser.displayName || currentUser.email.split('@')[0],
      isAdmin:     isAdmin,
      photos:      photoURLs,
      videos:      videoURLs,
      audios:      audioData,
      likes:       0,
      likedBy:     [],
      pinned:      false,
      comments:    [],
      createdAt:   serverTimestamp()
    });

    // Reset form
    if (input) input.value = '';
    const charEl = document.getElementById('charCount');
    if (charEl) charEl.textContent = '0/500';
    pendingMedia.photo.length = 0;
    pendingMedia.video.length = 0;
    pendingMedia.audio.length = 0;
    ['photoPreviews','videoPreviews','audioPreviews'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });

    showToast('🚀 Posted successfully!');
  } catch (err) {
    console.error(err);
    showToast('❌ Upload failed: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Post 🚀'; }
  }
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  FILTER FEED
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.filterFeed = function(type, btn) {
  currentFilter = type;
  document.querySelectorAll('.feed-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  LOAD POSTS (REALTIME)
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
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

    // Sort: pinned first then newest
    posts.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    // Filter by type
    const filtered = currentFilter === 'all'
      ? posts
      : posts.filter(p => p.type === currentFilter);

    feed.innerHTML = '';

    if (filtered.length === 0) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    filtered.forEach(post => feed.appendChild(buildPostCard(post)));

    // Update user rank
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

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  BUILD POST CARD
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
function buildPostCard(post) {
  const card = document.createElement('div');
  card.className = 'post-card';
  card.id = 'post-' + post.id;

  const isOwner   = currentUser && currentUser.uid === post.authorId;
  const canDelete = isAdmin || isOwner;
  const hasLiked  = currentUser && post.likedBy && post.likedBy.includes(currentUser.uid);
  const initials  = (post.authorName || 'F')[0].toUpperCase();

  const typeLabels = {
    post: '💬 Post', news: '📰 News',
    fanart: '🎨 Fan Art', question: '❓ Question'
  };

  // ── Media HTML ──
  let mediaHTML = '';

  if (post.photos && post.photos.length) {
    const count = Math.min(post.photos.length, 3);
    mediaHTML += `<div class="post-media-grid count-${count}">`;
    post.photos.slice(0, 3).forEach(url => {
      mediaHTML += `<div class="media-cell" onclick="openLightbox('${url}')">
        <img src="${url}" alt="photo" loading="lazy"></div>`;
    });
    mediaHTML += `</div>`;
  }

  if (post.videos && post.videos.length) {
    post.videos.forEach(url => {
      mediaHTML += `<div class="post-media-grid count-1">
        <div class="media-cell" style="aspect-ratio:16/9">
          <video src="${url}" controls style="width:100%;height:100%;object-fit:contain"></video>
        </div></div>`;
    });
  }

  if (post.audios && post.audios.length) {
    post.audios.forEach(a => {
      mediaHTML += `<div class="post-audio-player">
        <div class="post-audio-art">🎵</div>
        <div class="post-audio-details">
          <div class="post-audio-title">${escapeHtml(a.name)}</div>
          <div class="post-audio-sub">Audio · ${escapeHtml(post.authorName)}</div>
          <audio src="${a.url}" controls></audio>
        </div></div>`;
    });
  }

  // ── Comments HTML ──
  const commentsArr = post.comments || [];
  const commentsHTML = commentsArr.map(c => `
    <div class="comment-item">
      <div class="comment-avatar">${(c.authorName||'F')[0].toUpperCase()}</div>
      <div class="comment-bubble">
        <div class="comment-author">${escapeHtml(c.authorName || 'Fan')}</div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
      </div>
    </div>`).join('');

  card.innerHTML = `
    ${post.pinned ? '<div class="pinned-banner">📌 PINNED POST</div>' : ''}
    <div class="post-header">
      <div class="post-user-avatar">${initials}</div>
      <div class="post-meta">
        <div class="post-author">
          ${escapeHtml(post.authorName || 'Fan')}
          ${post.isAdmin ? '<span class="admin-tag">👑 ADMIN</span>' : ''}
          <span class="post-type-tag">${typeLabels[post.type] || '💬 Post'}</span>
        </div>
        <div class="post-time">${timeAgo(post.createdAt)}</div>
      </div>
      <div style="display:flex;gap:4px;margin-left:auto;flex-shrink:0">
        ${isAdmin ? `<button class="post-action-btn pin-btn ${post.pinned ? 'pinned' : ''}"
          onclick="togglePin('${post.id}',${post.pinned})"
          title="${post.pinned ? 'Unpin' : 'Pin'}">📌</button>` : ''}
        ${canDelete ? `<button class="post-action-btn delete-btn"
          onclick="deletePost('${post.id}')">🗑️</button>` : ''}
      </div>
    </div>
    ${post.text ? `<div class="post-body">${escapeHtml(post.text)}</div>` : ''}
    ${mediaHTML}
    <div class="post-footer">
      <button class="post-action-btn ${hasLiked ? 'liked' : ''}"
        onclick="toggleLike('${post.id}',${hasLiked})">
        ${hasLiked ? '❤️' : '🤍'} <span>${post.likes || 0}</span>
      </button>
      <button class="post-action-btn" onclick="toggleComments('${post.id}')">
        💬 ${commentsArr.length}
      </button>
    </div>
    <div class="comments-section">
      <div class="comments-list" id="comments-${post.id}">
        ${commentsHTML}
        <div class="comment-input-row">
          <input type="text" placeholder="Add a comment..."
            id="commentInput-${post.id}"
            onkeydown="if(event.key==='Enter') addComment('${post.id}')">
          <button class="comment-send-btn" onclick="addComment('${post.id}')">➤</button>
        </div>
      </div>
    </div>`;

  return card;
}

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  LIGHTBOX
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.openLightbox = function(src) {
  const lb  = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  if (lb && img) { img.src = src; lb.classList.add('open'); }
};
window.closeLightbox = function() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.remove('open');
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  TOGGLE LIKE
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.toggleLike = async function(postId, hasLiked) {
  if (!currentUser) { showToast('⚠️ Login to like posts!'); return; }
  const ref = doc(db, 'posts', postId);
  try {
    if (hasLiked) {
      await updateDoc(ref, { likes: increment(-1), likedBy: arrayRemove(currentUser.uid) });
    } else {
      await updateDoc(ref, { likes: increment(1), likedBy: arrayUnion(currentUser.uid) });
      showToast('❤️ Liked!');
    }
  } catch (err) { showToast('❌ ' + err.message); }
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  PIN POST (admin only)
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.togglePin = async function(postId, isPinned) {
  if (!isAdmin) return;
  try {
    await updateDoc(doc(db, 'posts', postId), { pinned: !isPinned });
    showToast(isPinned ? 'Post unpinned' : '📌 Post pinned!');
  } catch (err) { showToast('❌ ' + err.message); }
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  DELETE POST (admin or owner)
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.deletePost = async function(postId) {
  if (!currentUser) return;
  if (!confirm('Delete this post?')) return;
  try {
    await deleteDoc(doc(db, 'posts', postId));
    showToast('🗑️ Post deleted!');
  } catch (err) { showToast('❌ Error: ' + err.message); }
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  COMMENTS
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.toggleComments = function(postId) {
  const el = document.getElementById('comments-' + postId);
  if (el) el.classList.toggle('open');
};

window.addComment = async function(postId) {
  if (!currentUser) { showToast('⚠️ Login to comment!'); return; }
  const input = document.getElementById('commentInput-' + postId);
  const text  = input?.value?.trim();
  if (!text) return;
  try {
    await updateDoc(doc(db, 'posts', postId), {
      comments: arrayUnion({
        authorId:   currentUser.uid,
        authorName: currentUser.displayName || currentUser.email.split('@')[0],
        text,
        createdAt:  Date.now()
      })
    });
    if (input) input.value = '';
  } catch (err) { showToast('❌ ' + err.message); }
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  TOAST
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
window.showToast = function(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
};

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
//  AUTH GUARD
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
onAuthStateChanged(auth, user => {
  const dashboard = document.getElementById('communityDashboard');
  const denied    = document.getElementById('accessDenied');
  const navLogout = document.getElementById('navLogoutBtn');

  if (user) {
    currentUser = user;
    isAdmin     = ADMIN_EMAILS.includes(user.email);

    if (dashboard) dashboard.style.display = 'block';
    if (denied)    denied.style.display    = 'none';
    if (navLogout) navLogout.style.display  = 'inline-block';

    // Show admin badge
    const adminBadge = document.getElementById('adminBadge');
    if (adminBadge) adminBadge.style.display = isAdmin ? 'inline-block' : 'none';

    // Welcome message
    const name      = user.displayName || user.email.split('@')[0];
    const welcomeEl = document.getElementById('welcomeMsg');
    const emailEl   = document.getElementById('userEmail');
    if (welcomeEl) welcomeEl.textContent = '👋 Welcome, ' + name + '!';
    if (emailEl)   emailEl.textContent   = user.email;

    // Load posts
    loadPosts();

    // Member count
    const membersEl = document.getElementById('totalMembers');
    if (membersEl) membersEl.textContent = '1,000+';

  } else {
    currentUser = null;
    isAdmin     = false;
    if (dashboard) dashboard.style.display = 'none';
    if (denied)    denied.style.display    = 'block';
    if (navLogout) navLogout.style.display  = 'none';
  }
});
