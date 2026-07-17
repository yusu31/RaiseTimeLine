// RaiseTimeLine 静的プロトタイプ用の疑似データ層
// 本物のDB/サーバーは使わず、ブラウザのlocalStorageに疑似データを保持する

const STORAGE_KEYS = {
  users: 'rtl_mock_users',
  posts: 'rtl_mock_posts',
  comments: 'rtl_mock_comments',
  session: 'rtl_mock_session',
};

function seedIfEmpty() {
  if (localStorage.getItem(STORAGE_KEYS.users)) return;

  const users = [
    { id: 1, displayName: '鈴木さん', email: 'suzuki@example.com', password: 'password123' },
    { id: 2, displayName: '高橋さん', email: 'takahashi@example.com', password: 'password123' },
    { id: 3, displayName: '佐藤さん', email: 'sato@example.com', password: 'password123' },
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

  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(posts));
  localStorage.setItem(STORAGE_KEYS.comments, JSON.stringify(comments));
}

function getUsers() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.users) || '[]');
}
function getPosts() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.posts) || '[]');
}
function savePosts(posts) {
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(posts));
}
function getComments() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.comments) || '[]');
}
function saveComments(comments) {
  localStorage.setItem(STORAGE_KEYS.comments, JSON.stringify(comments));
}

function getSession() {
  const raw = localStorage.getItem(STORAGE_KEYS.session);
  return raw ? JSON.parse(raw) : null;
}
function setSession(userId) {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ userId }));
}
function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
}

function findUser(userId) {
  return getUsers().find((u) => u.id === userId);
}

// 未ログインならログイン画面へ強制的に戻す（画面設計書の「初期表示」ルール）
function requireLogin() {
  const session = getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

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

seedIfEmpty();
