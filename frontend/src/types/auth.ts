export type UserResponse = {
  id: number
  displayName: string
  email: string
}

export type AuthResponse = {
  accessToken: string
  refreshToken: string
  user: UserResponse
}

export type SignupRequest = {
  email: string
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
