type AvatarProps = {
  displayName: string
  iconImageUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASSES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-base',
  lg: 'h-20 w-20 text-2xl',
} as const

/**
 * ユーザーのアイコン。画像が未設定なら表示名の頭文字を丸の中に表示する。
 */
export function Avatar({ displayName, iconImageUrl, size = 'md' }: AvatarProps) {
  const sizeClass = SIZE_CLASSES[size]

  if (iconImageUrl) {
    return (
      <img
        src={iconImageUrl}
        alt=""
        aria-hidden="true"
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
      />
    )
  }

  // 絵文字などの「サロゲートペア」（1文字が内部的に2つに分かれている文字）でも
  // 文字が壊れないよう、Array.from で1文字ずつに分解してから先頭を取り出す
  const initial = Array.from(displayName.trim())[0] ?? '?'

  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-500 select-none`}
    >
      {initial}
    </span>
  )
}
