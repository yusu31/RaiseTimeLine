import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { createComment, deleteComment, fetchComments } from '../api/commentApi'
import { likePost, unlikePost } from '../api/likeApi'
import { fetchPost } from '../api/postApi'
import { AppHeader } from '../components/AppHeader'
import { Avatar } from '../components/Avatar'
import { CommentForm } from '../components/CommentForm'
import { CommentList } from '../components/CommentList'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { CommentIcon } from '../components/icons'
import { LikeButton } from '../components/LikeButton'
import { useAuth } from '../hooks/useAuth'
import { useAuthorizedRequest } from '../hooks/useAuthorizedRequest'
import { useLogout } from '../hooks/useLogout'
import type { Comment } from '../types/comment'
import type { Post } from '../types/post'
import { formatDateTime } from '../utils/formatDateTime'

export function PostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const postId = Number(id)
  const { user } = useAuth()
  const authorizedRequest = useAuthorizedRequest()
  const { handleLogout, isLoggingOut } = useLogout()

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null)
  // コメント送信後に最下部までスクロールするための目印と、その実行フラグ。
  // フラグを useState ではなく useRef にしているのは、この値が変わっても画面を描き直す必要がないため。
  const commentsEndRef = useRef<HTMLDivElement>(null)
  const shouldScrollToNewCommentRef = useRef(false)

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
    // 画面にコメントが追加された「後」にスクロールしたいので、ここでは予約だけしておく
    shouldScrollToNewCommentRef.current = true
  }

  // 送信したコメントが画面外に追加されたままにならないよう、最下部までスクロールする。
  // comments が更新されて画面が描き直された「後」に実行されるため、追加したコメントは既に表示されている。
  // 初回表示や他の理由での更新では予約フラグが false のままなので、勝手にスクロールすることはない。
  useEffect(() => {
    if (!shouldScrollToNewCommentRef.current) return
    shouldScrollToNewCommentRef.current = false

    // OS側で「視差効果を減らす」設定をしている場合、滑らかな動きは不快になりうるため瞬時に移動する
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    commentsEndRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'end',
    })
  }, [comments])

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
    // 下部に固定するコメント入力欄と重ならないよう、本文の下に余白（pb-28）を確保する
    <div className="min-h-screen bg-[#F7F9F9] pb-28">
      <AppHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        <Link
          to="/timeline"
          className="flex items-center gap-3 text-lg font-bold text-[#0F1419] transition hover:text-[#1D9BF0]"
        >
          <span aria-hidden="true">←</span>
          投稿
        </Link>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {isLoading ? (
          <p className="text-center text-sm text-gray-500">読み込み中…</p>
        ) : !post ? (
          <p className="text-center text-sm text-gray-500">投稿が見つかりませんでした。</p>
        ) : (
          <>
            <article className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Avatar displayName={post.author.displayName} iconImageUrl={post.author.iconImageUrl} />
                <div className="leading-tight">
                  <p className="font-bold text-[#0F1419]">{post.author.displayName}</p>
                  <p className="text-sm text-gray-500">@{post.author.username}</p>
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-[#0F1419]">{post.content}</p>

              {post.imageUrl && (
                <img src={post.imageUrl} alt="投稿画像" className="mt-3 max-h-96 w-full rounded-lg object-cover" />
              )}

              <p className="mt-2 text-sm text-gray-500">{formatDateTime(post.createdAt)}</p>

              <div className="mt-3 flex items-center gap-6 border-t border-gray-100 pt-3 text-sm text-gray-500">
                <LikeButton likeCount={post.likeCount} likedByMe={post.likedByMe} onToggle={handleToggleLike} />
                <span className="flex items-center gap-1">
                  <CommentIcon />
                  {post.commentCount}
                </span>
              </div>
            </article>

            <h2 className="text-sm font-bold text-[#0F1419]">コメント ({comments.length}件)</h2>
            <CommentList comments={comments} currentUserId={user?.id} onDeleteRequest={setDeletingCommentId} />

            {/*
              スクロール先の目印。scroll-mb-24 は「ここへスクロールするとき下に6rem分の余白を取る」指定で、
              下部に固定したコメント入力欄に最後のコメントが隠れるのを防ぐ。
            */}
            <div ref={commentsEndRef} className="scroll-mb-24" />
          </>
        )}
      </main>

      {/* コメント入力欄は画面下部に固定し、どこまでスクロールしても入力できるようにする */}
      {post && (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/90 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-xl">
            <CommentForm onSubmit={handleCreateComment} />
          </div>
        </div>
      )}

      {deletingCommentId !== null && (
        <DeleteConfirmDialog
          message="このコメントを削除しますか？"
          description="削除したコメントは元に戻せません。"
          onConfirm={handleConfirmDeleteComment}
          onCancel={() => setDeletingCommentId(null)}
        />
      )}
    </div>
  )
}
