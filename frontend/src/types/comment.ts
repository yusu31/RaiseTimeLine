import type { PostAuthor } from './post'

export type Comment = {
  id: number
  postId: number
  content: string
  author: PostAuthor
  createdAt: string
}
