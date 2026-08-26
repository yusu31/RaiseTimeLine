import type { Comment } from '../types/comment'
import { formatDateTime } from '../utils/formatDateTime'
import { Avatar } from './Avatar'
import { TrashIcon } from './icons'

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
          <div className="flex items-start gap-3">
            <Avatar displayName={comment.author.displayName} size="sm" />

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm">
                  <span className="font-bold text-[#0F1419]">{comment.author.displayName}</span>{' '}
                  <span className="text-gray-500">@{comment.author.username}</span>
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-xs text-gray-500">{formatDateTime(comment.createdAt)}</span>
                  {comment.author.id === currentUserId && (
                    <button
                      type="button"
                      title="削除する"
                      aria-label="コメントを削除する"
                      onClick={() => onDeleteRequest(comment.id)}
                      className="rounded-full p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[#0F1419]">{comment.content}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
