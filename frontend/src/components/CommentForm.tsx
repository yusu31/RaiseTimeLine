import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { SendIcon } from './icons'

type CommentFormProps = {
  onSubmit: (content: string) => Promise<void>
}

export function CommentForm({ onSubmit }: CommentFormProps) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (content.trim().length === 0) {
      setError('コメントを入力してください')
      return
    }

    setError(null)
    setIsSubmitting(true)
    try {
      await onSubmit(content)
      setContent('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="コメントを入力…"
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm text-[#0F1419] outline-none focus:border-[#1D9BF0] focus:ring-1 focus:ring-[#1D9BF0]"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          title="コメントを送信"
          aria-label="コメントを送信"
          className="rounded-full p-2 text-[#1D9BF0] transition hover:bg-blue-50 disabled:opacity-50"
        >
          <SendIcon />
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}
