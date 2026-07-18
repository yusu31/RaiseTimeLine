// RaiseTimeLine 静的プロトタイプ（SPA形式）
// 1枚のindex.htmlの中で、JSが「今どの画面を表示するか」を切り替えている。
// 本物のDB/サーバーは使わず、疑似データはブラウザのlocalStorageに保持する。

const STORAGE_KEYS = {
  users: 'rtl_proto_users',
  posts: 'rtl_proto_posts',
  comments: 'rtl_proto_comments',
  follows: 'rtl_proto_follows',
  session: 'rtl_proto_session',
};

const PAGE_SIZE = 3;
const AVATAR_COLORS = ['#1d9bf0', '#f91880', '#00ba7c', '#ffad1f', '#7856ff'];

let currentUser = null;
let timelineTab = 'all';
let timelineVisibleCount = PAGE_SIZE;
let postModalMode = null; // {type:'create'} | {type:'edit', postId}
let pendingPostImage = null;
let pendingProfileIcon = null;
let confirmCallback = null;

const state = {
  profileUserId: null,
  postDetailId: null,
  followListUserId: null,
  followListTab: 'following',
};

/* ---------------- 疑似データ層 ---------------- */

function seedIfEmpty() {
  if (localStorage.getItem(STORAGE_KEYS.users)) return;

  const users = [
    { id: 1, email: 'suzuki@example.com', password: 'password123', username: 'suzuki_raise', displayName: '鈴木さん', bio: 'RaiseTechでSpring Bootを学習中です。', icon: null },
    { id: 2, email: 'takahashi@example.com', password: 'password123', username: 'takahashi_t', displayName: '高橋さん', bio: '趣味の写真を記録しています。', icon: null },
    { id: 3, email: 'sato@example.com', password: 'password123', username: 'sato_dev', displayName: '佐藤さん', bio: '設計から丁寧にやりたい派です。', icon: null },
  ];

  const now = Date.now();
  const posts = [
    { id: 1, userId: 1, body: '今日はSpring Securityの講義。JWTむずかしい…', image: null, createdAt: now - 5 * 60 * 1000, likedBy: [2, 3] },
    { id: 2, userId: 2, body: '週末に撮った写真です', image: null, createdAt: now - 60 * 60 * 1000, likedBy: [1] },
    { id: 3, userId: 3, body: 'ER図を書き終えた。設計は9割大事というのを実感中', image: null, createdAt: now - 3 * 60 * 60 * 1000, likedBy: [] },
    { id: 4, userId: 1, body: 'JPAのN+1問題、集計クエリでまとめて取るのがコツらしい', image: null, createdAt: now - 5 * 60 * 60 * 1000, likedBy: [2] },
    { id: 5, userId: 2, body: 'Tailwindのユーティリティクラス、慣れると早い', image: null, createdAt: now - 26 * 60 * 60 * 1000, likedBy: [] },
    { id: 6, userId: 3, body: 'Flywayでマイグレーション管理、バージョン管理と相性がいい', image: null, createdAt: now - 30 * 60 * 60 * 1000, likedBy: [1, 2] },
    { id: 7, userId: 2, body: 'いいね機能はトグル式。二重いいね防止はDBのユニーク制約で対応予定', image: null, createdAt: now - 48 * 60 * 60 * 1000, likedBy: [] },
  ];

  const comments = [
    { id: 1, postId: 1, userId: 2, body: '私も最初は苦戦しました！', createdAt: now - 3 * 60 * 1000 },
    { id: 2, postId: 1, userId: 3, body: '図に書くと理解しやすいですよ', createdAt: now - 1 * 60 * 1000 },
    { id: 3, postId: 2, userId: 1, body: 'いい写真ですね', createdAt: now - 50 * 60 * 1000 },
  ];

  const follows = [
    { followerId: 1, followeeId: 2 },
    { followerId: 2, followeeId: 1 },
    { followerId: 2, followeeId: 3 },
  ];

  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(posts));
  localStorage.setItem(STORAGE_KEYS.comments, JSON.stringify(comments));
  localStorage.setItem(STORAGE_KEYS.follows, JSON.stringify(follows));
}

