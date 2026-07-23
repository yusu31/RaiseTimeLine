import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { login } from '../api/authApi'
import { ApiError } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { FormField } from '../components/FormField'

export function LoginPage() {
  const { login: setAuth } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await login({ email, password })
      setAuth(response)
      navigate('/welcome', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信中にエラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F9F9] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-8 text-center text-2xl font-bold text-[#0F1419]">RaiseTimeLine</h1>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <FormField
            id="login-email"
            label="メールアドレス"
            type="email"
            autoComplete="username"
            value={email}
            onChange={setEmail}
          />
          <FormField
            id="login-password"
            label="パスワード"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 rounded-full bg-[#1D9BF0] py-2 font-bold text-white transition hover:bg-[#1a8cd8] disabled:opacity-50"
          >
            {isSubmitting ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          アカウントをお持ちでない方は{' '}
          <Link to="/signup" className="font-medium text-[#1D9BF0] hover:underline">
            新規登録
          </Link>
        </p>
      </div>
    </div>
  )
}
