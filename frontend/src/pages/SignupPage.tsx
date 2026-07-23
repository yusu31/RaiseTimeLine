import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { signup } from '../api/authApi'
import { ApiError } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { FormField } from '../components/FormField'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ValidationErrors = {
  email?: string
  displayName?: string
  password?: string
  confirmPassword?: string
}

function validate(email: string, displayName: string, password: string, confirmPassword: string): ValidationErrors {
  const errors: ValidationErrors = {}

  if (!email) {
    errors.email = 'メールアドレスを入力してください'
  } else if (email.length > 255 || !EMAIL_PATTERN.test(email)) {
    errors.email = 'メールアドレスの形式が正しくありません'
  }

  if (!displayName) {
    errors.displayName = '表示名を入力してください'
  } else if (displayName.length > 50) {
    errors.displayName = '表示名は50文字以内で入力してください'
  }

  if (!password) {
    errors.password = 'パスワードを入力してください'
  } else if (password.length < 8 || password.length > 72) {
    errors.password = 'パスワードは8文字以上72文字以内で入力してください'
  }

  if (!confirmPassword) {
    errors.confirmPassword = '確認用のパスワードを入力してください'
  } else if (confirmPassword !== password) {
    errors.confirmPassword = 'パスワードが一致しません'
  }

  return errors
}

export function SignupPage() {
  const { login: setAuth } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const errors = validate(email, displayName, password, confirmPassword)
  const hasErrors = Object.keys(errors).length > 0

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    setApiError(null)

    if (hasErrors) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await signup({ email, displayName, password })
      setAuth(response)
      navigate('/welcome', { replace: true })
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F9F9] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-8 text-center text-2xl font-bold text-[#0F1419]">新規登録</h1>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <FormField
            id="signup-email"
            label="メールアドレス"
            type="email"
            autoComplete="username"
            value={email}
            onChange={setEmail}
            error={submitted ? errors.email : undefined}
          />
          <FormField
            id="signup-display-name"
            label="表示名"
            type="text"
            autoComplete="nickname"
            value={displayName}
            onChange={setDisplayName}
            error={submitted ? errors.displayName : undefined}
          />
          <FormField
            id="signup-password"
            label="パスワード（8文字以上）"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            error={submitted ? errors.password : undefined}
          />
          <FormField
            id="signup-password-confirm"
            label="パスワード確認"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={submitted ? errors.confirmPassword : undefined}
          />

          {apiError && <p className="text-sm text-red-600">{apiError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 rounded-full bg-[#1D9BF0] py-2 font-bold text-white transition hover:bg-[#1a8cd8] disabled:opacity-50"
          >
            {isSubmitting ? '登録中…' : '登録する'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          アカウントをお持ちの方は{' '}
          <Link to="/login" className="font-medium text-[#1D9BF0] hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  )
}
