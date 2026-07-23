import { useState } from 'react'
import { ApiError } from '../api/client'
import { ModalOverlay } from './ModalOverlay'

type DeleteConfirmDialogProps = {
  message: string
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export function DeleteConfirmDialog({ message, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setError(null)
    setIsDeleting(true)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
      setIsDeleting(false)
    }
  }

  return (
    <ModalOverlay maxWidthClassName="max-w-sm">
      <p className="mb-4 text-sm text-[#0F1419]">{message}</p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
          className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-[#0F1419] hover:bg-gray-100 disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isDeleting}
          className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {isDeleting ? '削除中…' : '削除する'}
        </button>
      </div>
    </ModalOverlay>
  )
}
