import { useEffect, type RefObject } from 'react'

const SCROLLABLE_SELECTOR = '.ant-table-body, .ant-table-content'
const SCROLL_END_THRESHOLD = 1
const SCROLLBAR_HIDE_DELAY_MS = 700

interface ScrollEdges {
  top: boolean
  bottom: boolean
  left: boolean
  right: boolean
}

function getScrollEdges(element: HTMLElement): ScrollEdges {
  return {
    top: element.scrollTop > SCROLL_END_THRESHOLD,
    bottom: element.scrollTop + element.clientHeight < element.scrollHeight - SCROLL_END_THRESHOLD,
    left: element.scrollLeft > SCROLL_END_THRESHOLD,
    right: element.scrollLeft + element.clientWidth < element.scrollWidth - SCROLL_END_THRESHOLD
  }
}

function mergeEdges(current: ScrollEdges, next: ScrollEdges): ScrollEdges {
  return {
    top: current.top || next.top,
    bottom: current.bottom || next.bottom,
    left: current.left || next.left,
    right: current.right || next.right
  }
}

function applyEdgeClasses(shell: HTMLElement, edges: ScrollEdges): void {
  shell.classList.toggle('table-scroll-shell--fade-top', edges.top)
  shell.classList.toggle('table-scroll-shell--fade-bottom', edges.bottom)
  shell.classList.toggle('table-scroll-shell--fade-left', edges.left)
  shell.classList.toggle('table-scroll-shell--fade-right', edges.right)
}

export function useTableScrollChrome(
  shellRef: RefObject<HTMLDivElement | null>,
  refreshKey?: unknown
): void {
  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    let hideScrollbarTimer: ReturnType<typeof setTimeout> | undefined
    const cleanups: Array<() => void> = []

    const refreshEdges = (): void => {
      const scrollers = Array.from(shell.querySelectorAll<HTMLElement>(SCROLLABLE_SELECTOR))
      const edges = scrollers.reduce<ScrollEdges>(
        (acc, element) => mergeEdges(acc, getScrollEdges(element)),
        { top: false, bottom: false, left: false, right: false }
      )
      applyEdgeClasses(shell, edges)
    }

    const markScrolling = (): void => {
      shell.classList.add('table-scroll-shell--scrolling')
      clearTimeout(hideScrollbarTimer)
      hideScrollbarTimer = setTimeout(() => {
        shell.classList.remove('table-scroll-shell--scrolling')
      }, SCROLLBAR_HIDE_DELAY_MS)
    }

    const bindScroller = (element: HTMLElement): void => {
      const onScroll = (): void => {
        markScrolling()
        refreshEdges()
      }

      element.addEventListener('scroll', onScroll, { passive: true })
      cleanups.push(() => element.removeEventListener('scroll', onScroll))

      const resizeObserver = new ResizeObserver(() => refreshEdges())
      resizeObserver.observe(element)
      cleanups.push(() => resizeObserver.disconnect())
    }

    const setup = (): void => {
      while (cleanups.length > 0) {
        cleanups.pop()?.()
      }

      shell.querySelectorAll<HTMLElement>(SCROLLABLE_SELECTOR).forEach(bindScroller)
      refreshEdges()
    }

    const mountTimer = setTimeout(setup, 0)

    return () => {
      clearTimeout(mountTimer)
      clearTimeout(hideScrollbarTimer)
      while (cleanups.length > 0) {
        cleanups.pop()?.()
      }
      shell.classList.remove(
        'table-scroll-shell--scrolling',
        'table-scroll-shell--fade-top',
        'table-scroll-shell--fade-bottom',
        'table-scroll-shell--fade-left',
        'table-scroll-shell--fade-right'
      )
    }
  }, [shellRef, refreshKey])
}