function getUsers() { return JSON.parse(localStorage.getItem(STORAGE_KEYS.users) || '[]'); }
function saveUsers(v) { localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(v)); }
function getPosts() { return JSON.parse(localStorage.getItem(STORAGE_KEYS.posts) || '[]'); }
function savePosts(v) { localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(v)); }
function getComments() { return JSON.parse(localStorage.getItem(STORAGE_KEYS.comments) || '[]'); }
function saveComments(v) { localStorage.setItem(STORAGE_KEYS.comments, JSON.stringify(v)); }
function getFollows() { return JSON.parse(localStorage.getItem(STORAGE_KEYS.follows) || '[]'); }
function saveFollows(v) { localStorage.setItem(STORAGE_KEYS.follows, JSON.stringify(v)); }

function getSession() {
  const raw = localStorage.getItem(STORAGE_KEYS.session);
  return raw ? JSON.parse(raw) : null;
}
function setSession(userId) { localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ userId })); }
function clearSession() { localStorage.removeItem(STORAGE_KEYS.session); }

function findUser(userId) { return getUsers().find((u) => u.id === userId); }
function nextId(arr) { return arr.length ? Math.max(...arr.map((x) => x.id)) + 1 : 1; }

function isFollowing(followerId, followeeId) {
  return getFollows().some((f) => f.followerId === followerId && f.followeeId === followeeId);
}
function followingIds(userId) { return getFollows().filter((f) => f.followerId === userId).map((f) => f.followeeId); }
function followerIds(userId) { return getFollows().filter((f) => f.followeeId === userId).map((f) => f.followerId); }
function followingCount(userId) { return followingIds(userId).length; }
function followerCount(userId) { return followerIds(userId).length; }

function formatRelativeTime(timestamp) {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function avatarColor(userId) {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}
function renderAvatar(user, size) {
  if (user.icon) {
    return `<img class="avatar avatar--${size}" src="${user.icon}" alt="${escapeHtml(user.displayName)}のアイコン">`;
  }
  const initial = (user.displayName || '?').charAt(0);
  return `<span class="avatar avatar--${size}" style="background:${avatarColor(user.id)}">${escapeHtml(initial)}</span>`;
}

/* ---------------- 画面切り替え（SPAの中心部分） ---------------- */

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((el) => { el.hidden = true; });
  document.getElementById(id).hidden = false;
  document.getElementById('app-header').hidden = (id === 'screen-login' || id === 'screen-signup');
  window.scrollTo(0, 0);
}

function goTimeline() {
  timelineTab = 'all';
  timelineVisibleCount = PAGE_SIZE;
  syncTimelineTabsUI();
  showScreen('screen-timeline');
  renderTimeline();
}
function goPostDetail(postId) {
  state.postDetailId = postId;
  showScreen('screen-post-detail');
  renderPostDetail(postId);
}
function goProfile(userId) {
  state.profileUserId = userId;
  showScreen('screen-profile');
  renderProfile(userId);
}
function goProfileEdit() {
  showScreen('screen-profile-edit');
  fillProfileEditForm();
}
function goSearch() {
  showScreen('screen-search');
  document.getElementById('search-input').value = '';
  renderSearchResults('');
}
function goFollowList(userId, tab) {
  state.followListUserId = userId;
  state.followListTab = tab;
  showScreen('screen-follow-list');
  syncFollowTabsUI();
  renderFollowList();
}

function rerenderCurrentScreen() {
  if (!document.getElementById('screen-timeline').hidden) renderTimeline();
  if (!document.getElementById('screen-post-detail').hidden) renderPostDetail(state.postDetailId);
  if (!document.getElementById('screen-profile').hidden) renderProfile(state.profileUserId);
}

/* ---------------- 投稿カード（タイムライン・詳細・プロフィールで共用） ---------------- */

