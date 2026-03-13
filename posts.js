// posts.js — Community Post System — Comunidad Global de Fans de Conejo Malo
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc,
  doc, query, orderBy, onSnapshot, updateDoc,
  increment, serverTimestamp, arrayUnion, arrayRemove, getDoc, setDoc, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { app } from "./firebase.js";

const auth = getAuth(app);
const db   = getFirestore(app);

const CLOUDINARY_CLOUD_NAME    = "dhazrf2xr";
const CLOUDINARY_UPLOAD_PRESET = "conejomalo_media";
const CLOUDINARY_UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

const ADMIN_EMAILS          = ["official.deconejomalo@gmail.com"];
const SUB_ADMIN_EMAILS      = [];
const VISITOR_PREVIEW_COUNT = 5;

let currentUser     = null;
let currentFilter   = 'all';
let visitorFilter   = 'all';
let currentPostType = 'post';
let isAdmin         = false;
let isSubAdmin      = false;
let userMembership  = null;

const pendingMedia = { photo: [], video: [], audio: [] };

// ── PERMISSIONS ──
function canPost()       { return isAdmin || isSubAdmin || ['VIP','VVIP','VVVIP'].includes(userMembership); }
function canComment()    { return isAdmin || isSubAdmin || ['VIP','VVIP','VVVIP'].includes(userMembership); }
function canLike()       { return isAdmin || isSubAdmin || ['VIP','VVIP','VVVIP'].includes(userMembership); }
function canPostImages() { return isAdmin || isSubAdmin || ['VVIP','VVVIP'].includes(userMembership); }
function canPostMedia()  { return isAdmin || isSubAdmin || userMembership === 'VVVIP'; }

// ── RANK ──
function getRank(count) {
  if (count >= 30) return { label: '👑 Legend Fan', color: '#ffd700' };
  if (count >= 15) return { label: '🔥 Elite Fan',  color: '#ff6600' };
  if (count >=  5) return { label: '⭐ Super Fan',  color: '#c0c0c0' };
  return                   { label: '🌱 New Fan',    color: '#88cc88' };
}

