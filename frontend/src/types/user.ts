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

export type ProfileUpdateRequest = {
  displayName: string
  username: string
  bio: string
}