function renderPostCard(post) {
  const author = findUser(post.userId);
  const commentCount = getComments().filter((c) => c.postId === post.id).length;
  const liked = post.likedBy.includes(currentUser.id);
  const isOwn = post.userId === currentUser.id;

  return `
    <article class="post-card" data-action="open-post" data-post-id="${post.id}">
      <div class="post-card__header">
        <span class="avatar-link" data-action="open-profile" data-user-id="${post.userId}">
          ${renderAvatar(author, 'sm')}
          <span class="post-card__author">${escapeHtml(author.displayName)}</span>
          <span class="post-card__username">@${escapeHtml(author.username)}</span>
        </span>
        <span class="post-card__time">${formatRelativeTime(post.createdAt)}</span>
      </div>
      <p class="post-card__body">${escapeHtml(post.body)}</p>
      ${post.image ? `<img class="post-card__image" src="${post.image}" alt="投稿画像">` : ''}
      <div class="post-card__actions">
        <button type="button" class="action-btn" data-action="open-post" data-post-id="${post.id}">💬 <span>${commentCount}</span></button>
        <button type="button" class="action-btn action-btn--like ${liked ? 'is-liked' : ''}" data-action="like" data-post-id="${post.id}">${liked ? '❤' : '♡'} <span>${post.likedBy.length}</span></button>
        ${isOwn ? `
          <button type="button" class="action-btn" data-action="edit-post" data-post-id="${post.id}">✏️ 編集</button>
          <button type="button" class="action-btn" data-action="delete-post" data-post-id="${post.id}">🗑 削除</button>
        ` : ''}
      </div>
    </article>
  `;
}

/* ---------------- 3. タイムライン画面 ---------------- */

function renderTimeline() {
  const allPosts = getPosts().slice().sort((a, b) => b.createdAt - a.createdAt);
  const posts = timelineTab === 'all'
    ? allPosts
    : allPosts.filter((p) => followingIds(currentUser.id).includes(p.userId));

  const list = document.getElementById('timeline-post-list');
  list.innerHTML = posts.length === 0
    ? '<p class="empty-state">投稿がありません</p>'
    : posts.slice(0, timelineVisibleCount).map(renderPostCard).join('');

  document.getElementById('timeline-load-more-btn').hidden = timelineVisibleCount >= posts.length;
}

function syncTimelineTabsUI() {
  document.querySelectorAll('#screen-timeline .tab-btn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.tab === timelineTab);
  });
}

/* ---------------- 6. 投稿詳細画面 ---------------- */

function renderPostDetail(postId) {
  const post = getPosts().find((p) => p.id === postId);
  if (!post) {
    document.getElementById('post-detail-card').innerHTML = '<p class="empty-state">投稿が見つかりませんでした。</p>';
    document.getElementById('comment-list').innerHTML = '';
    document.getElementById('comment-count').textContent = '0';
    return;
  }
  document.getElementById('post-detail-card').innerHTML = renderPostCard(post);
  renderCommentList(postId);
}

function renderCommentList(postId) {
  const comments = getComments().filter((c) => c.postId === postId).sort((a, b) => a.createdAt - b.createdAt);
  document.getElementById('comment-count').textContent = comments.length;
  document.getElementById('comment-list').innerHTML = comments.map((c) => {
    const author = findUser(c.userId);
    const isOwn = c.userId === currentUser.id;
    return `
      <div class="comment-card">
        <div class="comment-card__header">
          <span class="avatar-link" data-action="open-profile" data-user-id="${author.id}">
            ${renderAvatar(author, 'sm')}
            <span class="post-card__author">${escapeHtml(author.displayName)}</span>
          </span>
          <span class="post-card__time">${formatRelativeTime(c.createdAt)}</span>
          ${isOwn ? `<button type="button" class="link-btn link-btn--danger" data-action="delete-comment" data-comment-id="${c.id}">削除</button>` : ''}
        </div>
        <p class="comment-card__body">${escapeHtml(c.body)}</p>
      </div>
    `;
  }).join('');
}

/* ---------------- 7. プロフィール画面 ---------------- */