function timeAgo(ts) {
  if (!ts) return 'just now';
  const diff = Math.floor((Date.now() - (ts.toMillis?.() || ts)) / 1000);
  if (diff <  60) return 'just now';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── UI SETUP ──
function setupUIForMembership() {
  const mediaBox = document.getElementById('mediaUploadBox');
  if (mediaBox) mediaBox.style.display = canPostImages() ? 'block' : 'none';
  const audioTab = document.getElementById('audioTabBtn');
  if (audioTab) audioTab.style.display = canPostMedia() ? '' : 'none';
  const upgradeCard = document.getElementById('upgradeCard');
  if (upgradeCard) upgradeCard.style.display = (!isAdmin && userMembership !== 'VVVIP') ? 'block' : 'none';
  const badge = document.getElementById('membershipBadge');
  if (badge && userMembership) {
    badge.textContent   = userMembership === 'VIP' ? '⭐ VIP' : userMembership === 'VVIP' ? '💎 VVIP' : '👑 VVVIP';
    badge.className     = `membership-badge ${userMembership.toLowerCase()}`;
    badge.style.display = 'inline-block';
  }
}

// ══════════════════════════════════════════════════════
//  🔔 ADMIN MEMBERSHIP REQUEST NOTIFICATIONS (FIXED)
// ══════════════════════════════════════════════════════
function loadAdminRequests() {
  if (!isAdmin && !isSubAdmin) return;

  const notifBar  = document.getElementById('adminNotifBar');
  const pendingEl = document.getElementById('pendingCount');
  const reqPanel  = document.getElementById('membershipRequests');

  // Show the notification bar
  if (notifBar) notifBar.style.display = 'block';

  // Listen to ALL membershipRequests in realtime, filter pending client-side
  // (avoids needing a composite Firestore index for where+orderBy)
  const q = query(collection(db, 'membershipRequests'), orderBy('createdAt', 'desc'));

  onSnapshot(q, snap => {
    const allDocs   = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const pending   = allDocs.filter(r => r.status === 'pending');
    const count     = pending.length;

    // Update badge counter
    if (pendingEl) {
      pendingEl.textContent    = count;
      pendingEl.style.display  = count > 0 ? 'inline-block' : 'none';
      pendingEl.style.background = count > 0 ? '#ff4bf1' : '#555';
    }

    // Flash the notif bar
    if (notifBar) {
      notifBar.style.borderLeft = count > 0
        ? '4px solid #ff4bf1'
        : '4px solid #00d4ff';
    }

    // Render pending requests inside the panel
    if (!reqPanel) return;

    if (count === 0) {
      reqPanel.innerHTML = `
        <div style="text-align:center;padding:20px;color:rgba(255,255,255,0.5);">
          ✅ No pending membership requests
        </div>`;
      return;
    }

    reqPanel.innerHTML = pending.map(r => `
      <div class="request-card" id="req-${r.id}" style="
        background:rgba(255,255,255,0.05);
        border:1px solid rgba(255,255,255,0.1);
        border-radius:12px;
        padding:16px;
        margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="
            font-weight:800;font-size:13px;padding:4px 12px;border-radius:999px;
            background:${r.tier==='VIP'?'rgba(192,192,192,0.2)':r.tier==='VVIP'?'rgba(100,180,255,0.2)':'rgba(255,215,0,0.2)'};
            color:${r.tier==='VIP'?'#c0c0c0':r.tier==='VVIP'?'#64b4ff':'#ffd700'};">
            ${r.tier==='VIP'?'⭐':r.tier==='VVIP'?'💎':'👑'} ${r.tier} Request
          </span>
          <span style="font-size:11px;color:rgba(255,255,255,0.4);">${timeAgo(r.createdAt)}</span>
        </div>
        <div style="font-size:13px;line-height:1.9;color:rgba(255,255,255,0.85);">
          <div>👤 <strong>${esc((r.firstName||'')+' '+(r.middleName||'')+' '+(r.lastName||''))}</strong></div>
          <div>🌍 ${esc(r.country||'—')}</div>
          <div>📧 ${esc(r.email||'—')}</div>
          <div>💳 ${esc(r.paymentMethod||'—')}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.35);">UID: ${esc(r.userId||'—')}</div>
        </div>
        <div style="display:flex;gap:10px;margin-top:12px;">
          <button onclick="approveRequest('${r.id}','${esc(r.userId||'')}','${esc(r.tier||'VIP')}')"
            style="flex:1;padding:9px;border:none;border-radius:8px;background:linear-gradient(135deg,#00c853,#00e676);
            color:#000;font-weight:800;font-size:12px;cursor:pointer;">
            ✅ Approve & Grant
          </button>
          <button onclick="rejectRequest('${r.id}')"
            style="flex:1;padding:9px;border:none;border-radius:8px;background:rgba(255,80,80,0.2);
            border:1px solid rgba(255,80,80,0.4);color:#ff8080;font-weight:700;font-size:12px;cursor:pointer;">
            ❌ Reject
          </button>
        </div>
      </div>`).join('');

  }, err => {
    console.error('Requests listener error:', err);
    if (reqPanel) reqPanel.innerHTML = `<p style="color:#ff8080;padding:12px;">⚠️ Error loading requests. Check Firestore rules.</p>`;
  });
}

// ── APPROVE: grant membership in Firestore ──
window.approveRequest = async function(reqId, userId, tier) {
  if (!isAdmin && !isSubAdmin) return;
  if (!confirm(`Grant ${tier} membership to this fan?`)) return;
  try {
    await setDoc(doc(db, 'users', userId), {
      membership:  tier,
      memberSince: serverTimestamp(),
      assignedBy:  currentUser.email
    }, { merge: true });
    await updateDoc(doc(db, 'membershipRequests', reqId), {
      status:     'approved',
      approvedAt: serverTimestamp(),
      approvedBy: currentUser.email
    });
    showToast(`✅ ${tier} granted! Fan now has access.`);
  } catch(e) {
    console.error(e);
    showToast('❌ Error: ' + e.message);
  }
};

// ── REJECT ──
window.rejectRequest = async function(reqId) {
  if (!isAdmin && !isSubAdmin) return;
  if (!confirm('Reject this request?')) return;
  try {
    await updateDoc(doc(db, 'membershipRequests', reqId), {
      status:     'rejected',
      rejectedAt: serverTimestamp(),
      rejectedBy: currentUser.email
    });
    showToast('🗑️ Request rejected.');
  } catch(e) { showToast('❌ ' + e.message); }
};

// ── TOGGLE PANEL ──
window.toggleRequestsPanel = function() {
  const p = document.getElementById('requestsPanel');
  if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
};

// ── POST TYPE ──
const placeholders = {
  post:     '🎵 What\'s on your mind? Share your love for Bad Bunny...',
  news:     '📰 Share the latest Bad Bunny news with the community...',
  fanart:   '🎨 Share your fan art! Describe your creation or paste a link...',
  question: '❓ Ask the community a question about Bad Bunny...'
};

window.setPostType = function(type, btn) {
  currentPostType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const ta = document.getElementById('postInput');
  if (ta) ta.placeholder = placeholders[type] || placeholders.post;
};

document.getElementById('postInput')?.addEventListener('input', function() {
  const count = this.value.length;
  const el = document.getElementById('charCount');
  if (el) { el.textContent = count+'/500'; el.style.color = count>450?'#ff6666':'rgba(255,255,255,0.40)'; }
});

// ── MEDIA TABS ──
window.switchMediaTab = function(btn, type) {
  document.querySelectorAll('.media-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.media-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panel-'+type)?.classList.add('active');
};

window.handleDrag = function(e, over, zoneId) {
  e.preventDefault();
  document.getElementById(zoneId)?.classList.toggle('dragover', over);
};

window.handleDrop = function(e, type) {
  e.preventDefault();
  const zones = { photo:'photoDrop', video:'videoDrop', audio:'audioDrop' };
  document.getElementById(zones[type])?.classList.remove('dragover');
  handleMediaFiles(e.dataTransfer.files, type);
};

window.handleMediaFiles = function(files, type) {
  const maxMB = { photo:10, video:100, audio:50 };
  [...files].forEach(file => {
    if (type==='photo' && !file.type.startsWith('image/')) return showToast('⚠️ Only image files allowed');
    if (type==='video' && !file.type.startsWith('video/')) return showToast('⚠️ Only video files allowed');
    if (type==='audio' && !file.type.startsWith('audio/')) return showToast('⚠️ Only audio files allowed');
    if (file.size > maxMB[type]*1024*1024) return showToast(`⚠️ Max ${maxMB[type]}MB`);
    const url = URL.createObjectURL(file);
    const idx = pendingMedia[type].length;
    pendingMedia[type].push({file,url});
    renderPreview(type, idx, url, file);
  });
};

function renderPreview(type, idx, url, file) {
  if (type==='photo') {
    const g=document.getElementById('photoPreviews'); if(!g) return;
    const d=document.createElement('div'); d.className='preview-item';
    d.innerHTML=`<img src="${url}" alt="${esc(file.name)}"><button class="preview-remove" onclick="removeMedia('photo',${idx},this.closest('.preview-item'))">✕</button>`;
    g.appendChild(d);
  } else if (type==='video') {
    const g=document.getElementById('videoPreviews'); if(!g) return;
    const d=document.createElement('div'); d.className='preview-item'; d.style.aspectRatio='16/9';
    d.innerHTML=`<video src="${url}" controls></video><button class="preview-remove" onclick="removeMedia('video',${idx},this.closest('.preview-item'))">✕</button>`;
    g.appendChild(d);
  } else {
    const c=document.getElementById('audioPreviews'); if(!c) return;
    const d=document.createElement('div'); d.className='audio-preview-item';
    d.innerHTML=`<div class="audio-preview-icon">🎵</div>
      <div class="audio-preview-info">
        <div class="audio-preview-name">${esc(file.name)}</div>
        <div class="audio-preview-size">${(file.size/1024/1024).toFixed(2)} MB</div>
        <audio src="${url}" controls></audio>
      </div>
      <button class="audio-preview-remove" onclick="removeMedia('audio',${idx},this.closest('.audio-preview-item'))">✕</button>`;
    c.appendChild(d);
  }
}

window.removeMedia = function(type, idx, el) {
  pendingMedia[type][idx]=null; if(el) el.remove();
};

// ── CLOUDINARY ──
async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  fd.append('folder', 'conejomalo_community');
  const res = await fetch(CLOUDINARY_UPLOAD_URL, {method:'POST',body:fd});
  if (!res.ok) { const e=await res.json(); throw new Error(e.error?.message||'Upload failed'); }
  return (await res.json()).secure_url;
}

