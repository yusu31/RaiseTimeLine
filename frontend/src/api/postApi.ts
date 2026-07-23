import type { Post, PostListResponse } from '../types/post'

type AuthorizedRequest = <T>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>

export function fetchTimeline(request: AuthorizedRequest, page = 0, size = 20): Promise<PostListResponse> {
  return request<PostListResponse>(`/posts?page=${page}&size=${size}`)
}

export function createPost(request: AuthorizedRequest, content: string, image: File | null): Promise<Post> {
  const formData = new FormData()
  formData.append('content', content)
  if (image) {
    formData.append('image', image)
  }
  return request<Post>('/posts', { method: 'POST', body: formData })
}

export function updatePost(request: AuthorizedRequest, id: number, content: string): Promise<Post> {
  return request<Post>(`/posts/${id}`, { method: 'PUT', body: { content } })
}

export function deletePost(request: AuthorizedRequest, id: number): Promise<void> {
  return request<void>(`/posts/${id}`, { method: 'DELETE' })
}
