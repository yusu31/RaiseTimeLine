import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { createComment, deleteComment, fetchComments } from '../api/commentApi'
import { likePost, unlikePost } from '../api/likeApi'
import { fetchPost } from '../api/postApi'
import { CommentForm } from '../components/CommentForm'
import { CommentList } from '../components/CommentList'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { useAuth } from '../hooks/useAuth'
import { useAuthorizedRequest } from '../hooks/useAuthorizedRequest'
import type { Comment } from '../types/comment'
import type { Post } from '../types/post'
import { formatRelativeTime } from '../utils/formatRelativeTime'

export function PostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const postId = Number(id)
  const { user } = useAuth()
  const authorizedRequest = useAuthorizedRequest()

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([fetchPost(authorizedRequest, postId), fetchComments(authorizedRequest, postId)])
      .then(([postResponse, commentsResponse]) => {
        if (cancelled) return
        setPost(postResponse)
        setComments(commentsResponse)
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
  }, [authorizedRequest, postId])

  const handleCreateComment = async (content: string) => {
    const created = await createComment(authorizedRequest, postId, content)
    setComments((current) => [...current, created])
    setPost((current) => (current ? { ...current, commentCount: current.commentCount + 1 } : current))
  }

  const handleConfirmDeleteComment = async () => {
    if (deletingCommentId === null) return
    await deleteComment(authorizedRequest, deletingCommentId)
    setComments((current) => current.filter((comment) => comment.id !== deletingCommentId))
    setPost((current) => (current ? { ...current, commentCount: current.commentCount - 1 } : current))
    setDeletingCommentId(null)
  }

  const handleToggleLike = async () => {
    if (!post) return
    const updated = post.likedByMe
      ? await unlikePost(authorizedRequest, post.id)
      : await likePost(authorizedRequest, post.id)
    setPost((current) => (current ? { ...current, ...updated } : current))
  }

  return (
    <div className="min-h-screen bg-[#F7F9F9]">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur">
        <Link to="/timeline" className="text-sm text-[#1D9BF0] hover:underline">
          ← 戻る
        </Link>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        {error && <p className="text-sm text-red-600">{error}</p>}

        {isLoading ? (
          <p className="text-center text-sm text-gray-500">読み込み中…</p>
        ) : !post ? (
          <p className="text-center text-sm text-gray-500">投稿が見つかりませんでした。</p>
        ) : (
          <>
            <article className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">
                <span className="font-bold text-[#0F1419]">{post.author.displayName}</span>
                {' ・ '}
                {formatRelativeTime(post.createdAt)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-[#0F1419]">{post.content}</p>
              {post.imageUrl && (
                <img src={post.imageUrl} alt="投稿画像" className="mt-3 max-h-96 w-full rounded-lg object-cover" />
              )}
              <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                <span>💬 {post.commentCount}</span>
                <button
                  type="button"
                  onClick={handleToggleLike}
                  className={`flex items-center gap-1 ${post.likedByMe ? 'font-bold text-[#F91880]' : 'text-gray-500 hover:text-[#F91880]'}`}
                >
                  {post.likedByMe ? '❤' : '♡'} {post.likeCount}
                </button>
              </div>
            </article>

            <CommentForm onSubmit={handleCreateComment} />

            <h2 className="text-sm font-bold text-[#0F1419]">コメント（{comments.length}件）</h2>
            <CommentList comments={comments} currentUserId={user?.id} onDeleteRequest={setDeletingCommentId} />
          </>
        )}
      </main>

      {deletingCommentId !== null && (
        <DeleteConfirmDialog
          message="このコメントを削除しますか？削除したコメントは元に戻せません。"
          onConfirm={handleConfirmDeleteComment}
          onCancel={() => setDeletingCommentId(null)}
        />
      )}
    </div>
  )
}
