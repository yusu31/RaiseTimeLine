import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'

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
      <div className="flex gap-2">
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
          className="rounded-full bg-[#1D9BF0] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1a8cd8] disabled:opacity-50"
        >
          {isSubmitting ? '送信中…' : 'コメント'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}
