import type { Area } from 'react-easy-crop'

/**
 * アイコンとして保存する画像の一辺の長さ（ピクセル）。
 * 画面上の最大表示は 80px（Avatar の lg）なので、高解像度ディスプレイを考慮しても 400px あれば足りる。
 * スマホで撮った数MBの写真をそのまま送らずに済み、転送量と保存容量を大きく減らせる。
 */
const OUTPUT_SIZE = 400

/** JPEGの品質。1.0に近いほど高画質・大サイズ。0.92は見た目の劣化がほぼ分からない実用的な値 */
const JPEG_QUALITY = 0.92

/**
 * 出力するファイル名。
 * バックエンドの LocalStorageService は MIMEタイプと拡張子の両方を検証するため、
 * 拡張子(.jpg)とMIME(image/jpeg)を必ず揃える。
 */
const OUTPUT_FILE_NAME = 'icon.jpg'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('画像を読み込めませんでした')))
    image.src = src
  })
}

/**
 * 選択範囲を切り出し、正方形にリサイズした JPEG ファイルを作る。
 *
 * @param imageSrc 元画像のURL（URL.createObjectURL で作ったもの）
 * @param area 切り出す範囲。react-easy-crop が返す「元画像上のピクセル座標」
 */
export async function cropImageToFile(imageSrc: string, area: Area): Promise<File> {
  const image = await loadImage(imageSrc)

  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('画像の切り出しに失敗しました')
  }

  // JPEGは透過を扱えず、透過部分は既定で黒くなる。
  // 透過PNGを選んだときに黒く潰れないよう、先に白で塗りつぶしておく
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

  // 元画像の指定範囲を、出力サイズに合わせて拡大縮小しながら描画する
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  )

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  })
  if (!blob) {
    throw new Error('画像の切り出しに失敗しました')
  }

  return new File([blob], OUTPUT_FILE_NAME, { type: 'image/jpeg' })
}
