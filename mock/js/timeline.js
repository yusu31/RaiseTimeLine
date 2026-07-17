const PAGE_SIZE = 3;
let visibleCount = PAGE_SIZE;
let pendingImage = null;

document.addEventListener('DOMContentLoaded', () => {
  const session = requireLogin();
  if (!session) return;

  const currentUser = findUser(session.userId);
  document.getElementById('current-user-name').textContent = currentUser.displayName;

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });

  const textarea = document.getElementById('post-body');
  const counter = document.getElementById('char-counter');
  const postForm = document.getElementById('post-form');
  const postError = document.getElementById('post-error');
  const imageInput = document.getElementById('image-input');
  const imagePreviewWrap = document.getElementById('image-preview-wrap');
  const imagePreview = document.getElementById('image-preview');
  const imageClearBtn = document.getElementById('image-clear-btn');

  textarea.addEventListener('input', () => {
    const length = textarea.value.length;
    counter.textContent = `${length}/280`;
    counter.classList.toggle('char-counter--over', length > 280);
  });

  imageInput.addEventListener('change', () => {
    postError.hidden = true;
    const file = imageInput.files[0];
    if (!file) {
      pendingImage = null;
      imagePreviewWrap.hidden = true;
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      postError.textContent = '画像はJPEGまたはPNG形式のみ対応しています';
      postError.hidden = false;
      imageInput.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      postError.textContent = '画像サイズは5MB以内にしてください';
      postError.hidden = false;
      imageInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingImage = reader.result;
      imagePreview.src = pendingImage;
      imagePreviewWrap.hidden = false;
    };
    reader.readAsDataURL(file);
  });

  imageClearBtn.addEventListener('click', () => {
    pendingImage = null;
    imageInput.value = '';
    imagePreviewWrap.hidden = true;
  });

  postForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const body = textarea.value.trim();
    postError.hidden = true;

    if (body.length === 0) {
      postError.textContent = '投稿内容を入力してください';
      postError.hidden = false;
      return;
    }
    if (body.length > 280) {
      postError.textContent = '投稿は280文字以内で入力してください';
      postError.hidden = false;
      return;
    }

    const posts = getPosts();
    const newPost = {
      id: posts.length ? Math.max(...posts.map((p) => p.id)) + 1 : 1,
      userId: currentUser.id,
      body,
      image: pendingImage,
      createdAt: Date.now(),
      likedBy: [],
    };
    posts.unshift(newPost);
    savePosts(posts);

    textarea.value = '';
    counter.textContent = '0/280';
    counter.classList.remove('char-counter--over');
    pendingImage = null;
    imageInput.value = '';
    imagePreviewWrap.hidden = true;
    visibleCount = PAGE_SIZE;
    renderPosts();
  });

  document.getElementById('load-more-btn').addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    renderPosts();
  });

  renderPosts();

  function renderPosts() {
    const posts = getPosts().slice().sort((a, b) => b.createdAt - a.createdAt);
    const comments = getComments();
    const list = document.getElementById('post-list');
    list.innerHTML = '';

    if (posts.length === 0) {
      list.innerHTML = '<p class="empty-state">まだ投稿がありません。最初の投稿をしてみましょう。</p>';
    }

    posts.slice(0, visibleCount).forEach((post) => {
      const author = findUser(post.userId);
      const commentCount = comments.filter((c) => c.postId === post.id).length;
      const liked = post.likedBy.includes(currentUser.id);

      const card = document.createElement('article');
      card.className = 'post-card post-card--clickable';
      card.innerHTML = `
        <div class="post-card__header">
          <span class="post-card__author">${author.displayName}</span>
          <span class="post-card__time">・${formatRelativeTime(post.createdAt)}</span>
        </div>
        <p class="post-card__body"></p>
        ${post.image ? `<img class="post-card__image" src="${post.image}" alt="投稿画像">` : ''}
        <div class="post-card__actions">
          <button type="button" class="action-btn action-btn--comment" data-id="${post.id}">💬 <span>${commentCount}</span></button>
          <button type="button" class="action-btn action-btn--like ${liked ? 'is-liked' : ''}" data-id="${post.id}">${liked ? '❤' : '♡'} <span>${post.likedBy.length}</span></button>
        </div>
      `;
      card.querySelector('.post-card__body').textContent = post.body;

      card.querySelector('.action-btn--comment').addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `post.html?id=${post.id}`;
      });
      card.querySelector('.action-btn--like').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLike(post.id);
      });
      card.addEventListener('click', () => {
        window.location.href = `post.html?id=${post.id}`;
      });

      list.appendChild(card);
    });

    const loadMoreBtn = document.getElementById('load-more-btn');
    loadMoreBtn.hidden = visibleCount >= posts.length;
  }

  function toggleLike(postId) {
    const posts = getPosts();
    const post = posts.find((p) => p.id === postId);
    const idx = post.likedBy.indexOf(currentUser.id);
    if (idx >= 0) {
      post.likedBy.splice(idx, 1);
    } else {
      post.likedBy.push(currentUser.id);
    }
    savePosts(posts);
    renderPosts();
  }
});
