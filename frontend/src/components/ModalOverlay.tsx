import type { ReactNode } from 'react'

type ModalOverlayProps = {
  children: ReactNode
  maxWidthClassName?: string
}

export function ModalOverlay({ children, maxWidthClassName = 'max-w-md' }: ModalOverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div className={`w-full ${maxWidthClassName} rounded-2xl bg-white p-6 shadow-lg`}>{children}</div>
    </div>
  )
}
