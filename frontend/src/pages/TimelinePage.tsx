import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { createPost, deletePost, fetchNewPosts, fetchNewPostsCount, fetchTimeline, updatePost } from '../api/postApi'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { NewPostsBanner } from '../components/NewPostsBanner'
import { PostCard } from '../components/PostCard'
import { PostComposer } from '../components/PostComposer'
import { PostEditModal } from '../components/PostEditModal'
import { useAuth } from '../hooks/useAuth'
import { useAuthorizedRequest } from '../hooks/useAuthorizedRequest'
import type { Post } from '../types/post'

// 短すぎるとWebSocketに近い頻度になり、長すぎると新着への気づきが遅れるためのバランス値
const POLL_INTERVAL_MS = 30_000

export function TimelinePage() {
  const { user, refreshToken, logout } = useAuth()
  const authorizedRequest = useAuthorizedRequest()
  const navigate = useNavigate()

  const [posts, setPosts] = useState<Post[]>([])
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [newPostsCount, setNewPostsCount] = useState(0)
  const [isFetchingNewPosts, setIsFetchingNewPosts] = useState(false)

  // 「もっと見る」で末尾に古い投稿を追加しても最大idは変わらないため、常に配列全体から算出する
  const latestKnownId = useMemo(() => posts.reduce((max, post) => Math.max(max, post.id), 0), [posts])

  useEffect(() => {
    let cancelled = false

    fetchTimeline(authorizedRequest, 0)
      .then((response) => {
        if (cancelled) return
        setPosts(response.posts)
        setPage(response.page)
        setHasNext(response.hasNext)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authorizedRequest])

  useEffect(() => {
    if (isLoading) return undefined

    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | undefined

    const checkNewPosts = () => {
      fetchNewPostsCount(authorizedRequest, latestKnownId)
        .then((response) => {
          if (cancelled) return
          setNewPostsCount(response.count)
        })
        .catch(() => {
          // バックグラウンドの定期チェック失敗は画面のエラー表示に反映せず、次回のポーリングに委ねる
        })
    }

    const startPolling = () => {
      intervalId = setInterval(checkNewPosts, POLL_INTERVAL_MS)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(intervalId)
      } else {
        checkNewPosts()
        startPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [authorizedRequest, latestKnownId, isLoading])

  const handleShowNewPosts = async () => {
    setIsFetchingNewPosts(true)
    try {
      const response = await fetchNewPosts(authorizedRequest, latestKnownId)
      setPosts((current) => [...response.posts, ...current])
      setNewPostsCount(0)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
    } finally {
      setIsFetchingNewPosts(false)
    }
  }

  const handleLoadMore = async () => {
    setIsLoadingMore(true)
    setError(null)
    try {
      const response = await fetchTimeline(authorizedRequest, page + 1)
      setPosts((current) => [...current, ...response.posts])
      setPage(response.page)
      setHasNext(response.hasNext)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleCreatePost = async (content: string, image: File | null) => {
    const created = await createPost(authorizedRequest, content, image)
    setPosts((current) => [created, ...current])
  }

  const handleSaveEdit = async (content: string) => {
    if (!editingPost) return
    const updated = await updatePost(authorizedRequest, editingPost.id, content)
    setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)))
    setEditingPost(null)
  }

  const handleConfirmDelete = async () => {
    if (deletingPostId === null) return
    await deletePost(authorizedRequest, deletingPostId)
    setPosts((current) => current.filter((post) => post.id !== deletingPostId))
    setDeletingPostId(null)
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      if (refreshToken) {
        await authorizedRequest('/auth/logout', { method: 'POST', body: { refreshToken } })
      }
    } catch {
      // ログアウトAPIが失敗しても、ローカルの認証状態は必ず破棄する
    } finally {
      logout()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F9F9]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-[#0F1419]">RaiseTimeLine</h1>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium text-[#0F1419] transition hover:bg-gray-100 disabled:opacity-50"
        >
          {isLoggingOut ? 'ログアウト中…' : 'ログアウト'}
        </button>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        {newPostsCount > 0 && (
          <NewPostsBanner count={newPostsCount} isLoading={isFetchingNewPosts} onClick={handleShowNewPosts} />
        )}

        <PostComposer onSubmit={handleCreatePost} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        {isLoading ? (
          <p className="text-center text-sm text-gray-500">読み込み中…</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-sm text-gray-500">まだ投稿がありません。最初の投稿をしてみましょう。</p>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isOwn={post.author.id === user?.id}
              onEdit={setEditingPost}
              onDeleteRequest={setDeletingPostId}
            />
          ))
        )}

        {hasNext && (
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="mx-auto rounded-full border border-gray-300 px-5 py-2 text-sm font-medium text-[#0F1419] hover:bg-gray-100 disabled:opacity-50"
          >
            {isLoadingMore ? '読み込み中…' : 'もっと見る'}
          </button>
        )}
      </main>

      {editingPost && (
        <PostEditModal post={editingPost} onCancel={() => setEditingPost(null)} onSave={handleSaveEdit} />
      )}

      {deletingPostId !== null && (
        <DeleteConfirmDialog
          message="この投稿を削除しますか？削除した投稿は元に戻せません。"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingPostId(null)}
        />
      )}
    </div>
  )
}