function renderProfile(userId) {
  const user = findUser(userId);
  document.getElementById('profile-icon').innerHTML = renderAvatar(user, 'lg');
  document.getElementById('profile-display-name').textContent = user.displayName;
  document.getElementById('profile-username').textContent = `@${user.username}`;
  document.getElementById('profile-bio').textContent = user.bio || '';
  document.getElementById('profile-following-count').textContent = `${followingCount(userId)} フォロー中`;
  document.getElementById('profile-follower-count').textContent = `${followerCount(userId)} フォロワー`;

  const isSelf = userId === currentUser.id;
  const editBtn = document.getElementById('profile-edit-btn');
  const followBtn = document.getElementById('profile-follow-btn');
  editBtn.hidden = !isSelf;
  followBtn.hidden = isSelf;
  if (!isSelf) {
    const following = isFollowing(currentUser.id, userId);
    followBtn.textContent = following ? 'フォロー解除' : 'フォロー';
    followBtn.classList.toggle('btn--danger-outline', following);
    followBtn.classList.toggle('btn--primary', !following);
  }

  const posts = getPosts().filter((p) => p.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  document.getElementById('profile-post-list').innerHTML = posts.length
    ? posts.map(renderPostCard).join('')
    : '<p class="empty-state">投稿がありません</p>';
}

function fillProfileEditForm() {
  const user = currentUser;
  document.getElementById('profile-edit-display-name').value = user.displayName;
  document.getElementById('profile-edit-username').value = user.username;
  document.getElementById('profile-edit-bio').value = user.bio || '';
  pendingProfileIcon = user.icon || null;
  document.getElementById('profile-edit-icon-preview').innerHTML = renderAvatar(user, 'sm');
  updateBioCounter();
  document.getElementById('profile-edit-error').hidden = true;
}

function updateBioCounter() {
  const len = document.getElementById('profile-edit-bio').value.length;
  const remaining = 160 - len;
  const el = document.getElementById('profile-edit-bio-counter');
  el.textContent = `残り ${remaining}文字`;
  el.classList.toggle('char-counter--over', remaining < 0);
}

/* ---------------- 9. ユーザー検索画面 ---------------- */

function renderUserRow(user, opts) {
  opts = opts || {};
  const following = isFollowing(currentUser.id, user.id);
  const isSelf = user.id === currentUser.id;
  return `
    <div class="user-row">
      <span class="user-row__clickable" data-action="open-profile" data-user-id="${user.id}">
        ${renderAvatar(user, 'sm')}
        <div class="user-row__info">
          <span class="user-row__name">${escapeHtml(user.displayName)}</span>
          <span class="user-row__username">@${escapeHtml(user.username)}</span>
        </div>
      </span>
      ${opts.showFollowButton && !isSelf ? `<button type="button" class="btn btn--small ${following ? 'btn--danger-outline' : 'btn--primary'}" data-action="toggle-follow" data-user-id="${user.id}">${following ? 'フォロー解除' : 'フォロー'}</button>` : ''}
    </div>
  `;
}

function renderSearchResults(query) {
  const q = query.trim().toLowerCase();
  const users = getUsers().filter((u) => {
    if (!q) return true;
    return u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q);
  });
  const list = document.getElementById('search-result-list');
  list.innerHTML = users.length
    ? users.map((u) => renderUserRow(u, { showFollowButton: false })).join('')
    : '<p class="empty-state">該当するユーザーが見つかりません</p>';
}

/* ---------------- 10. フォロー/フォロワー一覧画面 ---------------- */

function renderFollowList() {
  const ids = state.followListTab === 'following' ? followingIds(state.followListUserId) : followerIds(state.followListUserId);
  const users = ids.map(findUser).filter(Boolean);
  const list = document.getElementById('follow-list-users');
  list.innerHTML = users.length
    ? users.map((u) => renderUserRow(u, { showFollowButton: true })).join('')
    : '<p class="empty-state">まだ誰もいません</p>';
}

function syncFollowTabsUI() {
  document.querySelectorAll('#screen-follow-list .tab-btn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.followTab === state.followListTab);
  });
}

/* ---------------- 投稿の作成・編集モーダル ---------------- */

