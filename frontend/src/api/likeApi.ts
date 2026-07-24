import type { LikeStatusResponse } from '../types/post'

type AuthorizedRequest = <T>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>

export function likePost(request: AuthorizedRequest, postId: number): Promise<LikeStatusResponse> {
  return request<LikeStatusResponse>(`/posts/${postId}/likes`, { method: 'POST' })
}

export function unlikePost(request: AuthorizedRequest, postId: number): Promise<LikeStatusResponse> {
  return request<LikeStatusResponse>(`/posts/${postId}/likes`, { method: 'DELETE' })
}
