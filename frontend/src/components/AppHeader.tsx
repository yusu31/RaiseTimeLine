import { Link } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from './Avatar'

type AppHeaderProps = {
  onLogout: () => void
  isLoggingOut: boolean
}

export function AppHeader({ onLogout, isLoggingOut }: AppHeaderProps) {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur">
      <Link to="/timeline" className="text-lg font-bold text-[#0F1419]">
        RaiseTL
      </Link>
      <nav className="flex items-center gap-3">
        <button type="button" title="ユーザー検索" aria-label="ユーザー検索" className="text-lg text-[#00b8d9]">
          🔍
        </button>
        {user && (
          <Link
            to={`/users/${user.username}`}
            title="プロフィール"
            aria-label="プロフィール"
            className="rounded-full transition hover:opacity-80"
          >
            <Avatar displayName={user.displayName} iconImageUrl={user.iconImageUrl} size="sm" />
          </Link>
        )}
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
