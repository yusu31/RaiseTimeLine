type NewPostsBannerProps = {
  count: number
  isLoading: boolean
  onClick: () => void
}

export function NewPostsBanner({ count, isLoading, onClick }: NewPostsBannerProps) {
  const label = count > 99 ? '99+' : count

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="mx-auto flex items-center gap-1 rounded-full bg-[#1D9BF0] px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-[#1a8cd8] disabled:opacity-50"
    >
      {isLoading ? '読み込み中…' : `↑ ${label}件の新着を表示`}
    </button>
  )
}
