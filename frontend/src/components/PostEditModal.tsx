import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import type { Post } from '../types/post'

const MAX_CONTENT_LENGTH = 280

type PostEditModalProps = {
  post: Post
  onCancel: () => void
  onSave: (content: string) => Promise<void>
}

export function PostEditModal({ post, onCancel, onSave }: PostEditModalProps) {
  const [content, setContent] = useState(post.content)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remaining = MAX_CONTENT_LENGTH - content.length
  const isInvalid = content.trim().length === 0 || remaining < 0

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isInvalid) {
      return
    }

    setError(null)
    setIsSubmitting(true)
    try {
      await onSave(content)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-bold text-[#0F1419]">投稿を編集</h2>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={4}
            className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-[#0F1419] outline-none focus:border-[#1D9BF0] focus:ring-1 focus:ring-[#1D9BF0]"
          />
          <p className={`text-right text-xs ${remaining < 0 ? 'text-red-600' : 'text-gray-500'}`}>{remaining}</p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-[#0F1419] hover:bg-gray-100 disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isInvalid || isSubmitting}
              className="rounded-full bg-[#1D9BF0] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1a8cd8] disabled:opacity-50"
            >
              {isSubmitting ? '保存中…' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
