import { useState } from 'react'
import { ApiError } from '../api/client'
import { followUser, unfollowUser } from '../api/followApi'
import { useAuthorizedRequest } from '../hooks/useAuthorizedRequest'
import type { FollowStatus } from '../types/follow'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'

type FollowButtonProps = {
  /** フォロー対象の @ユーザー名 */
  username: string
  /** 確認ダイアログに出す表示名 */
  displayName: string
  followedByMe: boolean
  /** フォロー状態が変わったときに最新の状態を親へ伝える */
  onChanged: (status: FollowStatus) => void
  onError: (message: string) => void
  size?: 'sm' | 'md'
}

const SIZE_CLASSES = {
  sm: 'px-3 py-1 text-xs',
  md: 'px-4 py-1.5 text-sm',
} as const

/**
 * フォロー／フォロー解除のトグルボタン。
 * 解除は取り消しにあたる操作なので、誤タップを防ぐため確認ダイアログを挟む。
 */
export function FollowButton({
  username,
  displayName,
  followedByMe,
  onChanged,
  onError,
  size = 'md',
}: FollowButtonProps) {
  const authorizedRequest = useAuthorizedRequest()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isConfirmingUnfollow, setIsConfirmingUnfollow] = useState(false)

  const handleFollow = async () => {
    setIsSubmitting(true)
    try {
      onChanged(await followUser(authorizedRequest, username))
    } catch (err) {
      onError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 失敗時はダイアログ側でエラーを表示させるため、ここでは握りつぶさず再スローする
  const handleUnfollow = async () => {
    onChanged(await unfollowUser(authorizedRequest, username))
    setIsConfirmingUnfollow(false)
  }

  const sizeClass = SIZE_CLASSES[size]

  return (
    <>
      {followedByMe ? (
        <button
          type="button"
          onClick={() => setIsConfirmingUnfollow(true)}
          disabled={isSubmitting}
          className={`${sizeClass} rounded-full border border-gray-300 font-bold text-[#0F1419] transition hover:border-[#F91880] hover:bg-red-50 hover:text-[#F91880] disabled:opacity-50`}
        >
          フォロー中
        </button>
      ) : (
        <button
          type="button"
          onClick={handleFollow}
          disabled={isSubmitting}
          className={`${sizeClass} rounded-full bg-[#0F1419] font-bold text-white transition hover:bg-[#272c30] disabled:opacity-50`}
        >
          {isSubmitting ? 'フォロー中…' : 'フォローする'}
        </button>
      )}

      {isConfirmingUnfollow && (
        <DeleteConfirmDialog
          message={`@${username} さんのフォローを解除しますか？`}
          description={`${displayName} さんの投稿は「フォロー中」タブに表示されなくなります。`}
          confirmLabel="フォロー解除"
          confirmingLabel="解除中…"
          onConfirm={handleUnfollow}
          onCancel={() => setIsConfirmingUnfollow(false)}
        />
      )}
    </>
  )
}