// ── SUBMIT POST ──
window.submitPost = async function() {
  if (!currentUser)  { showToast('⚠️ Please login first!'); return; }
  if (!canPost())    { showToast('⚠️ Membership required to post!'); return; }
  const input  = document.getElementById('postInput');
  const text   = input?.value?.trim();
  const photos = pendingMedia.photo.filter(Boolean);
  const videos = pendingMedia.video.filter(Boolean);
  const audios = pendingMedia.audio.filter(Boolean);
  if ((photos.length||videos.length) && !canPostImages()) { showToast('⚠️ VVIP+ required for images!'); return; }
  if ((videos.length||audios.length) && !canPostMedia())  { showToast('⚠️ VVVIP required for video/audio!'); return; }
  if (!text && !photos.length && !videos.length && !audios.length) { showToast('✏️ Write something or attach media!'); return; }
  if (text.length > 500) { showToast('⚠️ Max 500 characters!'); return; }
  const btn = document.querySelector('.post-btn');
  if (btn) { btn.disabled=true; btn.textContent='Uploading...'; }
  showToast('⏳ Uploading, please wait...');
  try {
    const [photoURLs, videoURLs, audioData] = await Promise.all([
      Promise.all(photos.map(f => uploadToCloudinary(f.file))),
      Promise.all(videos.map(f => uploadToCloudinary(f.file))),
      Promise.all(audios.map(async f => ({ url: await uploadToCloudinary(f.file), name: f.file.name })))
    ]);
    await addDoc(collection(db,'posts'), {
      text, type:currentPostType,
      authorId: currentUser.uid, authorEmail: currentUser.email,
      authorName: currentUser.displayName || currentUser.email.split('@')[0],
      isAdmin, membership: isAdmin ? 'ADMIN' : (userMembership||''),
      photos:photoURLs, videos:videoURLs, audios:audioData,
      likes:0, likedBy:[], pinned:false, comments:[], createdAt:serverTimestamp()
    });
    if (input) input.value='';
    const cc=document.getElementById('charCount'); if(cc) cc.textContent='0/500';
    pendingMedia.photo.length=pendingMedia.video.length=pendingMedia.audio.length=0;
    ['photoPreviews','videoPreviews','audioPreviews'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML='';});
    showToast('🚀 Posted successfully!');
  } catch(err) { console.error(err); showToast('❌ '+err.message);
  } finally { if (btn) { btn.disabled=false; btn.textContent='Post 🚀'; } }
};

