import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useInfiniteScroll } from './useInfiniteScroll'

/**
 * リストの一番下に置いた印（センチネル）が画面に入ったら、次のページを読み込むフック。
 *
 * 使っているのは `IntersectionObserver`（要素が画面に入ったことを知るブラウザの仕組み）で、
 * テストを動かす jsdom には存在しない。そこで観測役を自分で作り、
 * 「画面に入った」という知らせを**手で起こせる**ようにする。
 * こうすると、実際にスクロールしなくても読み込みの判断だけを確かめられる。
 */
type ObserverEntry = { isIntersecting: boolean }
type ObserverCallback = (entries: ObserverEntry[]) => void

let notifyIntersection: ObserverCallback = () => {}
let observerOptions: IntersectionObserverInit | undefined
const observeMock = vi.fn()
const disconnectMock = vi.fn()

class IntersectionObserverStub {
  constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
    notifyIntersection = callback
    observerOptions = options
  }
  observe = observeMock
  unobserve = vi.fn()
  disconnect = disconnectMock
}

vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)

/**
 * フックが返す ref は「実際の要素」に付いていないと監視が始まらない。
 * renderHook では要素に付けられないため、小さな部品を用意して本物のDOMに付ける。
 */
function Probe({ hasNext, onLoadMore }: { hasNext: boolean; onLoadMore: () => void }) {
  const sentinelRef = useInfiniteScroll(hasNext, onLoadMore)
  return <div ref={sentinelRef} data-testid="sentinel" />
}

beforeEach(() => {
  observeMock.mockClear()
  disconnectMock.mockClear()
  notifyIntersection = () => {}
  observerOptions = undefined
})

describe('useInfiniteScroll — 監視するかどうか', () => {
  it('次のページがあるときは監視を始める', () => {
    render(<Probe hasNext={true} onLoadMore={vi.fn()} />)

    expect(observeMock).toHaveBeenCalledTimes(1)
  })

  it('次のページが無いときは監視を始めない', () => {
    // 最後まで読み終えたあとも監視し続けると、無駄な通信が起き続ける
    render(<Probe hasNext={false} onLoadMore={vi.fn()} />)

    expect(observeMock).not.toHaveBeenCalled()
  })

  it('リストの一番下に置いた印を監視する', () => {
    render(<Probe hasNext={true} onLoadMore={vi.fn()} />)

    expect(observeMock).toHaveBeenCalledWith(screen.getByTestId('sentinel'))
  })

  it('画面に入りきる手前で先に読み込むよう余白を指定する', () => {
    // 余白が無いと、画面に入ってから読み始めるためスクロールが一瞬止まって見える
    render(<Probe hasNext={true} onLoadMore={vi.fn()} />)

    expect(observerOptions).toEqual({ rootMargin: '200px' })
  })
})

describe('useInfiniteScroll — 読み込みの合図', () => {
  it('印が画面に入ったら次のページを読み込む', () => {
    const onLoadMore = vi.fn()
    render(<Probe hasNext={true} onLoadMore={onLoadMore} />)

    notifyIntersection([{ isIntersecting: true }])

    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('印が画面に入っていなければ読み込まない', () => {
    // 知らせが届いただけで読み込むと、画面外へ出たときにも走ってしまう
    const onLoadMore = vi.fn()
    render(<Probe hasNext={true} onLoadMore={onLoadMore} />)

    notifyIntersection([{ isIntersecting: false }])

    expect(onLoadMore).not.toHaveBeenCalled()
  })
})

describe('useInfiniteScroll — 後片付け', () => {
  it('部品が取り外されたら監視をやめる', () => {
    // やめないと、消えた要素を見張り続けて無駄が残る
    const { unmount } = render(<Probe hasNext={true} onLoadMore={vi.fn()} />)

    unmount()

    expect(disconnectMock).toHaveBeenCalledTimes(1)
  })
})
