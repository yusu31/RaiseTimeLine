import { useEffect, useState } from 'react'
import { AppHeader } from '../components/AppHeader'
import { PostSearchResults } from '../components/PostSearchResults'
import { UserSearchResults } from '../components/UserSearchResults'
import { useLogout } from '../hooks/useLogout'

// 打鍵のたびにAPIを叩かないための待ち時間。短すぎると通信が増え、長すぎると反応が鈍く感じる
const SEARCH_DEBOUNCE_MS = 300

type SearchTab = 'posts' | 'users'

const tabClass = (isActive: boolean) =>
  isActive
    ? 'border-b-2 border-[#1D9BF0] px-1 py-3 text-sm font-bold text-[#0F1419]'
    : 'border-b-2 border-transparent px-1 py-3 text-sm font-bold text-gray-500 transition hover:text-[#0F1419]'

/**
 * 検索画面（S-06）。投稿検索（F-09）とユーザー検索（F-10）を1つの入口にまとめる。
 *
 * 検索ボックスとキーワードはこの画面が持ち、結果の取得と表示はタブごとの子に任せる。
 * タブを切り替えると非表示側の子が取り外されるため、
 * 前のタブの読み込み位置や結果が次のタブに混ざることがない。
 */
export function SearchPage() {
  const { handleLogout, isLoggingOut } = useLogout()

  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [activeTab, setActiveTab] = useState<SearchTab>('posts')

  // 入力が止まってから検索する。次の打鍵でタイマーが破棄されるため、最後の1回だけが生き残る
  useEffect(() => {
    const timerId = setTimeout(() => setDebouncedKeyword(keyword.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timerId)
  }, [keyword])

  return (
    <div className="min-h-screen bg-[#F7F9F9]">
      <AppHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-xl font-bold text-[#0F1419]">検索</h1>

        <input
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="キーワード・ユーザー名で検索"
          aria-label="キーワード・ユーザー名で検索"
          className="mt-4 w-full rounded-full border border-gray-300 px-4 py-2 text-[#0F1419] outline-none focus:border-[#1D9BF0] focus:ring-1 focus:ring-[#1D9BF0]"
        />

        <div className="mt-2 flex gap-6 border-b border-gray-200">
          <button type="button" onClick={() => setActiveTab('posts')} className={tabClass(activeTab === 'posts')}>
            投稿
          </button>
          <button type="button" onClick={() => setActiveTab('users')} className={tabClass(activeTab === 'users')}>
            ユーザー
          </button>
        </div>

        {activeTab === 'posts' ? (
          <PostSearchResults keyword={debouncedKeyword} />
        ) : (
          <UserSearchResults keyword={debouncedKeyword} />
        )}
      </main>
    </div>
  )
}