// ── FILTER ──
window.filterFeed = function(type, btn) {
  currentFilter = type;
  document.querySelectorAll('#communityDashboard .feed-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};
window.setVisitorFilter = function(type, btn) {
  visitorFilter = type;
  document.querySelectorAll('#visitorView .feed-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

// ── LOAD POSTS ──
function loadPosts() {
  const feed=document.getElementById('postFeed'), loading=document.getElementById('feedLoading'), empty=document.getElementById('emptyFeed');
  if (!feed) return;
  if (loading) loading.style.display='block';
  const q = query(collection(db,'posts'), orderBy('createdAt','desc'));
  onSnapshot(q, snap => {
    if (loading) loading.style.display='none';
    let posts = snap.docs.map(d=>({id:d.id,...d.data()}));
    const el=document.getElementById('totalPosts'); if(el) el.textContent=posts.length;
    posts.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0));
    const filtered = currentFilter==='all' ? posts : posts.filter(p=>p.type===currentFilter);
    feed.innerHTML='';
    if (filtered.length===0) { if(empty) empty.style.display='block'; return; }
    if (empty) empty.style.display='none';
    filtered.forEach(post => feed.appendChild(buildPostCard(post, false)));
    if (currentUser) {
      const myCount=snap.docs.filter(d=>d.data().authorId===currentUser.uid).length;
      const rank=getRank(myCount);
      const badge=document.getElementById('fanRankBadge');
      if(badge){badge.textContent=rank.label;badge.style.color=rank.color;badge.style.borderColor=rank.color;}
    }
  });
}

function loadVisitorPosts() {
  const feed=document.getElementById('visitorPostFeed'), loading=document.getElementById('visitorFeedLoading'),
        empty=document.getElementById('visitorEmptyFeed'), wall=document.getElementById('membershipWall');
  if (!feed) return;
  if (loading) loading.style.display='block';
  const q = query(collection(db,'posts'), orderBy('createdAt','desc'));
  onSnapshot(q, snap => {
    if (loading) loading.style.display='none';
    let posts=snap.docs.map(d=>({id:d.id,...d.data()}));
    posts.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0));
    const filtered=visitorFilter==='all'?posts:posts.filter(p=>p.type===visitorFilter);
    feed.innerHTML='';
    if (filtered.length===0){if(empty)empty.style.display='block';if(wall)wall.style.display='none';return;}
    if (empty) empty.style.display='none';
    filtered.slice(0,VISITOR_PREVIEW_COUNT).forEach(post=>feed.appendChild(buildPostCard(post,true)));
    if(wall) wall.style.display=filtered.length>VISITOR_PREVIEW_COUNT?'block':'none';
  });
}

