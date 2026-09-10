import { useState } from 'react'

const HEART_PATH =
  'M12 21s-6.72-4.35-9.3-8.28C1.02 10.1 1.6 6.6 4.6 5.1c2.3-1.15 4.9-.3 6.4 1.6l1 1.25 1-1.25c1.5-1.9 4.1-2.75 6.4-1.6 3 1.5 3.58 5 1.9 7.62C18.72 16.65 12 21 12 21z'

type LikeButtonProps = {
  likeCount: number
  likedByMe: boolean
  /**
   * いいねの付け外しを親へ伝える。通信するのは親（各ページ）なので、
   * この部品が「通信が終わったこと」を知る手段は親が返す Promise しかない。
   * 二重送信を防ぐために Promise を受け取れる型にしている
   */
  onToggle: () => void | Promise<void>
}

export function LikeButton({ likeCount, likedByMe, onToggle }: LikeButtonProps) {
  // いいねした瞬間だけkeyを更新してエフェクト用のspanを再マウントし、CSSアニメーションを毎回リプレイさせる
  const [burstId, setBurstId] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClick = async (event: React.MouseEvent) => {
    event.stopPropagation()
    if (!likedByMe) {
      setBurstId((id) => id + 1)
    }
    setIsSubmitting(true)
    try {
      await onToggle()
    } catch {
      // 失敗をどう見せるかは、通信している親（各ページ）の責任なのでここでは表示しない。
      // 呼び出し元の4画面はいずれも自分で受け取ってエラーを表示する（Issue #77 で揃えた）。
      // ここは、将来 catch を書き忘れた呼び出し元が現れたときに
      // Unhandled Rejection（誰も受け取らないエラー）になるのを防ぐ受け皿として残している
    } finally {
      // 成功・失敗のどちらでも必ず通る。ここを try の外に書くと、
      // 失敗したときに押せないまま固まってしまう
      setIsSubmitting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSubmitting}
      // 他の部品と違い disabled:opacity-50 は付けない。いいねは連打される軽い操作で
      // 通信が数十msで終わるため、その間だけ半透明にすると点滅して見えるだけになる
      className={`like-button flex items-center gap-1 ${likedByMe ? 'is-liked text-[#F91880]' : 'text-gray-500 hover:text-[#F91880]'}`}
    >
      <span key={burstId} className="like-heart-wrap">
        <svg
          className={`like-heart ${burstId > 0 ? 'like-heart--burst' : ''}`}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill={likedByMe ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={HEART_PATH} />
        </svg>
        {burstId > 0 && (
          <span className="like-particles" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <svg key={n} className={`like-particle like-particle--${n}`} viewBox="0 0 24 24" fill="#F91880">
                <path d={HEART_PATH} />
              </svg>
            ))}
          </span>
        )}
      </span>
      {likeCount}
    </button>
  )
}
