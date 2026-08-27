/** フォロー／フォロー解除APIの結果。対象ユーザーの最新のフォロワー数と、自分がフォロー中かどうか */
export type FollowStatus = {
  followerCount: number
  followedByMe: boolean
}

/** フォロー中／フォロワー一覧の1件 */
export type FollowUser = {
  id: number
  username: string
  displayName: string
  iconImageUrl: string | null
  followedByMe: boolean
}

/** 一覧画面をフォロー中／フォロワーのどちらとして開いているか */
export type FollowListMode = 'following' | 'followers'
