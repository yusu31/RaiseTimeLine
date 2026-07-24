import type { Comment } from '../types/comment'
import { formatRelativeTime } from '../utils/formatRelativeTime'

type CommentListProps = {
  comments: Comment[]
  currentUserId: number | undefined
  onDeleteRequest: (commentId: number) => void
}

export function CommentList({ comments, currentUserId, onDeleteRequest }: CommentListProps) {
  if (comments.length === 0) {
    return <p className="text-center text-sm text-gray-500">まだコメントがありません。</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {comments.map((comment) => (
        <li key={comment.id} className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-sm text-gray-500">
              <span className="font-bold text-[#0F1419]">{comment.author.displayName}</span>
              {' ・ '}
              {formatRelativeTime(comment.createdAt)}
            </p>
            {comment.author.id === currentUserId && (
              <button
                type="button"
                onClick={() => onDeleteRequest(comment.id)}
                className="text-xs text-red-600 hover:underline"
              >
                削除
              </button>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[#0F1419]">{comment.content}</p>
        </li>
      ))}
    </ul>
  )
}
