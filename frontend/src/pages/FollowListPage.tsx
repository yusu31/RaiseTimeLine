import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { fetchFollowers, fetchFollowing } from '../api/followApi'
import { AppHeader } from '../components/AppHeader'
import { Avatar } from '../components/Avatar'
import { FollowButton } from '../components/FollowButton'
import { useAuth } from '../hooks/useAuth'
import { useAuthorizedRequest } from '../hooks/useAuthorizedRequest'
import { useLogout } from '../hooks/useLogout'
import type { FollowListMode, FollowStatus, FollowUser } from '../types/follow'

type FollowListPageProps = {
  mode: FollowListMode
}

/**
 * フォロー中／フォロワーの一覧画面。
 * 表示するデータが違うだけで画面構造は同じなので、mode で切り替えて1つのページで共用する。
 */
export function FollowListPage({ mode }: FollowListPageProps) {
  const { username = '' } = useParams()
  const { user } = useAuth()
  const authorizedRequest = useAuthorizedRequest()
  const { handleLogout, isLoggingOut } = useLogout()

  const [users, setUsers] = useState<FollowUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const fetcher = mode === 'following' ? fetchFollowing : fetchFollowers
        const response = await fetcher(authorizedRequest, username)
        // 読み込み中にタブを切り替えた場合、古い結果で上書きしない
        if (ignore) return
        setUsers(response)
      } catch (err) {
        if (ignore) return
        setUsers([])
        setError(
          err instanceof ApiError && err.status === 404
            ? 'ユーザーが見つかりません'
            : err instanceof ApiError
              ? err.message
              : '通信中にエラーが発生しました',
        )
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [authorizedRequest, username, mode])

  const handleFollowChanged = (targetUsername: string, status: FollowStatus) => {
    setUsers((current) =>
      current.map((item) =>
        item.username === targetUsername ? { ...item, followedByMe: status.followedByMe } : item,
      ),
    )
  }

  const tabClass = (isActive: boolean) =>
    isActive
      ? 'border-b-2 border-[#1D9BF0] px-1 py-3 text-sm font-bold text-[#0F1419]'
      : 'border-b-2 border-transparent px-1 py-3 text-sm font-bold text-gray-500 transition hover:text-[#0F1419]'

  const emptyMessage = mode === 'following' ? 'まだ誰もフォローしていません' : 'まだフォロワーがいません'

  return (
    <div className="min-h-screen bg-[#F7F9F9]">
      <AppHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      <main className="mx-auto max-w-2xl px-4 py-6">
        <Link to={`/users/${encodeURIComponent(username)}`} className="text-sm text-[#1D9BF0] hover:underline">
          ← @{username} のプロフィールに戻る
        </Link>

        <div className="mt-4 flex gap-4 border-b border-gray-200">
          <Link to={`/users/${encodeURIComponent(username)}/following`} className={tabClass(mode === 'following')}>
            フォロー中
          </Link>
          <Link to={`/users/${encodeURIComponent(username)}/followers`} className={tabClass(mode === 'followers')}>
            フォロワー
          </Link>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {isLoading ? (
          <p className="mt-6 text-center text-sm text-gray-500">読み込み中…</p>
        ) : users.length === 0 && !error ? (
          <p className="mt-4 rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm">{emptyMessage}</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-sm">
            {users.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 p-4">
                <Link
                  to={`/users/${encodeURIComponent(item.username)}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <Avatar displayName={item.displayName} iconImageUrl={item.iconImageUrl} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-[#0F1419] hover:underline">
                      {item.displayName}
                    </span>
                    <span className="block truncate text-sm text-gray-500">@{item.username}</span>
                  </span>
                </Link>

                {item.id !== user?.id && (
                  <FollowButton
                    username={item.username}
                    displayName={item.displayName}
                    followedByMe={item.followedByMe}
                    onChanged={(status) => handleFollowChanged(item.username, status)}
                    onError={setError}
                    size="sm"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
