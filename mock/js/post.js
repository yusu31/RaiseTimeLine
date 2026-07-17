document.addEventListener('DOMContentLoaded', () => {
  const session = requireLogin();
  if (!session) return;
  const currentUser = findUser(session.userId);

  const params = new URLSearchParams(window.location.search);
  const postId = Number(params.get('id'));
  const posts = getPosts();
  const post = posts.find((p) => p.id === postId);

  if (!post) {
    document.getElementById('post-detail-root').innerHTML =
      '<p class="empty-state">投稿が見つかりませんでした。</p>';
    return;
  }

  renderPost();
  renderComments();

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
    comments.push({
      id: comments.length ? Math.max(...comments.map((c) => c.id)) + 1 : 1,
      postId: post.id,
      userId: currentUser.id,
      body,
      createdAt: Date.now(),
    });
    saveComments(comments);
    input.value = '';
    renderComments();
  });

  function renderPost() {
    const author = findUser(post.userId);
    const liked = post.likedBy.includes(currentUser.id);
    const el = document.getElementById('post-detail');
    el.innerHTML = `
      <div class="post-card__header">
        <span class="post-card__author">${author.displayName}</span>
        <span class="post-card__time">・${formatRelativeTime(post.createdAt)}</span>
      </div>
      <p class="post-card__body"></p>
      ${post.image ? `<img class="post-card__image" src="${post.image}" alt="投稿画像">` : ''}
      <div class="post-card__actions">
        <button type="button" class="action-btn action-btn--like ${liked ? 'is-liked' : ''}" id="like-btn">${liked ? '❤' : '♡'} <span>${post.likedBy.length}</span></button>
      </div>
    `;
    el.querySelector('.post-card__body').textContent = post.body;
    el.querySelector('#like-btn').addEventListener('click', () => {
      const idx = post.likedBy.indexOf(currentUser.id);
      if (idx >= 0) post.likedBy.splice(idx, 1);
      else post.likedBy.push(currentUser.id);
      savePosts(posts);
      renderPost();
    });
  }

  function renderComments() {
    const comments = getComments()
      .filter((c) => c.postId === post.id)
      .sort((a, b) => a.createdAt - b.createdAt);
    const list = document.getElementById('comment-list');
    document.getElementById('comment-count').textContent = comments.length;
    list.innerHTML = '';

    comments.forEach((c) => {
      const author = findUser(c.userId);
      const item = document.createElement('div');
      item.className = 'comment-card';
      item.innerHTML = `
        <div class="comment-card__header">
          <span class="post-card__author">${author.displayName}</span>
          <span class="post-card__time">・${formatRelativeTime(c.createdAt)}</span>
        </div>
        <p class="comment-card__body"></p>
      `;
      item.querySelector('.comment-card__body').textContent = c.body;
      list.appendChild(item);
    });
  }
});
