import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ApiError } from '../api/client'

const MAX_CONTENT_LENGTH = 280
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']

type PostComposerProps = {
  onSubmit: (content: string, image: File | null) => Promise<void>
}

export function PostComposer({ onSubmit }: PostComposerProps) {
  const [content, setContent] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const remaining = MAX_CONTENT_LENGTH - content.length
  const isInvalid = content.trim().length === 0 || remaining < 0

  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setImageError(null)

    if (!file) {
      setImage(null)
      return
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError('画像はJPEGまたはPNG形式のみアップロードできます')
      event.target.value = ''
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError('画像は5MB以内のファイルをアップロードしてください')
      event.target.value = ''
      return
    }

    setImage(file)
  }

  const handleRemoveImage = () => {
    setImage(null)
    setImageError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isInvalid) {
      return
    }

    setApiError(null)
    setIsSubmitting(true)
    try {
      await onSubmit(content, image)
      setContent('')
      handleRemoveImage()
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="いまどうしてる？"
        rows={3}
        className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-[#0F1419] outline-none focus:border-[#1D9BF0] focus:ring-1 focus:ring-[#1D9BF0]"
      />

      {previewUrl && (
        <div className="relative w-fit">
          <img src={previewUrl} alt="選択した画像のプレビュー" className="max-h-48 rounded-lg object-cover" />
          <button
            type="button"
            onClick={handleRemoveImage}
            className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
          >
            画像を削除
          </button>
        </div>
      )}

      {imageError && <p className="text-xs text-red-600">{imageError}</p>}
      {apiError && <p className="text-sm text-red-600">{apiError}</p>}

      <div className="flex items-center justify-between">
        <label className="cursor-pointer rounded-full border border-gray-300 px-3 py-1.5 text-sm text-[#0F1419] hover:bg-gray-100">
          📷 画像を選択
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleImageSelect}
            className="hidden"
          />
        </label>

        <div className="flex items-center gap-3">
          <span className={`text-sm ${remaining < 0 ? 'text-red-600' : 'text-gray-500'}`}>{remaining}</span>
          <button
            type="submit"
            disabled={isInvalid || isSubmitting}
            className="rounded-full bg-[#1D9BF0] px-5 py-1.5 text-sm font-bold text-white transition hover:bg-[#1a8cd8] disabled:opacity-50"
          >
            {isSubmitting ? '投稿中…' : '投稿する'}
          </button>
        </div>
      </div>
    </form>
  )
}
