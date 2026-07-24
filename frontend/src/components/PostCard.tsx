import { useNavigate } from 'react-router'
import type { Post } from '../types/post'
import { formatRelativeTime } from '../utils/formatRelativeTime'
import { LikeButton } from './LikeButton'

type PostCardProps = {
  post: Post
  isOwn: boolean
  onEdit: (post: Post) => void
  onDeleteRequest: (postId: number) => void
  onToggleLike: (post: Post) => void
}

export function PostCard({ post, isOwn, onEdit, onDeleteRequest, onToggleLike }: PostCardProps) {
  const navigate = useNavigate()

  return (
    <article
      onClick={() => navigate(`/posts/${post.id}`)}
      className="cursor-pointer rounded-2xl bg-white p-4 shadow-sm transition hover:bg-gray-50"
    >
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-500">
          <span className="font-bold text-[#0F1419]">{post.author.displayName}</span>
          {' ・ '}
          {formatRelativeTime(post.createdAt)}
        </p>
        {isOwn && (
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onEdit(post)
              }}
              className="text-[#1D9BF0] hover:underline"
            >
              編集
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDeleteRequest(post.id)
              }}
              className="text-red-600 hover:underline"
            >
              削除
            </button>
          </div>
        )}
      </div>

      <p className="mt-2 whitespace-pre-wrap text-[#0F1419]">{post.content}</p>

      {post.imageUrl && (
        <img src={post.imageUrl} alt="投稿画像" className="mt-3 max-h-96 w-full rounded-lg object-cover" />
      )}

      <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
        <span>💬 {post.commentCount}</span>
        <LikeButton likeCount={post.likeCount} likedByMe={post.likedByMe} onToggle={() => onToggleLike(post)} />
      </div>
    </article>
  )
}
