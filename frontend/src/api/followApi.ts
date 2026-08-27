import type { FollowStatus, FollowUser } from '../types/follow'

type AuthorizedRequest = <T>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>

export function followUser(request: AuthorizedRequest, username: string): Promise<FollowStatus> {
  return request<FollowStatus>(`/users/${encodeURIComponent(username)}/follow`, { method: 'POST' })
}

export function unfollowUser(request: AuthorizedRequest, username: string): Promise<FollowStatus> {
  return request<FollowStatus>(`/users/${encodeURIComponent(username)}/follow`, { method: 'DELETE' })
}

export function fetchFollowing(request: AuthorizedRequest, username: string): Promise<FollowUser[]> {
  return request<FollowUser[]>(`/users/${encodeURIComponent(username)}/following`)
}

export function fetchFollowers(request: AuthorizedRequest, username: string): Promise<FollowUser[]> {
  return request<FollowUser[]>(`/users/${encodeURIComponent(username)}/followers`)
}
