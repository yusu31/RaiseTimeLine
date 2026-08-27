export type UserResponse = {
  id: number
  username: string
  displayName: string
  email: string
  // 以前のログインで localStorage に保存された値には存在しないため、undefined も許容する
  iconImageUrl?: string | null
}

export type AuthResponse = {
  accessToken: string
  refreshToken: string
  user: UserResponse
}

export type SignupRequest = {
  email: string
  username: string
  displayName: string
  password: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type RefreshResponse = {
  accessToken: string
}

export type ErrorResponse = {
  status: number
  error: string
  message: string
}
