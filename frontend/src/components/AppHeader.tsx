type AppHeaderProps = {
  onLogout: () => void
  isLoggingOut: boolean
}

export function AppHeader({ onLogout, isLoggingOut }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur">
      <span className="text-lg font-bold text-[#0F1419]">RaiseTL</span>
      <nav className="flex items-center gap-3">
        <button type="button" title="ユーザー検索" aria-label="ユーザー検索" className="text-lg text-[#00b8d9]">
          🔍
        </button>
        <button type="button" title="プロフィール" aria-label="プロフィール" className="text-lg text-[#7856ff]">
          👤
        </button>
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium text-[#0F1419] transition hover:bg-gray-100 disabled:opacity-50"
        >
          {isLoggingOut ? 'ログアウト中…' : 'ログアウト'}
        </button>
      </nav>
    </header>
  )
}
