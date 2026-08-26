type AvatarProps = {
  displayName: string
  size?: 'sm' | 'md'
}

/**
 * 表示名の頭文字を丸の中に表示するアバター。
 * プロフィール画像（F-07）を実装するまでの代替表示として使う。
 */
export function Avatar({ displayName, size = 'md' }: AvatarProps) {
  // 絵文字などの「サロゲートペア」（1文字が内部的に2つに分かれている文字）でも
  // 文字が壊れないよう、Array.from で1文字ずつに分解してから先頭を取り出す
  const initial = Array.from(displayName.trim())[0] ?? '?'
  const sizeClass = size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-base'

  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-500 select-none`}
    >
      {initial}
    </span>
  )
}
