import { apiRequest } from './client'
import type { AuthResponse, LoginRequest, SignupRequest } from '../types/auth'

export function signup(request: SignupRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/signup', { method: 'POST', body: request })
}

export function login(request: LoginRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: request })
}
