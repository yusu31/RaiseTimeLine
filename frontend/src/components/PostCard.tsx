import type { Post } from '../types/post'

type PostCardProps = {
  post: Post
  isOwn: boolean
  onEdit: (post: Post) => void
  onDeleteRequest: (postId: number) => void
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000)

  if (diffMinutes < 1) return 'たった今'
  if (diffMinutes < 60) return `${diffMinutes}分前`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}時間前`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}日前`

  return date.toLocaleDateString('ja-JP')
}

export function PostCard({ post, isOwn, onEdit, onDeleteRequest }: PostCardProps) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-500">
          <span className="font-bold text-[#0F1419]">{post.author.displayName}</span>
          {' ・ '}
          {formatRelativeTime(post.createdAt)}
        </p>
        {isOwn && (
          <div className="flex gap-2 text-xs">
            <button type="button" onClick={() => onEdit(post)} className="text-[#1D9BF0] hover:underline">
              編集
            </button>
            <button type="button" onClick={() => onDeleteRequest(post.id)} className="text-red-600 hover:underline">
              削除
            </button>
          </div>
        )}
      </div>

      <p className="mt-2 whitespace-pre-wrap text-[#0F1419]">{post.content}</p>

      {post.imageUrl && (
        <img src={post.imageUrl} alt="投稿画像" className="mt-3 max-h-96 w-full rounded-lg object-cover" />
      )}

      <div className="mt-3 flex gap-4 text-sm text-gray-500">
        <span>💬 {post.commentCount}</span>
        <span>♡ {post.likeCount}</span>
      </div>
    </article>
  )
}
