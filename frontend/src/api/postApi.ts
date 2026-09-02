import type { NewPostsCountResponse, NewPostsResponse, Post, PostListResponse } from '../types/post'

type AuthorizedRequest = <T>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>

/** タイムラインの表示範囲。'all' は全ユーザー、'following' はフォロー中＋自分の投稿 */
export type TimelineMode = 'all' | 'following'

export function fetchTimeline(
  request: AuthorizedRequest,
  page = 0,
  size = 20,
  mode: TimelineMode = 'all',
): Promise<PostListResponse> {
  const timelineQuery = mode === 'following' ? '&timeline=following' : ''
  return request<PostListResponse>(`/posts?page=${page}&size=${size}${timelineQuery}`)
}

/**
 * 投稿本文のキーワード検索（F-09）。
 * タイムライン取得と同じ `/posts` に q を付けて呼び分ける（レスポンス形式も同じ）。
 */
export function searchPosts(
  request: AuthorizedRequest,
  keyword: string,
  page = 0,
  size = 20,
): Promise<PostListResponse> {
  return request<PostListResponse>(
    `/posts?q=${encodeURIComponent(keyword)}&page=${page}&size=${size}`,
  )
}

export function fetchNewPostsCount(request: AuthorizedRequest, afterId: number): Promise<NewPostsCountResponse> {
  return request<NewPostsCountResponse>(`/posts/new-count?afterId=${afterId}`)
}

export function fetchNewPosts(request: AuthorizedRequest, afterId: number): Promise<NewPostsResponse> {
  return request<NewPostsResponse>(`/posts/new?afterId=${afterId}`)
}

export function fetchPost(request: AuthorizedRequest, id: number): Promise<Post> {
  return request<Post>(`/posts/${id}`)
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
