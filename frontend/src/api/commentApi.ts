import type { Comment } from '../types/comment'

type AuthorizedRequest = <T>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>

export function fetchComments(request: AuthorizedRequest, postId: number): Promise<Comment[]> {
  return request<Comment[]>(`/posts/${postId}/comments`)
}

export function createComment(request: AuthorizedRequest, postId: number, content: string): Promise<Comment> {
  return request<Comment>(`/posts/${postId}/comments`, { method: 'POST', body: { content } })
}

export function deleteComment(request: AuthorizedRequest, commentId: number): Promise<void> {
  return request<void>(`/comments/${commentId}`, { method: 'DELETE' })
}
