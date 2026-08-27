import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { fetchProfile, updateIcon, updateProfile } from '../api/userApi'
import { AppHeader } from '../components/AppHeader'
import { Avatar } from '../components/Avatar'
import { FormField } from '../components/FormField'
import { IconCropModal } from '../components/IconCropModal'
import { useAuth } from '../hooks/useAuth'
import { useAuthorizedRequest } from '../hooks/useAuthorizedRequest'
import { useLogout } from '../hooks/useLogout'

const MAX_BIO_LENGTH = 160
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']

export function ProfileEditPage() {
  const { user, updateUser } = useAuth()
  const authorizedRequest = useAuthorizedRequest()
  const { handleLogout, isLoggingOut } = useLogout()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [currentIconUrl, setCurrentIconUrl] = useState<string | null>(null)
  // image は「トリミング済みで、保存時に送る画像」。
  // croppingFile は「選んだ直後で、まだ切り抜いていない画像」
  const [image, setImage] = useState<File | null>(null)
  const [croppingFile, setCroppingFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 選択した画像のプレビュー用URL。作りっぱなしだとメモリを保持し続けるため、
  // 差し替え時・画面を離れる時に revokeObjectURL で解放する
  const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (!user) return
    let ignore = false

    const load = async () => {
      try {
        const profile = await fetchProfile(authorizedRequest, user.username)
        if (ignore) return
        setDisplayName(profile.displayName)
        setUsername(profile.username)
        setBio(profile.bio ?? '')
        setCurrentIconUrl(profile.iconImageUrl)
      } catch (err) {
        if (!ignore) setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [authorizedRequest, user])

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('画像はJPEGまたはPNG形式のみアップロードできます')
      event.target.value = ''
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('画像は5MB以内のファイルをアップロードしてください')
      event.target.value = ''
      return
    }

    setError(null)
    setCroppingFile(file)
    // 同じファイルをもう一度選び直せるようにする。
    // input の値が残っていると同じファイルでは change イベントが発火しない
    event.target.value = ''
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSaving) return

    setIsSaving(true)
    setError(null)
    try {
      // アイコンは multipart、テキストは JSON と形式が異なるためAPIを分けている。
      // APIが2本ある以上「アイコンだけ保存に成功した」状態は必ず起こりうるため、
      // 成功した時点で即座に画面へ反映する。ここで反映しないと、この後の updateProfile が
      // 失敗したときに「DBには新しい画像があるのにヘッダーは古い画像のまま」というズレが残る
      if (image) {
        updateUser(await updateIcon(authorizedRequest, image))
      }
      const updated = await updateProfile(authorizedRequest, { displayName, username, bio })
      // ヘッダーなどに出しているログインユーザー情報を最新化する。
      // これをしないと保存しても表示名・アイコンが古いまま残る
      updateUser(updated)
      navigate(`/users/${updated.username}`, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
    } finally {
      setIsSaving(false)
    }
  }

  const bioLength = Array.from(bio).length

  return (
    <div className="min-h-screen bg-[#F7F9F9]">
      <AppHeader onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 text-xl font-bold text-[#0F1419]">プロフィール編集</h1>

        {isLoading ? (
          <p className="text-gray-500">読み込み中…</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <Avatar
                displayName={displayName}
                iconImageUrl={previewUrl ?? currentIconUrl}
                size="lg"
              />
              <label className="cursor-pointer rounded-full border border-gray-300 px-4 py-1.5 text-sm font-bold text-[#0F1419] transition hover:bg-gray-100">
                変更する
                <input type="file" accept="image/jpeg,image/png" onChange={handleImageSelect} className="hidden" />
              </label>
              {image && <p className="text-xs text-gray-500">保存するまで反映されません</p>}
            </div>

            <FormField
              id="displayName"
              label="表示名"
              type="text"
              autoComplete="nickname"
              value={displayName}
              onChange={setDisplayName}
            />

            <FormField
              id="username"
              label="ユーザー名（@のあとの部分）"
              type="text"
              autoComplete="username"
              value={username}
              onChange={setUsername}
            />

            <div className="flex flex-col gap-1">
              <label htmlFor="bio" className="text-sm font-medium text-[#0F1419]">
                自己紹介
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={4}
                className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-[#0F1419] outline-none focus:border-[#1D9BF0] focus:ring-1 focus:ring-[#1D9BF0]"
              />
              <p className={`self-end text-xs ${bioLength > MAX_BIO_LENGTH ? 'text-red-600' : 'text-gray-500'}`}>
                {bioLength} / {MAX_BIO_LENGTH}
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-bold text-[#0F1419] transition hover:bg-gray-100"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSaving || bioLength > MAX_BIO_LENGTH}
                className="rounded-full bg-[#1D9BF0] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#1a8cd8] disabled:opacity-50"
              >
                {isSaving ? '保存中…' : '保存する'}
              </button>
            </div>
          </form>
        )}
      </main>

      {croppingFile && (
        <IconCropModal
          file={croppingFile}
          onCancel={() => setCroppingFile(null)}
          onCropped={(cropped) => {
            setImage(cropped)
            setCroppingFile(null)
          }}
        />
      )}
    </div>
  )
}
