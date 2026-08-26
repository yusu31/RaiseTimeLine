import { useState } from 'react'
import { ApiError } from '../api/client'
import { CloseIcon } from './icons'
import { ModalOverlay } from './ModalOverlay'

type DeleteConfirmDialogProps = {
  /** 主文。何を削除しようとしているかを問う一文 */
  message: string
  /** 補足。取り消せないことなどの注意書き */
  description?: string
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export function DeleteConfirmDialog({ message, description, onConfirm, onCancel }: DeleteConfirmDialogProps) {
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
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="font-bold text-[#0F1419]">確認</h2>
        <button
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
          title="閉じる"
          aria-label="閉じる"
          className="-mr-1 -mt-1 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-[#0F1419] disabled:opacity-50"
        >
          <CloseIcon />
        </button>
      </div>

      <p className="text-sm text-[#0F1419]">{message}</p>
      {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
          className="rounded-full border border-[#1D9BF0] px-4 py-2 text-sm font-bold text-[#1D9BF0] transition hover:bg-blue-50 disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isDeleting}
          className="rounded-full bg-[#F91880] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#d81570] disabled:opacity-50"
        >
          {isDeleting ? '削除中…' : '削除する'}
        </button>
      </div>
    </ModalOverlay>
  )
}
