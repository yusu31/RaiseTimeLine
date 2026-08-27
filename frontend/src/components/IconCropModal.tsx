import { useCallback, useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
// このCSSがないと切り出し領域のレイアウト（絶対配置）が効かず、画像が表示されず操作もできない
import 'react-easy-crop/react-easy-crop.css'
import { cropImageToFile } from '../utils/cropImage'
import { ModalOverlay } from './ModalOverlay'

type IconCropModalProps = {
  /** ユーザーが選んだ元画像 */
  file: File
  onCancel: () => void
  /** 切り出した画像を親へ渡す */
  onCropped: (file: File) => void
}

const MIN_ZOOM = 1
const MAX_ZOOM = 3

/**
 * アイコン画像のトリミングモーダル。
 * ドラッグで位置を、スライダー（またはホイール・ピンチ）で拡大率を調整する。
 * 切り抜き枠を円形にしているのは、実際のアイコン表示が丸いため。
 * 四角い枠で調整させると「思っていたより端が切れる」ことになる。
 */
export function IconCropModal({ file, onCancel, onCropped }: IconCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // URL.createObjectURL + revokeObjectURL は使わない。
  // StrictMode（開発モード）は effect をわざと2回実行するため、
  // 「useMemo で作ったURLを effect の後始末で解放する」書き方だと
  // 再マウント時に解放済みのURLを掴んだままになり、画像が表示されなくなる。
  // data URL なら解放処理そのものが不要なので、この不整合が起きない
  useEffect(() => {
    const reader = new FileReader()
    reader.addEventListener('load', () => setImageUrl(reader.result as string))
    reader.readAsDataURL(file)
    return () => reader.abort()
  }, [file])

  // 第2引数が「元画像上のピクセル座標」。第1引数は割合なのでここでは使わない
  const handleCropComplete = useCallback((_: Area, areaInPixels: Area) => {
    setCroppedArea(areaInPixels)
  }, [])

  const handleApply = async () => {
    if (!imageUrl || !croppedArea || isProcessing) return
    setIsProcessing(true)
    setError(null)
    try {
      onCropped(await cropImageToFile(imageUrl, croppedArea))
    } catch {
      setError('画像の切り出しに失敗しました。別の画像でお試しください。')
      setIsProcessing(false)
    }
  }

  return (
    <ModalOverlay maxWidthClassName="max-w-md">
      <h2 className="mb-1 font-bold text-[#0F1419]">アイコンを調整</h2>
      <p className="mb-3 text-xs text-gray-500">ドラッグで位置を、スライダーで大きさを調整できます。</p>

      <div className="relative h-72 w-full overflow-hidden rounded-lg bg-gray-900">
        {imageUrl ? (
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-gray-300">読み込み中…</p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label htmlFor="icon-zoom" className="text-sm text-gray-500">
          大きさ
        </label>
        <input
          id="icon-zoom"
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.05}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="flex-1 accent-[#1D9BF0]"
        />
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="rounded-full border border-gray-300 px-4 py-2 text-sm font-bold text-[#0F1419] transition hover:bg-gray-100 disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={isProcessing || !croppedArea}
          className="rounded-full bg-[#1D9BF0] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#1a8cd8] disabled:opacity-50"
        >
          {isProcessing ? '処理中…' : '適用する'}
        </button>
      </div>
    </ModalOverlay>
  )
}
