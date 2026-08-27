export type UserProfile = {
  id: number
  username: string
  displayName: string
  bio: string | null
  iconImageUrl: string | null
  createdAt: string
}

export type ProfileUpdateRequest = {
  displayName: string
  username: string
  bio: string
}