function openPostCreateModal() {
  postModalMode = { type: 'create' };
  pendingPostImage = null;
  document.getElementById('post-modal-title').textContent = '投稿する';
  document.getElementById('post-modal-body').value = '';
  document.getElementById('post-modal-image-wrap').hidden = true;
  document.getElementById('post-modal-counter').textContent = '残り 280文字';
  document.getElementById('post-modal-counter').classList.remove('char-counter--over');
  document.getElementById('post-modal-error').hidden = true;
  document.getElementById('post-modal-submit').textContent = '投稿する';
  document.getElementById('post-modal').hidden = false;
}

function openPostEditModal(postId) {
  const post = getPosts().find((p) => p.id === postId);
  postModalMode = { type: 'edit', postId };
  pendingPostImage = post.image;
  document.getElementById('post-modal-title').textContent = '投稿を編集';
  document.getElementById('post-modal-body').value = post.body;
  const wrap = document.getElementById('post-modal-image-wrap');
  if (post.image) {
    document.getElementById('post-modal-image-preview').src = post.image;
    wrap.hidden = false;
  } else {
    wrap.hidden = true;
  }
  updatePostModalCounter();
  document.getElementById('post-modal-error').hidden = true;
  document.getElementById('post-modal-submit').textContent = '更新する';
  document.getElementById('post-modal').hidden = false;
}

function closePostModal() {
  document.getElementById('post-modal').hidden = true;
  postModalMode = null;
}

function updatePostModalCounter() {
  const len = document.getElementById('post-modal-body').value.length;
  const remaining = 280 - len;
  const counterEl = document.getElementById('post-modal-counter');
  counterEl.textContent = `残り ${remaining}文字`;
  counterEl.classList.toggle('char-counter--over', remaining < 0);
}

function handleImageSelect(fileInput, previewImgEl, wrapEl, errorEl, onSuccess) {
  const file = fileInput.files[0];
  errorEl.hidden = true;
  if (!file) { wrapEl.hidden = true; onSuccess(null); return; }
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    errorEl.textContent = '画像はJPEGまたはPNG形式のみ対応しています';
    errorEl.hidden = false;
    fileInput.value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    errorEl.textContent = '画像サイズは5MB以内にしてください';
    errorEl.hidden = false;
    fileInput.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    previewImgEl.src = reader.result;
    wrapEl.hidden = false;
    onSuccess(reader.result);
  };
  reader.readAsDataURL(file);
}

/* ---------------- 削除確認ダイアログ ---------------- */

function openConfirm(message, onConfirm) {
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = onConfirm;
  document.getElementById('confirm-modal').hidden = false;
}
function closeConfirm() {
  document.getElementById('confirm-modal').hidden = true;
  confirmCallback = null;
}

function deletePost(postId) {
  openConfirm('この投稿を削除しますか？削除した投稿は元に戻せません。', () => {
    savePosts(getPosts().filter((p) => p.id !== postId));
    saveComments(getComments().filter((c) => c.postId !== postId));
    if (state.postDetailId === postId) { goTimeline(); return; }
    rerenderCurrentScreen();
  });
}
function deleteComment(commentId) {
  openConfirm('このコメントを削除しますか？削除したコメントは元に戻せません。', () => {
    saveComments(getComments().filter((c) => c.id !== commentId));
    renderCommentList(state.postDetailId);
    rerenderCurrentScreen();
  });
}

function toggleLike(postId) {
  const posts = getPosts();
  const post = posts.find((p) => p.id === postId);
  const idx = post.likedBy.indexOf(currentUser.id);
  if (idx >= 0) post.likedBy.splice(idx, 1);
  else post.likedBy.push(currentUser.id);
  savePosts(posts);
  rerenderCurrentScreen();
}