function loadPreviewPosts() {
  const feed=document.getElementById('previewPostFeed'), loading=document.getElementById('previewFeedLoading');
  if (!feed) return;
  if (loading) loading.style.display='block';
  const q = query(collection(db,'posts'), orderBy('createdAt','desc'));
  onSnapshot(q, snap => {
    if (loading) loading.style.display='none';
    let posts=snap.docs.map(d=>({id:d.id,...d.data()}));
    posts.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||(b.createdAt?.toMillis?.()??0)-(a.createdAt?.toMillis?.()??0));
    feed.innerHTML='';
    posts.slice(0,VISITOR_PREVIEW_COUNT).forEach(post=>feed.appendChild(buildPostCard(post,true)));
    const loaderEl=document.getElementById('previewInfiniteLoader');
    if(loaderEl) loaderEl.style.display=posts.length>0?'flex':'none';
  });
}

// ── BUILD POST CARD ──
function buildPostCard(post, isVisitor=false) {
  const card=document.createElement('div'); card.className='post-card'; card.id='post-'+post.id;
  const isOwner=currentUser&&currentUser.uid===post.authorId;
  const canDel=isAdmin||isSubAdmin||isOwner;
  const hasLiked=currentUser&&(post.likedBy||[]).includes(currentUser.uid);
  const initials=(post.authorName||'F')[0].toUpperCase();
  const typeLabels={post:'💬 Post',news:'📰 News',fanart:'🎨 Fan Art',question:'❓ Question'};
  let memberTag='';
  if(post.isAdmin) memberTag='<span class="admin-tag">👑 ADMIN</span>';
  else if(post.membership){const m=post.membership.toLowerCase();const i=post.membership==='VIP'?'⭐':post.membership==='VVIP'?'💎':'👑';memberTag=`<span class="post-member-tag ${m}">${i} ${post.membership}</span>`;}
  let mediaHTML='';
  if(post.photos?.length){const cnt=Math.min(post.photos.length,3);mediaHTML+=`<div class="post-media-grid count-${cnt}">`;post.photos.slice(0,3).forEach(url=>{mediaHTML+=`<div class="media-cell" onclick="openLightbox('${url}')"><img src="${url}" alt="photo" loading="lazy"></div>`;});mediaHTML+=`</div>`;}
  if(post.videos?.length){post.videos.forEach(url=>{mediaHTML+=`<div class="post-media-grid count-1"><div class="media-cell" style="aspect-ratio:16/9"><video src="${url}" controls style="width:100%;height:100%;object-fit:contain"></video></div></div>`;});}
  if(post.audios?.length){post.audios.forEach(a=>{mediaHTML+=`<div class="post-audio-player"><div class="post-audio-art">🎵</div><div class="post-audio-details"><div class="post-audio-title">${esc(a.name)}</div><div class="post-audio-sub">Audio · ${esc(post.authorName)}</div><audio src="${a.url}" controls></audio></div></div>`;});}
  let footer='';
  if(isVisitor){
    footer=`<div class="visitor-lock" onclick="showMembershipModal()">🔒 Join to like &amp; comment →</div>`;
  } else {
    const commentsArr=post.comments||[];
    footer=`<div class="post-footer">
        <button class="post-action-btn ${hasLiked?'liked':''}" onclick="${canLike()?`toggleLike('${post.id}',${hasLiked})`:`showToast('⚠️ Membership required!')`}">${hasLiked?'❤️':'🤍'} <span>${post.likes||0}</span></button>
        <button class="post-action-btn" onclick="toggleComments('${post.id}')">💬 ${commentsArr.length}</button>
        ${(isAdmin||isSubAdmin)?`<button class="post-action-btn pin-btn ${post.pinned?'pinned':''}" onclick="togglePin('${post.id}',${post.pinned})">📌</button>`:''}
        ${canDel?`<button class="post-action-btn delete-btn" onclick="deletePost('${post.id}')">🗑️</button>`:''}
      </div>
      <div class="comments-section"><div class="comments-list" id="comments-${post.id}">
        ${commentsArr.map(c=>`<div class="comment-item"><div class="comment-avatar">${(c.authorName||'F')[0].toUpperCase()}</div><div class="comment-bubble"><div class="comment-author">${esc(c.authorName||'Fan')}</div><div class="comment-text">${esc(c.text)}</div></div></div>`).join('')}
        ${canComment()?`<div class="comment-input-row"><input type="text" placeholder="Add a comment..." id="commentInput-${post.id}" onkeydown="if(event.key==='Enter')addComment('${post.id}')"><button class="comment-send-btn" onclick="addComment('${post.id}')">➤</button></div>`:`<div class="visitor-lock" onclick="showMembershipModal()">🔒 Join to comment →</div>`}
      </div></div>`;
  }
  card.innerHTML=`
    ${post.pinned?'<div class="pinned-banner">📌 PINNED POST</div>':''}
    <div class="post-header"><div class="post-user-avatar">${initials}</div>
      <div class="post-meta">
        <div class="post-author">${esc(post.authorName||'Fan')} ${memberTag} <span class="post-type-tag">${typeLabels[post.type]||'💬 Post'}</span></div>
        <div class="post-time">${timeAgo(post.createdAt)}</div>
      </div></div>
    ${post.text?`<div class="post-body">${esc(post.text)}</div>`:''}
    ${mediaHTML}${footer}`;
  return card;
}

