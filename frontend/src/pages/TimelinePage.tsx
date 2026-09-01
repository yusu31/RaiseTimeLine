import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import { likePost, unlikePost } from '../api/likeApi'
import { createPost, deletePost, fetchNewPosts, fetchNewPostsCount, fetchTimeline, updatePost } from '../api/postApi'
import { AppHeader } from '../components/AppHeader'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { NewPostsBanner } from '../components/NewPostsBanner'
import { PostCard } from '../components/PostCard'
import { PostComposer } from '../components/PostComposer'
import { PostEditModal } from '../components/PostEditModal'
import { useAuth } from '../hooks/useAuth'
import { useAuthorizedRequest } from '../hooks/useAuthorizedRequest'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import { useLogout } from '../hooks/useLogout'
import type { TimelineMode } from '../api/postApi'
import type { Post } from '../types/post'

// 短すぎるとWebSocketに近い頻度になり、長すぎると新着への気づきが遅れるためのバランス値
const POLL_INTERVAL_MS = 30_000

const tabClass = (isActive: boolean) =>
  isActive
    ? 'border-b-2 border-[#1D9BF0] px-1 py-3 text-sm font-bold text-[#0F1419]'
    : 'border-b-2 border-transparent px-1 py-3 text-sm font-bold text-gray-500 transition hover:text-[#0F1419]'

export function TimelinePage() {
  const { user } = useAuth()
  const authorizedRequest = useAuthorizedRequest()
  const { handleLogout, isLoggingOut } = useLogout()

  const [posts, setPosts] = useState<Post[]>([])
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null)
  const [newPostsCount, setNewPostsCount] = useState(0)
  const [isFetchingNewPosts, setIsFetchingNewPosts] = useState(false)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [timelineMode, setTimelineMode] = useState<TimelineMode>('all')
  const isLoadingMoreRef = useRef(false)

  // 「もっと見る」で末尾に古い投稿を追加しても最大idは変わらないため、常に配列全体から算出する
  const latestKnownId = useMemo(() => posts.reduce((max, post) => Math.max(max, post.id), 0), [posts])

  // タブを切り替えたときも、この効果が再実行されて一覧を取り直す
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      setNewPostsCount(0)
      // API応答を待たずに同期でリセットする。前タブのページ番号が残っていると、
      // 応答が返る前に無限スクロールが発火したとき、そのページ番号で新しいタブの続きを取りにいってしまう
      setPosts([])
      setPage(0)
      setHasNext(false)
      try {
        const response = await fetchTimeline(authorizedRequest, 0, 20, timelineMode)
        // 読み込み中にタブを切り替えた場合、古い結果で上書きしない
        if (cancelled) return
        setPosts(response.posts)
        setPage(response.page)
        setHasNext(response.hasNext)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authorizedRequest, timelineMode])

  useEffect(() => {
    if (isLoading) return undefined
    // 新着API（new-count / new）は全体とフォロー中を区別しないため、
    // フォロー中タブでは「フォローしていない人の投稿」を新着として数えてしまう。
    // 誤った件数を出さないよう、このタブではポーリング自体を止める
    if (timelineMode !== 'all') return undefined

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
  }, [authorizedRequest, latestKnownId, isLoading, timelineMode])

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

  const handleLoadMore = useCallback(async () => {
    // 一覧の読み込み中は、まだ page が確定していないため次ページを取りにいかない
    if (isLoadingMoreRef.current || isLoading || !hasNext) return
    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    setError(null)
    try {
      const response = await fetchTimeline(authorizedRequest, page + 1, 20, timelineMode)
      setPosts((current) => [...current, ...response.posts])
      setPage(response.page)
      setHasNext(response.hasNext)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
    } finally {
      setIsLoadingMore(false)
      isLoadingMoreRef.current = false
    }
  }, [authorizedRequest, page, hasNext, isLoading, timelineMode])

  // 無限スクロール: リスト末尾のセンチネルが画面内に入ったら次ページを自動取得する
  const sentinelRef = useInfiniteScroll(hasNext, handleLoadMore)

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

  const handleToggleLike = async (post: Post) => {
    const updated = post.likedByMe
      ? await unlikePost(authorizedRequest, post.id)
      : await likePost(authorizedRequest, post.id)
    setPosts((current) => current.map((p) => (p.id === post.id ? { ...p, ...updated } : p)))
  }

  return (
    <div className="min-h-screen bg-[#F7F9F9]">
      <AppHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-4">
            <button type="button" onClick={() => setTimelineMode('all')} className={tabClass(timelineMode === 'all')}>
              全体
            </button>
            <button
              type="button"
              onClick={() => setTimelineMode('following')}
              className={tabClass(timelineMode === 'following')}
            >
              フォロー中
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsComposerOpen(true)}
            className="rounded-full bg-[#1D9BF0] px-4 py-1.5 text-sm font-bold text-white transition hover:bg-[#1a8cd8]"
          >
            ＋投稿する
          </button>
        </div>

        {/* フォロー中タブでは新着ポーリングを止めているため、バナーも全体タブ限定にする */}
        {timelineMode === 'all' && newPostsCount > 0 && (
          <NewPostsBanner count={newPostsCount} isLoading={isFetchingNewPosts} onClick={handleShowNewPosts} />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {isLoading ? (
          <p className="text-center text-sm text-gray-500">読み込み中…</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-sm text-gray-500">
            {timelineMode === 'following'
              ? 'フォロー中のユーザーの投稿はまだありません。気になる人をフォローしてみましょう。'
              : 'まだ投稿がありません。最初の投稿をしてみましょう。'}
          </p>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isOwn={post.author.id === user?.id}
              onEdit={setEditingPost}
              onDeleteRequest={setDeletingPostId}
              onToggleLike={handleToggleLike}
            />
          ))
        )}

        {/* 読み込み中は一覧が空でセンチネルが画面内に入りきるため、描画自体を止めて監視対象にしない */}
        {!isLoading && hasNext && (
          <div ref={sentinelRef} className="py-4 text-center text-sm text-gray-500">
            {isLoadingMore ? '読み込み中…' : null}
          </div>
        )}
      </main>

      {isComposerOpen && (
        <PostComposer onSubmit={handleCreatePost} onClose={() => setIsComposerOpen(false)} />
      )}

      {editingPost && (
        <PostEditModal post={editingPost} onCancel={() => setEditingPost(null)} onSave={handleSaveEdit} />
      )}

      {deletingPostId !== null && (
        <DeleteConfirmDialog
          message="この投稿を削除しますか？"
          description="削除した投稿は元に戻せません。"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingPostId(null)}
        />
      )}
    </div>
  )
}