function toggleFollow(targetUserId) {
  if (targetUserId === currentUser.id) return;
  const follows = getFollows();
  const idx = follows.findIndex((f) => f.followerId === currentUser.id && f.followeeId === targetUserId);
  if (idx >= 0) follows.splice(idx, 1);
  else follows.push({ followerId: currentUser.id, followeeId: targetUserId });
  saveFollows(follows);
  if (!document.getElementById('screen-profile').hidden) renderProfile(state.profileUserId);
  if (!document.getElementById('screen-follow-list').hidden) renderFollowList();
}

/* ---------------- 動的な一覧に対するクリック処理（イベント委譲） ----------------
   一覧はinnerHTMLで丸ごと作り直すので、要素ひとつひとつにリスナーを付け直す代わりに、
   親要素1つにリスナーを置いて「クリックされた場所に一番近いdata-action」で判定する。 */

function handleDataAction(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  switch (action) {
    case 'open-post': goPostDetail(Number(el.dataset.postId)); break;
    case 'like': toggleLike(Number(el.dataset.postId)); break;
    case 'edit-post': openPostEditModal(Number(el.dataset.postId)); break;
    case 'delete-post': deletePost(Number(el.dataset.postId)); break;
    case 'open-profile': goProfile(Number(el.dataset.userId)); break;
    case 'delete-comment': deleteComment(Number(el.dataset.commentId)); break;
    case 'toggle-follow': toggleFollow(Number(el.dataset.userId)); break;
  }
}

/* ---------------- 初期化・イベントバインド ---------------- */