// ── LIGHTBOX ──
window.openLightbox  = function(src){ const lb=document.getElementById('lightbox'),img=document.getElementById('lightboxImg'); if(lb&&img){img.src=src;lb.classList.add('open');} };
window.closeLightbox = function()   { document.getElementById('lightbox')?.classList.remove('open'); };

// ── LIKE / PIN / DELETE / COMMENTS ──
window.toggleLike = async function(postId, hasLiked) {
  if (!currentUser||!canLike()) { showToast('⚠️ Membership required!'); return; }
  const ref=doc(db,'posts',postId);
  try {
    if(hasLiked) await updateDoc(ref,{likes:increment(-1),likedBy:arrayRemove(currentUser.uid)});
    else { await updateDoc(ref,{likes:increment(1),likedBy:arrayUnion(currentUser.uid)}); showToast('❤️ Liked!'); }
  } catch(e){ showToast('❌ '+e.message); }
};
window.togglePin = async function(postId, isPinned) {
  if(!isAdmin&&!isSubAdmin) return;
  try { await updateDoc(doc(db,'posts',postId),{pinned:!isPinned}); showToast(isPinned?'Unpinned':'📌 Pinned!'); }
  catch(e){ showToast('❌ '+e.message); }
};
window.deletePost = async function(postId) {
  if(!currentUser) return;
  if(!confirm('Delete this post?')) return;
  try { await deleteDoc(doc(db,'posts',postId)); showToast('🗑️ Deleted!'); }
  catch(e){ showToast('❌ '+e.message); }
};
window.toggleComments = function(postId){ document.getElementById('comments-'+postId)?.classList.toggle('open'); };
window.addComment = async function(postId) {
  if(!currentUser||!canComment()){ showToast('⚠️ Membership required!'); return; }
  const input=document.getElementById('commentInput-'+postId);
  const text=input?.value?.trim(); if(!text) return;
  try {
    await updateDoc(doc(db,'posts',postId),{comments:arrayUnion({authorId:currentUser.uid,authorName:currentUser.displayName||currentUser.email.split('@')[0],text,createdAt:Date.now()})});
    if(input) input.value='';
  } catch(e){ showToast('❌ '+e.message); }
};

