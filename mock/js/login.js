document.addEventListener('DOMContentLoaded', () => {
  // ログイン済みならタイムラインへ直行（画面設計書の初期表示ルール）
  if (getSession()) {
    window.location.href = 'timeline.html';
    return;
  }

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const user = getUsers().find((u) => u.email === email && u.password === password);
    if (!user) {
      errorEl.textContent = 'メールアドレスまたはパスワードが正しくありません';
      errorEl.hidden = false;
      return;
    }

    errorEl.hidden = true;
    setSession(user.id);
    window.location.href = 'timeline.html';
  });
});