function bindEvents() {
  ['timeline-post-list', 'profile-post-list', 'comment-list', 'search-result-list', 'follow-list-users', 'post-detail-card'].forEach((id) => {
    document.getElementById(id).addEventListener('click', handleDataAction);
  });

  // ヘッダー
  document.getElementById('nav-search-btn').addEventListener('click', goSearch);
  document.getElementById('nav-profile-btn').addEventListener('click', () => goProfile(currentUser.id));
  document.getElementById('logout-btn').addEventListener('click', () => {
    clearSession();
    currentUser = null;
    showScreen('screen-login');
  });

  // 戻るリンク
  document.getElementById('post-detail-back').addEventListener('click', (e) => { e.preventDefault(); goTimeline(); });
  document.getElementById('profile-back').addEventListener('click', (e) => { e.preventDefault(); goTimeline(); });
  document.getElementById('profile-edit-back').addEventListener('click', (e) => { e.preventDefault(); goProfile(currentUser.id); });
  document.getElementById('search-back').addEventListener('click', (e) => { e.preventDefault(); goTimeline(); });
  document.getElementById('follow-list-back').addEventListener('click', (e) => { e.preventDefault(); goProfile(state.followListUserId); });

  // 投稿詳細のコメント送信
  document.getElementById('comment-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('comment-body');
    const body = input.value.trim();
    const errorEl = document.getElementById('comment-error');
    errorEl.hidden = true;
    if (!body) {
      errorEl.textContent = 'コメントを入力してください';
      errorEl.hidden = false;
      return;
    }
    const comments = getComments();
    comments.push({ id: nextId(comments), postId: state.postDetailId, userId: currentUser.id, body, createdAt: Date.now() });
    saveComments(comments);
    input.value = '';
    renderCommentList(state.postDetailId);
    if (!document.getElementById('screen-timeline').hidden) renderTimeline();
  });

  // ログイン
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const user = getUsers().find((u) => u.email === email && u.password === password);
    const errorEl = document.getElementById('login-error');
    if (!user) {
      errorEl.textContent = 'メールアドレスまたはパスワードが正しくありません';
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    loginAs(user);
  });
  document.getElementById('go-to-signup').addEventListener('click', (e) => { e.preventDefault(); showScreen('screen-signup'); });
  document.getElementById('go-to-login').addEventListener('click', (e) => { e.preventDefault(); showScreen('screen-login'); });

  // 新規登録（リアルタイムバリデーション）
  ['signup-email', 'signup-password', 'signup-password-confirm', 'signup-username'].forEach((id) => {
    document.getElementById(id).addEventListener('input', validateSignup);
  });
  document.getElementById('signup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('signup-error');
    errorEl.hidden = true;
    if (!validateSignup()) {
      errorEl.textContent = '入力内容を確認してください';
      errorEl.hidden = false;
      return;
    }
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const username = document.getElementById('signup-username').value.trim();
    const users = getUsers();
    const newUser = { id: nextId(users), email, password, username, displayName: username, bio: '', icon: null };
    users.push(newUser);
    saveUsers(users);
    loginAs(newUser);
  });

  // タイムラインのタブ
  document.querySelectorAll('#screen-timeline .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      timelineTab = btn.dataset.tab;
      timelineVisibleCount = PAGE_SIZE;
      syncTimelineTabsUI();
      renderTimeline();
    });
  });
  document.getElementById('timeline-load-more-btn').addEventListener('click', () => {
    timelineVisibleCount += PAGE_SIZE;
    renderTimeline();
  });

  // フォロー一覧のタブ
  document.querySelectorAll('#screen-follow-list .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.followListTab = btn.dataset.followTab;
      syncFollowTabsUI();
      renderFollowList();
    });
  });

  // プロフィール
  document.getElementById('profile-following-count').addEventListener('click', () => goFollowList(state.profileUserId, 'following'));
  document.getElementById('profile-follower-count').addEventListener('click', () => goFollowList(state.profileUserId, 'followers'));
  document.getElementById('profile-edit-btn').addEventListener('click', goProfileEdit);
  document.getElementById('profile-follow-btn').addEventListener('click', () => toggleFollow(state.profileUserId));

  // プロフィール編集
  document.getElementById('profile-edit-bio').addEventListener('input', updateBioCounter);
  document.getElementById('profile-edit-icon-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const errorEl = document.getElementById('profile-edit-error');
    errorEl.hidden = true;
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      errorEl.textContent = '画像はJPEGまたはPNG形式のみ対応しています';
      errorEl.hidden = false;
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      errorEl.textContent = '画像サイズは5MB以内にしてください';
      errorEl.hidden = false;
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingProfileIcon = reader.result;
      document.getElementById('profile-edit-icon-preview').innerHTML = `<img class="avatar avatar--sm" src="${reader.result}" alt="プレビュー">`;
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('profile-edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const displayName = document.getElementById('profile-edit-display-name').value.trim();
    const username = document.getElementById('profile-edit-username').value.trim();
    const bio = document.getElementById('profile-edit-bio').value.trim();
    const errorEl = document.getElementById('profile-edit-error');
    errorEl.hidden = true;

    if (!displayName) { errorEl.textContent = '表示名を入力してください'; errorEl.hidden = false; return; }
    if (!/^[A-Za-z0-9_]+$/.test(username)) { errorEl.textContent = 'ユーザー名は英数字とアンダースコアのみ使用できます'; errorEl.hidden = false; return; }
    const dup = getUsers().find((u) => u.username === username && u.id !== currentUser.id);
    if (dup) { errorEl.textContent = 'そのユーザー名は既に使われています'; errorEl.hidden = false; return; }
    if (bio.length > 160) { errorEl.textContent = '自己紹介は160文字以内で入力してください'; errorEl.hidden = false; return; }

    const users = getUsers();
    const user = users.find((u) => u.id === currentUser.id);
    user.displayName = displayName;
    user.username = username;
    user.bio = bio;
    user.icon = pendingProfileIcon;
    saveUsers(users);
    currentUser = user;
    goProfile(currentUser.id);
  });

  // ユーザー検索
  document.getElementById('search-input').addEventListener('input', (e) => renderSearchResults(e.target.value));

  // 投稿作成/編集モーダル
  document.getElementById('open-post-create-btn').addEventListener('click', openPostCreateModal);
  document.getElementById('post-modal-close').addEventListener('click', closePostModal);
  document.getElementById('post-modal-body').addEventListener('input', updatePostModalCounter);
  document.getElementById('post-modal-image-input').addEventListener('change', (e) => {
    handleImageSelect(
      e.target,
      document.getElementById('post-modal-image-preview'),
      document.getElementById('post-modal-image-wrap'),
      document.getElementById('post-modal-error'),
      (dataUrl) => { pendingPostImage = dataUrl; }
    );
  });
  document.getElementById('post-modal-image-clear').addEventListener('click', () => {
    pendingPostImage = null;
    document.getElementById('post-modal-image-input').value = '';
    document.getElementById('post-modal-image-wrap').hidden = true;
  });
  document.getElementById('post-modal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const body = document.getElementById('post-modal-body').value.trim();
    const errorEl = document.getElementById('post-modal-error');
    errorEl.hidden = true;
    if (!body) { errorEl.textContent = '投稿内容を入力してください'; errorEl.hidden = false; return; }
    if (body.length > 280) { errorEl.textContent = '投稿は280文字以内で入力してください'; errorEl.hidden = false; return; }

    const posts = getPosts();
    if (postModalMode.type === 'create') {
      posts.unshift({ id: nextId(posts), userId: currentUser.id, body, image: pendingPostImage, createdAt: Date.now(), likedBy: [] });
    } else {
      const post = posts.find((p) => p.id === postModalMode.postId);
      post.body = body;
      post.image = pendingPostImage;
    }
    savePosts(posts);
    closePostModal();
    timelineVisibleCount = PAGE_SIZE;
    rerenderCurrentScreen();
  });

  // 削除確認ダイアログ
  document.getElementById('confirm-cancel-btn').addEventListener('click', closeConfirm);
  document.getElementById('confirm-ok-btn').addEventListener('click', () => {
    const cb = confirmCallback;
    closeConfirm();
    if (cb) cb();
  });
}

