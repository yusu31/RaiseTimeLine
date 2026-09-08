import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './client'

/**
 * `apiRequest` はアプリのすべてのAPI呼び出しが通る土台。
 * ここが壊れると全機能が同時に動かなくなるため、外向きの `fetch` を差し替えて
 * 「どんなリクエストを組み立てたか」「返ってきたものをどう解釈したか」を確認する。
 *
 * MSW は導入しない。この規模なら `vi.stubGlobal` で十分で、設定の二重管理も生まない。
 */

const fetchMock = vi.fn()

/**
 * fetch が返す Response の代わりを作る。
 * 本物の Response は本文を一度しか読めないなど扱いが面倒なので、
 * `client.ts` が実際に使う ok / status / json() / text() だけを持つ最小のものを用意する。
 *
 * json を async にしているのは意図的。本物の `Response.json()` は本文が壊れていると
 * 「失敗したPromise」を返す。同期的に例外を投げる形にしてしまうと `.catch()` を通らず、
 * 本番と違う経路をテストすることになる。
 */
function mockResponse(options: { ok?: boolean; status?: number; body?: string } = {}): Response {
  const { ok = true, status = 200, body = '' } = options
  return {
    ok,
    status,
    json: async () => JSON.parse(body) as unknown,
    text: async () => body,
  } as unknown as Response
}

/** fetch に渡された2番目の引数（メソッド・ヘッダー・本文）を取り出す */
function capturedInit(): { method?: string; headers?: Record<string, string>; body?: unknown } {
  return fetchMock.mock.calls[0][1] as {
    method?: string
    headers?: Record<string, string>
    body?: unknown
  }
}

/** fetch に渡された1番目の引数（URL）を取り出す */
function capturedUrl(): string {
  return fetchMock.mock.calls[0][0] as string
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiRequest — リクエストの組み立て', () => {
  it('パスの先頭に /api を付けて呼び出す', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: '{}' }))

    await apiRequest('/posts')

    expect(capturedUrl()).toBe('/api/posts')
  })

  it('メソッドを指定しないと GET になる', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: '{}' }))

    await apiRequest('/posts')

    expect(capturedInit().method).toBe('GET')
  })

  it('指定したメソッドがそのまま使われる', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: '{}' }))

    await apiRequest('/posts/1', { method: 'DELETE' })

    expect(capturedInit().method).toBe('DELETE')
  })

  it('body が無いとき Content-Type を付けず、本文も送らない', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: '{}' }))

    await apiRequest('/posts')

    expect(capturedInit().headers).not.toHaveProperty('Content-Type')
    expect(capturedInit().body).toBeUndefined()
  })

  it('オブジェクトの body は JSON 文字列に変換し、Content-Type に application/json を付ける', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: '{}' }))

    await apiRequest('/posts', { method: 'POST', body: { content: 'こんにちは' } })

    expect(capturedInit().headers?.['Content-Type']).toBe('application/json')
    expect(capturedInit().body).toBe('{"content":"こんにちは"}')
  })

  /**
   * このテストがこのファイルの主目的のひとつ。
   * multipart/form-data の区切り文字（boundary）はブラウザが自動で決める。
   * 手で Content-Type を書くと boundary が欠け、サーバーが本文を読めなくなる（＝画像投稿が壊れる）。
   * 「付けない」ことが仕様なので、付いていないことを確認する。
   */
  it('FormData の body には Content-Type を付けず、JSON 文字列にも変換しない', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: '{}' }))
    const formData = new FormData()
    formData.append('content', 'こんにちは')

    await apiRequest('/posts', { method: 'POST', body: formData })

    expect(capturedInit().headers).not.toHaveProperty('Content-Type')
    expect(capturedInit().body).toBe(formData)
  })

  it('accessToken を渡すと Authorization に Bearer 付きで入る', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: '{}' }))

    await apiRequest('/posts', { accessToken: 'token-abc' })

    expect(capturedInit().headers?.Authorization).toBe('Bearer token-abc')
  })

  it('accessToken を渡さないと Authorization を付けない', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: '{}' }))

    await apiRequest('/posts')

    expect(capturedInit().headers).not.toHaveProperty('Authorization')
  })

  it('FormData と accessToken を同時に渡すと Authorization だけが付く', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: '{}' }))
    const formData = new FormData()

    await apiRequest('/posts', { method: 'POST', body: formData, accessToken: 'token-abc' })

    expect(capturedInit().headers?.Authorization).toBe('Bearer token-abc')
    expect(capturedInit().headers).not.toHaveProperty('Content-Type')
  })
})

describe('apiRequest — 成功レスポンスの解釈', () => {
  it('本文の JSON をオブジェクトにして返す', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: '{"id":1,"content":"本文"}' }))

    const result = await apiRequest<{ id: number; content: string }>('/posts/1')

    expect(result).toEqual({ id: 1, content: '本文' })
  })

  /**
   * 削除API（204 No Content）のように本文が空で返るケース。
   * ここで素直に JSON.parse('') を呼ぶと例外になるため、空なら undefined を返す分岐がある。
   */
  it('本文が空のときは undefined を返す（204 No Content を想定）', async () => {
    fetchMock.mockResolvedValue(mockResponse({ status: 204, body: '' }))

    const result = await apiRequest('/posts/1', { method: 'DELETE' })

    expect(result).toBeUndefined()
  })
})

describe('apiRequest — エラーレスポンスの解釈', () => {
  it('サーバーが message を返したら、その文言で ApiError を投げる', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ ok: false, status: 400, body: '{"message":"本文は280文字以内で入力してください"}' }),
    )

    await expect(apiRequest('/posts')).rejects.toThrow('本文は280文字以内で入力してください')
  })

  it('ApiError に HTTP ステータスがそのまま入る', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: false, status: 403, body: '{"message":"権限がありません"}' }))

    await expect(apiRequest('/posts/1')).rejects.toMatchObject({ status: 403 })
  })

  /**
   * サーバーが落ちて HTML のエラーページを返す、といった場面。
   * JSON として読めないので、既定の文言に切り替わることを確認する。
   */
  it('本文が JSON として壊れていても、既定の文言で ApiError を投げる', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: false, status: 500, body: '<html>Internal Server Error</html>' }))

    await expect(apiRequest('/posts')).rejects.toThrow('通信中にエラーが発生しました')
  })

  it('JSON は読めても message が無ければ、既定の文言で ApiError を投げる', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: false, status: 401, body: '{"timestamp":"2026-09-08T00:00:00Z"}' }))

    await expect(apiRequest('/posts')).rejects.toThrow('通信中にエラーが発生しました')
  })

  it('エラーのとき本文を JSON として読み、テキストとしては読まない', async () => {
    const response = mockResponse({ ok: false, status: 500, body: '{"message":"失敗"}' })
    const textSpy = vi.spyOn(response, 'text')
    fetchMock.mockResolvedValue(response)

    await expect(apiRequest('/posts')).rejects.toThrow(ApiError)
    expect(textSpy).not.toHaveBeenCalled()
  })
})

describe('ApiError', () => {
  it('status と message を保持する', () => {
    const error = new ApiError(404, '投稿が見つかりません')

    expect(error.status).toBe(404)
    expect(error.message).toBe('投稿が見つかりません')
  })

  /**
   * 呼び出し側は `error instanceof ApiError` で「APIが返したエラー」かどうかを判定し、
   * `error.name` を表示に使うことがある。どちらも壊れないよう固定しておく。
   */
  it('name が ApiError で、Error として扱える', () => {
    const error = new ApiError(500, 'サーバーエラー')

    expect(error.name).toBe('ApiError')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ApiError)
  })
})