// ── TOAST ──
window.showToast = function(msg){
  const t=document.getElementById('toast'); if(!t) return;
  t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000);
};

// ══════════════════════════════════════════════════════
//  AUTH STATE — boots everything
// ══════════════════════════════════════════════════════
onAuthStateChanged(auth, async user => {
  const dashboard   = document.getElementById('communityDashboard');
  const denied      = document.getElementById('accessDenied');
  const visitorView = document.getElementById('visitorView');
  const navLogout   = document.getElementById('navLogoutBtn');

  if (user) {
    currentUser = user;
    isAdmin     = ADMIN_EMAILS.includes(user.email);
    isSubAdmin  = SUB_ADMIN_EMAILS.includes(user.email);
    if (navLogout) navLogout.style.display='inline-block';
    if (visitorView) visitorView.style.display='none';

    try {
      const userDoc = await getDoc(doc(db,'users',user.uid));
      if (userDoc.exists()) userMembership = userDoc.data().membership || null;
    } catch(e){ console.warn(e); }

    const hasAccess = isAdmin || isSubAdmin || userMembership;

    if (hasAccess) {
      if (dashboard) dashboard.style.display='block';
      if (denied)    denied.style.display='none';
    } else {
      if (dashboard) dashboard.style.display='none';
      if (denied)    denied.style.display='block';
      loadPreviewPosts();
    }

    // ✅ ADMIN BADGE + NOTIFICATION BAR
    const ab=document.getElementById('adminBadge');
    if (ab) { ab.style.display=(isAdmin||isSubAdmin)?'inline-block':'none'; if(isSubAdmin&&!isAdmin) ab.textContent='🛡️ SUB ADMIN'; }

    // ✅ KEY FIX: Load realtime request notifications for admin
    if (isAdmin || isSubAdmin) {
      loadAdminRequests();
    } else {
      const nb=document.getElementById('adminNotifBar');
      if (nb) nb.style.display='none';
    }

    const name=user.displayName||user.email.split('@')[0];
    const wEl=document.getElementById('welcomeMsg'); if(wEl) wEl.textContent='👋 Welcome, '+name+'!';
    const eEl=document.getElementById('userEmail');  if(eEl) eEl.textContent=user.email;

    setupUIForMembership();
    if (hasAccess) loadPosts();
    const mEl=document.getElementById('totalMembers'); if(mEl) mEl.textContent='1,000+';

  } else {
    currentUser=null; isAdmin=false; isSubAdmin=false; userMembership=null;
    if(dashboard)   dashboard.style.display='none';
    if(denied)      denied.style.display='none';
    if(visitorView) visitorView.style.display='block';
    if(navLogout)   navLogout.style.display='none';
    loadVisitorPosts();
  }
});
