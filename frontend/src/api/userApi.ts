import type { UserResponse } from '../types/auth'
import type { PostListResponse } from '../types/post'
import type { ProfileUpdateRequest, UserProfile } from '../types/user'

type AuthorizedRequest = <T>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>

export function fetchProfile(request: AuthorizedRequest, username: string): Promise<UserProfile> {
  return request<UserProfile>(`/users/${encodeURIComponent(username)}`)
}

export function fetchUserPosts(
  request: AuthorizedRequest,
  username: string,
  page = 0,
  size = 20,
): Promise<PostListResponse> {
  return request<PostListResponse>(`/users/${encodeURIComponent(username)}/posts?page=${page}&size=${size}`)
}

export function updateProfile(request: AuthorizedRequest, body: ProfileUpdateRequest): Promise<UserResponse> {
  return request<UserResponse>('/users/me', { method: 'PUT', body })
}

export function updateIcon(request: AuthorizedRequest, image: File): Promise<UserResponse> {
  const formData = new FormData()
  formData.append('image', image)
  return request<UserResponse>('/users/me/icon', { method: 'POST', body: formData })
}
