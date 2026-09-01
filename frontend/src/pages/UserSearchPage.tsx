import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../api/client'
import { searchUsers } from '../api/userApi'
import { AppHeader } from '../components/AppHeader'
import { Avatar } from '../components/Avatar'
import { useAuthorizedRequest } from '../hooks/useAuthorizedRequest'
import { useLogout } from '../hooks/useLogout'
import type { UserSearchResult } from '../types/user'

// 打鍵のたびにAPIを叩かないための待ち時間。短すぎると通信が増え、長すぎると反応が鈍く感じる
const SEARCH_DEBOUNCE_MS = 300

export function UserSearchPage() {
  const authorizedRequest = useAuthorizedRequest()
  const { handleLogout, isLoggingOut } = useLogout()

  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [users, setUsers] = useState<UserSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 入力が止まってから検索する。次の打鍵でタイマーが破棄されるため、最後の1回だけが生き残る
  useEffect(() => {
    const timerId = setTimeout(() => setDebouncedKeyword(keyword.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timerId)
  }, [keyword])

  useEffect(() => {
    // 空欄のときは検索しない。前の結果を消すためのsetStateはここでは呼ばず、
    // 「空欄なら結果を描画しない」という下の分岐だけで吸収する（無駄な再描画を増やさないため）
    if (debouncedKeyword === '') return undefined

    let ignore = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await searchUsers(authorizedRequest, debouncedKeyword)
        // 通信中に次のキーワードへ進んだ場合、古い結果で上書きしない
        if (ignore) return
        setUsers(response)
      } catch (err) {
        if (ignore) return
        setUsers([])
        setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [authorizedRequest, debouncedKeyword])

  return (
    <div className="min-h-screen bg-[#F7F9F9]">
      <AppHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-xl font-bold text-[#0F1419]">ユーザー検索</h1>

        <input
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="ユーザー名・表示名で検索"
          aria-label="ユーザー名・表示名で検索"
          className="mt-4 w-full rounded-full border border-gray-300 px-4 py-2 text-[#0F1419] outline-none focus:border-[#1D9BF0] focus:ring-1 focus:ring-[#1D9BF0]"
        />

        {/* 検索欄を空に戻したときは、前のキーワードのエラーを残さない */}
        {debouncedKeyword !== '' && error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {debouncedKeyword === '' ? (
          <p className="mt-6 text-center text-sm text-gray-500">
            @ユーザー名や表示名の一部を入力すると検索できます
          </p>
        ) : isLoading ? (
          <p className="mt-6 text-center text-sm text-gray-500">読み込み中…</p>
        ) : users.length === 0 && !error ? (
          <p className="mt-4 rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm">
            「{debouncedKeyword}」に一致するユーザーは見つかりませんでした
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-sm">
            {users.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/users/${encodeURIComponent(item.username)}`}
                  className="flex items-center gap-3 p-4 transition hover:bg-gray-50"
                >
                  <Avatar displayName={item.displayName} iconImageUrl={item.iconImageUrl} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-[#0F1419]">{item.displayName}</span>
                    <span className="block truncate text-sm text-gray-500">@{item.username}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
