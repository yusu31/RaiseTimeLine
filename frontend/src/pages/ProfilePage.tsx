import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { deletePost, updatePost } from '../api/postApi'
import { likePost, unlikePost } from '../api/likeApi'
import { fetchProfile, fetchUserPosts } from '../api/userApi'
import { AppHeader } from '../components/AppHeader'
import { Avatar } from '../components/Avatar'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { PostCard } from '../components/PostCard'
import { PostEditModal } from '../components/PostEditModal'
import { useAuth } from '../hooks/useAuth'
import { useAuthorizedRequest } from '../hooks/useAuthorizedRequest'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import { useLogout } from '../hooks/useLogout'
import type { Post } from '../types/post'
import type { UserProfile } from '../types/user'

export function ProfilePage() {
  const { username = '' } = useParams()
  const { user } = useAuth()
  const authorizedRequest = useAuthorizedRequest()
  const { handleLogout, isLoggingOut } = useLogout()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null)

  const isOwnProfile = user?.username === username

  useEffect(() => {
    let ignore = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [profileResponse, postsResponse] = await Promise.all([
          fetchProfile(authorizedRequest, username),
          fetchUserPosts(authorizedRequest, username),
        ])
        // 読み込み中に別のユーザーへ遷移した場合、古い結果で上書きしない
        if (ignore) return
        setProfile(profileResponse)
        setPosts(postsResponse.posts)
        setPage(postsResponse.page)
        setHasNext(postsResponse.hasNext)
      } catch (err) {
        if (ignore) return
        setProfile(null)
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
  }, [authorizedRequest, username])

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasNext) return
    setIsLoadingMore(true)
    try {
      const response = await fetchUserPosts(authorizedRequest, username, page + 1)
      setPosts((current) => [...current, ...response.posts])
      setPage(response.page)
      setHasNext(response.hasNext)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
    } finally {
      setIsLoadingMore(false)
    }
  }, [authorizedRequest, username, page, hasNext, isLoadingMore])

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

  return (
    <div className="min-h-screen bg-[#F7F9F9]">
      <AppHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      <main className="mx-auto max-w-2xl px-4 py-6">
        {isLoading && <p className="text-gray-500">読み込み中…</p>}

        {!isLoading && error && !profile && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500">{error}</p>
            <Link to="/timeline" className="mt-4 inline-block text-sm font-bold text-[#1D9BF0] hover:underline">
              タイムラインに戻る
            </Link>
          </div>
        )}

        {profile && (
          <>
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <Avatar displayName={profile.displayName} iconImageUrl={profile.iconImageUrl} size="lg" />
                {isOwnProfile && (
                  <Link
                    to="/profile/edit"
                    className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-bold text-[#0F1419] transition hover:bg-gray-100"
                  >
                    プロフィール編集
                  </Link>
                )}
              </div>

              <h1 className="mt-4 text-xl font-bold text-[#0F1419]">{profile.displayName}</h1>
              <p className="text-gray-500">@{profile.username}</p>
              {profile.bio && <p className="mt-3 whitespace-pre-wrap text-[#0F1419]">{profile.bio}</p>}
            </section>

            <h2 className="mt-6 mb-3 font-bold text-[#0F1419]">このユーザーの投稿</h2>

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            {posts.length === 0 ? (
              <p className="rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm">まだ投稿がありません</p>
            ) : (
              <div className="space-y-3">
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
          </>
        )}
      </main>

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