function validateSignup() {
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-password-confirm').value;
  const username = document.getElementById('signup-username').value.trim();

  const emailHint = document.getElementById('signup-email-hint');
  const passwordHint = document.getElementById('signup-password-hint');
  const confirmHint = document.getElementById('signup-password-confirm-hint');
  const usernameHint = document.getElementById('signup-username-hint');

  let ok = true;

  if (!email) { emailHint.textContent = ''; emailHint.classList.remove('field-hint--error'); ok = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { emailHint.textContent = 'メールアドレスの形式が正しくありません'; emailHint.classList.add('field-hint--error'); ok = false; }
  else if (getUsers().some((u) => u.email === email)) { emailHint.textContent = 'このメールアドレスは既に登録されています'; emailHint.classList.add('field-hint--error'); ok = false; }
  else { emailHint.textContent = ''; emailHint.classList.remove('field-hint--error'); }

  if (!password) { passwordHint.textContent = ''; ok = false; }
  else if (password.length < 8) { passwordHint.textContent = '8文字以上で入力してください'; passwordHint.classList.add('field-hint--error'); ok = false; }
  else { passwordHint.textContent = ''; passwordHint.classList.remove('field-hint--error'); }

  if (!confirmPassword) { confirmHint.textContent = ''; ok = false; }
  else if (confirmPassword !== password) { confirmHint.textContent = 'パスワードが一致しません'; confirmHint.classList.add('field-hint--error'); ok = false; }
  else { confirmHint.textContent = ''; confirmHint.classList.remove('field-hint--error'); }

  if (!username) { usernameHint.textContent = ''; ok = false; }
  else if (!/^[A-Za-z0-9_]+$/.test(username)) { usernameHint.textContent = '英数字とアンダースコアのみ使用できます'; usernameHint.classList.add('field-hint--error'); ok = false; }
  else if (getUsers().some((u) => u.username === username)) { usernameHint.textContent = 'このユーザー名は既に使われています'; usernameHint.classList.add('field-hint--error'); ok = false; }
  else { usernameHint.textContent = ''; usernameHint.classList.remove('field-hint--error'); }

  return ok;
}

function loginAs(user) {
  currentUser = user;
  setSession(user.id);
  goTimeline();
}

document.addEventListener('DOMContentLoaded', () => {
  seedIfEmpty();
  bindEvents();

  const session = getSession();
  const user = session ? findUser(session.userId) : null;
  if (user) {
    currentUser = user;
    goTimeline();
  } else {
    showScreen('screen-login');
  }
});
