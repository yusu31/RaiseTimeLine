import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { searchUsers } from '../api/userApi'
import type { UserSearchResult } from '../types/user'
import { UserSearchResults } from './UserSearchResults'

/**
 * 検索画面の「ユーザー」タブの中身。
 *
 * 通信は userApi をモジュールごと差し替えて止める。
 * ApiError は本物を使う（api/client はモックしない）。
 * 偽物にすると `err instanceof ApiError` の判定が成立せず、
 * 「サーバーからのメッセージ」と「通信そのものの失敗」を区別する分岐を確かめられない。
 */
vi.mock('../api/userApi', () => ({
  searchUsers: vi.fn(),
}))

/**
 * 認証つき通信フックは、毎回同じ関数を返すようにしておく。
 * 呼ばれるたびに別の関数を返すと、この部品の useEffect が
 * 「材料が変わった」と誤解して検索をやり直し続けてしまう。
 * vi.hoisted を使うのは、vi.mock が読み込み順の先頭へ巻き上げられる（ホイスティング）ため。
 */
const { authorizedRequestMock } = vi.hoisted(() => ({ authorizedRequestMock: vi.fn() }))
vi.mock('../hooks/useAuthorizedRequest', () => ({
  useAuthorizedRequest: () => authorizedRequestMock,
}))

const searchUsersMock = vi.mocked(searchUsers)

const suzuki: UserSearchResult = {
  id: 1,
  username: 'user1',
  displayName: '鈴木',
  iconImageUrl: null,
}

/** Link を含むため、テスト用のルーター（MemoryRouter）の中でしか描画できない */
function renderResults(keyword: string) {
  return render(
    <MemoryRouter>
      <UserSearchResults keyword={keyword} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  searchUsersMock.mockReset()
})

describe('UserSearchResults — キーワードが空のとき', () => {
  it('使い方の案内を表示する', () => {
    renderResults('')

    expect(screen.getByText('@ユーザー名や表示名の一部を入力すると検索できます')).toBeInTheDocument()
  })

  it('検索そのものを行わない', () => {
    // 何も入力していない状態で通信すると、文字を消すたびに無駄な検索が飛ぶ
    renderResults('')

    expect(searchUsersMock).not.toHaveBeenCalled()
  })
})

describe('UserSearchResults — 検索できたとき', () => {
  it('入力されたキーワードで検索する', async () => {
    searchUsersMock.mockResolvedValue([suzuki])

    renderResults('鈴木')

    await waitFor(() => expect(searchUsersMock).toHaveBeenCalledWith(authorizedRequestMock, '鈴木'))
  })

  it('見つかったユーザーの表示名を並べる', async () => {
    searchUsersMock.mockResolvedValue([suzuki])

    renderResults('鈴木')

    expect(await screen.findByText('鈴木')).toBeInTheDocument()
  })

  it('見つかったユーザーの@ユーザー名を表示する', async () => {
    // 表示名は重複しうるので、どの人かは@ユーザー名で見分ける
    searchUsersMock.mockResolvedValue([suzuki])

    renderResults('鈴木')

    expect(await screen.findByText('@user1')).toBeInTheDocument()
  })

  it('プロフィール画面へのリンクにする', async () => {
    searchUsersMock.mockResolvedValue([suzuki])

    renderResults('鈴木')

    expect(await screen.findByRole('link')).toHaveAttribute('href', '/users/user1')
  })

  it('結果が0件のときは見つからなかったことを伝える', async () => {
    searchUsersMock.mockResolvedValue([])

    renderResults('いない人')

    expect(await screen.findByText('「いない人」に一致するユーザーは見つかりませんでした')).toBeInTheDocument()
  })
})

describe('UserSearchResults — 失敗したとき', () => {
  it('サーバーがエラーを返したときは、その内容を表示する', async () => {
    searchUsersMock.mockRejectedValue(new ApiError(400, '検索キーワードが不正です'))

    renderResults('鈴木')

    expect(await screen.findByText('検索キーワードが不正です')).toBeInTheDocument()
  })

  it('通信そのものが失敗したときは、決まった文言を表示する', async () => {
    // サーバーに届いていないので伝える内容が無い。原因を書けない代わりに定型文にする
    searchUsersMock.mockRejectedValue(new TypeError('Failed to fetch'))

    renderResults('鈴木')

    expect(await screen.findByText('通信中にエラーが発生しました')).toBeInTheDocument()
  })

  it('失敗したときは前の検索結果を残さない', async () => {
    searchUsersMock.mockResolvedValueOnce([suzuki])
    const { rerender } = renderResults('鈴木')
    expect(await screen.findByText('鈴木')).toBeInTheDocument()

    searchUsersMock.mockRejectedValueOnce(new ApiError(500, 'サーバーエラーが発生しました'))
    rerender(
      <MemoryRouter>
        <UserSearchResults keyword="鈴木さん" />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.queryByText('@user1')).not.toBeInTheDocument())
  })
})

describe('UserSearchResults — 通信の追い越し', () => {
  it('通信中にキーワードが変わったら、古い結果で画面を上書きしない', async () => {
    // 「す」の検索が遅れているあいだに「すず」へ進んだ場面を再現する。
    // 先に投げた通信のほうが後から返ることは実際に起きる。
    // このとき古い結果を書き込むと、入力した文字と画面がずれる。
    let finishSlowSearch: (users: UserSearchResult[]) => void = () => {}
    searchUsersMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSlowSearch = resolve
        }),
    )
    searchUsersMock.mockResolvedValueOnce([suzuki])

    const { rerender } = renderResults('す')
    rerender(
      <MemoryRouter>
        <UserSearchResults keyword="すず" />
      </MemoryRouter>,
    )
    expect(await screen.findByText('鈴木')).toBeInTheDocument()

    // ここで遅れていた「す」の結果がようやく返ってくる
    finishSlowSearch([{ id: 2, username: 'user2', displayName: '佐藤', iconImageUrl: null }])

    await waitFor(() => expect(screen.queryByText('佐藤')).not.toBeInTheDocument())
    expect(screen.getByText('鈴木')).toBeInTheDocument()
  })
})
