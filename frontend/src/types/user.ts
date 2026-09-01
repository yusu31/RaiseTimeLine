export type UserProfile = {
  id: number
  username: string
  displayName: string
  bio: string | null
  iconImageUrl: string | null
  createdAt: string
  /** このユーザーがフォローしている人数 */
  followingCount: number
  /** このユーザーをフォローしている人数 */
  followerCount: number
  /** 閲覧者がこのユーザーをフォロー中か */
  followedByMe: boolean
}

/**
 * ユーザー検索結果の1件分。
 * 検索結果にはフォローボタンを出さないため、フォロー一覧の FollowUser と違い followedByMe を持たない。
 */
export type UserSearchResult = {
  id: number
  username: string
  displayName: string
  iconImageUrl: string | null
}

export type ProfileUpdateRequest = {
  displayName: string
  username: string
  bio: string
}
