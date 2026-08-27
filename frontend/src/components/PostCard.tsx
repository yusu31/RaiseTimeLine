import { Link, useNavigate } from 'react-router'
import type { Post } from '../types/post'
import { Avatar } from './Avatar'
import { CommentIcon, PencilIcon, TrashIcon } from './icons'
import { LikeButton } from './LikeButton'
import { TimeAgo } from './TimeAgo'

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
      <div className="flex items-start justify-between gap-2">
        {/* カード全体が投稿詳細へのリンクになっているため、
            著者部分のクリックは stopPropagation で親への伝播を止める。
            日時はリンクの外に置き、押したときは（親の onClick で）投稿詳細へ進むようにする */}
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to={`/users/${post.author.username}`}
            onClick={(event) => event.stopPropagation()}
            className="shrink-0 rounded-full transition hover:opacity-80"
          >
            <Avatar displayName={post.author.displayName} iconImageUrl={post.author.iconImageUrl} />
          </Link>
          <p className="min-w-0 truncate">
            <Link
              to={`/users/${post.author.username}`}
              onClick={(event) => event.stopPropagation()}
              className="hover:underline"
            >
              <span className="font-bold text-[#0F1419]">{post.author.displayName}</span>
              <span className="ml-1 text-sm text-gray-500">@{post.author.username}</span>
            </Link>
            <span className="text-sm text-gray-500"> · </span>
            <TimeAgo isoString={post.createdAt} className="text-sm text-gray-500" />
          </p>
        </div>
        {isOwn && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="編集する"
              aria-label="編集する"
              onClick={(event) => {
                event.stopPropagation()
                onEdit(post)
              }}
              className="rounded-full p-2 text-gray-400 transition hover:bg-blue-50 hover:text-[#1D9BF0]"
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              title="削除する"
              aria-label="削除する"
              onClick={(event) => {
                event.stopPropagation()
                onDeleteRequest(post.id)
              }}
              className="rounded-full p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      <p className="mt-3 whitespace-pre-wrap text-[#0F1419]">{post.content}</p>

      {post.imageUrl && (
        <img src={post.imageUrl} alt="投稿画像" className="mt-3 max-h-96 w-full rounded-lg object-cover" />
      )}

      <div className="mt-3 flex items-center gap-6 border-t border-gray-100 pt-3 text-sm text-gray-500">
        <LikeButton likeCount={post.likeCount} likedByMe={post.likedByMe} onToggle={() => onToggleLike(post)} />
        <span className="flex items-center gap-1">
          <CommentIcon />
          {post.commentCount}
        </span>
      </div>
    </article>
  )
}
