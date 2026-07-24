export type PostAuthor = {
  id: number
  displayName: string
}

export type Post = {
  id: number
  content: string
  imageUrl: string | null
  author: PostAuthor
  likeCount: number
  commentCount: number
  likedByMe: boolean
  createdAt: string
}

export type PostListResponse = {
  posts: Post[]
  page: number
  hasNext: boolean
}

export type NewPostsCountResponse = {
  count: number
}

export type NewPostsResponse = {
  posts: Post[]
  hasMore: boolean
}

export type LikeStatusResponse = {
  likeCount: number
  likedByMe: boolean
}
