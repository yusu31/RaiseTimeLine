import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPost,
  deletePost,
  fetchNewPosts,
  fetchNewPostsCount,
  fetchPost,
  fetchTimeline,
  searchPosts,
  updatePost,
} from './postApi'

/**
 * postApi は「URL とクエリと本文を組み立てて、渡された request 関数に丸投げする」だけの層。
 * 通信そのものは request の中（useAuthorizedRequest → apiRequest）で起きるので、
 * ここでは request を偽物に差し替え、**何を渡したか**だけを見る。fetch のモックすら要らない。
 */

const request = vi.fn()

/** request に渡された1番目の引数（パス）を取り出す */
function capturedPath(): string {
  return request.mock.calls[0][0] as string
}

/** request に渡された2番目の引数（メソッドと本文）を取り出す */
function capturedOptions(): { method?: string; body?: unknown } | undefined {
  return request.mock.calls[0][1] as { method?: string; body?: unknown } | undefined
}

beforeEach(() => {
  request.mockReset()
  request.mockResolvedValue({})
})

describe('fetchTimeline', () => {
  it('引数を省略すると1ページ目を20件で取得する', async () => {
    await fetchTimeline(request)

    expect(capturedPath()).toBe('/posts?page=0&size=20')
  })

  it('ページ番号と件数を指定できる', async () => {
    await fetchTimeline(request, 2, 50)

    expect(capturedPath()).toBe('/posts?page=2&size=50')
  })

  it('フォロー中タブでは timeline=following を付ける', async () => {
    await fetchTimeline(request, 0, 20, 'following')

    expect(capturedPath()).toBe('/posts?page=0&size=20&timeline=following')
  })

  /**
   * 「付ける」側だけを確認すると、常に付けてしまう実装でもテストが通ってしまう。
   * 分岐の裏側（付けない側）も固定する。
   */
  it('全体タブでは timeline を付けない', async () => {
    await fetchTimeline(request, 0, 20, 'all')

    expect(capturedPath()).toBe('/posts?page=0&size=20')
  })
})

describe('searchPosts', () => {
  it('キーワードを q に載せ、既定では1ページ目を20件で取得する', async () => {
    await searchPosts(request, 'react')

    expect(capturedPath()).toBe('/posts?q=react&page=0&size=20')
  })

  /**
   * `&` をそのまま載せると「q=a」と「b=...」という別々のパラメータに割れてしまい、
   * 検索語の後半がサーバーに届かなくなる。エスケープが効いていることを固定する。
   */
  it('& を含むキーワードをエスケープしてクエリを壊さない', async () => {
    await searchPosts(request, 'a&b')

    expect(capturedPath()).toBe('/posts?q=a%26b&page=0&size=20')
  })

  it('日本語のキーワードをエスケープする', async () => {
    await searchPosts(request, 'こんにちは')

    expect(capturedPath()).toBe('/posts?q=%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF&page=0&size=20')
  })

  it('# を含むキーワードをエスケープする', async () => {
    await searchPosts(request, '#タグ')

    expect(capturedPath()).toBe('/posts?q=%23%E3%82%BF%E3%82%B0&page=0&size=20')
  })
})

describe('新着投稿の取得', () => {
  it('fetchNewPostsCount は基準IDを afterId に載せる', async () => {
    await fetchNewPostsCount(request, 42)

    expect(capturedPath()).toBe('/posts/new-count?afterId=42')
  })

  it('fetchNewPosts は基準IDを afterId に載せる', async () => {
    await fetchNewPosts(request, 42)

    expect(capturedPath()).toBe('/posts/new?afterId=42')
  })
})

describe('fetchPost', () => {
  it('投稿IDをパスに含める', async () => {
    await fetchPost(request, 7)

    expect(capturedPath()).toBe('/posts/7')
  })
})

describe('createPost', () => {
  it('POST で /posts に送る', async () => {
    await createPost(request, '本文', null)

    expect(capturedPath()).toBe('/posts')
    expect(capturedOptions()?.method).toBe('POST')
  })

  it('本文を FormData の content に入れる', async () => {
    await createPost(request, 'こんにちは', null)

    const body = capturedOptions()?.body as FormData
    expect(body.get('content')).toBe('こんにちは')
  })

  it('画像を渡すと FormData の image に入る', async () => {
    const image = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' })

    await createPost(request, '本文', image)

    const body = capturedOptions()?.body as FormData
    expect(body.get('image')).toBe(image)
  })

  /**
   * 画像なしのとき、空の image を送ってしまうとサーバー側が
   * 「サイズ0のファイルが来た」と解釈しかねない。キー自体が無いことを確認する。
   */
  it('画像が null のときは image キーを付けない', async () => {
    await createPost(request, '本文', null)

    const body = capturedOptions()?.body as FormData
    expect(body.has('image')).toBe(false)
  })
})

describe('updatePost', () => {
  it('PUT で本文だけを JSON で送る', async () => {
    await updatePost(request, 7, '修正後の本文')

    expect(capturedPath()).toBe('/posts/7')
    expect(capturedOptions()).toEqual({ method: 'PUT', body: { content: '修正後の本文' } })
  })
})

describe('deletePost', () => {
  it('DELETE で本文を付けずに送る', async () => {
    await deletePost(request, 7)

    expect(capturedPath()).toBe('/posts/7')
    expect(capturedOptions()).toEqual({ method: 'DELETE' })
  })
})
