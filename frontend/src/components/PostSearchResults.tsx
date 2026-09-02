import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { likePost, unlikePost } from '../api/likeApi'
import { deletePost, searchPosts, updatePost } from '../api/postApi'
import { useAuth } from '../hooks/useAuth'
import { useAuthorizedRequest } from '../hooks/useAuthorizedRequest'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import type { Post } from '../types/post'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { PostCard } from './PostCard'
import { PostEditModal } from './PostEditModal'

type PostSearchResultsProps = {
  /** デバウンス済みの検索キーワード。空文字のときは検索しない */
  keyword: string
}

/**
 * 検索画面の「投稿」タブの中身（F-09）。
 *
 * タブを切り替えると SearchPage 側でこのコンポーネント自体が取り外されるため、
 * 読み込み済みのページ位置や結果はそのとき破棄される。
 * （1つのコンポーネントで両タブを扱うと、前のタブの状態が残って結果が混ざる）
 */
export function PostSearchResults({ keyword }: PostSearchResultsProps) {
  const { user } = useAuth()
  const authorizedRequest = useAuthorizedRequest()

  const [posts, setPosts] = useState<Post[]>([])
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null)

  useEffect(() => {
    // 空欄のときは検索しない。前の結果を消すための setState はここでは呼ばず、
    // 「空欄なら結果を描画しない」という下の分岐だけで吸収する（無駄な再描画を増やさないため）
    if (keyword === '') return undefined

    let ignore = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await searchPosts(authorizedRequest, keyword)
        // 通信中に次のキーワードへ進んだ場合、古い結果で上書きしない
        if (ignore) return
        setPosts(response.posts)
        setPage(response.page)
        setHasNext(response.hasNext)
      } catch (err) {
        if (ignore) return
        setPosts([])
        setHasNext(false)
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

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || isLoading || !hasNext) return
    setIsLoadingMore(true)
    try {
      const response = await searchPosts(authorizedRequest, keyword, page + 1)
      setPosts((current) => [...current, ...response.posts])
      setPage(response.page)
      setHasNext(response.hasNext)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
    } finally {
      setIsLoadingMore(false)
    }
  }, [authorizedRequest, keyword, page, hasNext, isLoading, isLoadingMore])

  const sentinelRef = useInfiniteScroll(hasNext, handleLoadMore)

  const handleToggleLike = async (post: Post) => {
    try {
      const status = post.likedByMe
        ? await unlikePost(authorizedRequest, post.id)
        : await likePost(authorizedRequest, post.id)
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id ? { ...item, likeCount: status.likeCount, likedByMe: status.likedByMe } : item,
        ),
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
    }
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

  if (keyword === '') {
    return <p className="mt-6 text-center text-sm text-gray-500">キーワードを入力すると投稿を検索できます</p>
  }

  return (
    <>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="mt-6 text-center text-sm text-gray-500">読み込み中…</p>
      ) : posts.length === 0 && !error ? (
        <p className="mt-4 rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm">
          「{keyword}」を含む投稿は見つかりませんでした
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isOwn={post.author.id === user?.id}
              onEdit={setEditingPost}
              onDeleteRequest={setDeletingPostId}
              onToggleLike={handleToggleLike}
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} />
      {isLoadingMore && <p className="mt-3 text-center text-sm text-gray-500">読み込み中…</p>}

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
    </>
  )
}
