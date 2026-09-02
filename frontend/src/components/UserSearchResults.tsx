import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../api/client'
import { searchUsers } from '../api/userApi'
import { useAuthorizedRequest } from '../hooks/useAuthorizedRequest'
import type { UserSearchResult } from '../types/user'
import { Avatar } from './Avatar'

type UserSearchResultsProps = {
  /** デバウンス済みの検索キーワード。空文字のときは検索しない */
  keyword: string
}

/**
 * 検索画面の「ユーザー」タブの中身（F-10）。
 *
 * 結果からフォローはできない。フォローの入口はプロフィール画面にあるため、
 * ここは「相手を見つける」ところまでを担当する。
 */
export function UserSearchResults({ keyword }: UserSearchResultsProps) {
  const authorizedRequest = useAuthorizedRequest()

  const [users, setUsers] = useState<UserSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 空欄のときは検索しない。前の結果を消すための setState はここでは呼ばず、
    // 「空欄なら結果を描画しない」という下の分岐だけで吸収する（無駄な再描画を増やさないため）
    if (keyword === '') return undefined

    let ignore = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await searchUsers(authorizedRequest, keyword)
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
  }, [authorizedRequest, keyword])

  if (keyword === '') {
    return (
      <p className="mt-6 text-center text-sm text-gray-500">
        @ユーザー名や表示名の一部を入力すると検索できます
      </p>
    )
  }

  return (
    <>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="mt-6 text-center text-sm text-gray-500">読み込み中…</p>
      ) : users.length === 0 && !error ? (
        <p className="mt-4 rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm">
          「{keyword}」に一致するユーザーは見つかりませんでした
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
    </>
  )
}
