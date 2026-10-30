import { useEffect, useId, useRef } from 'react'
import { cn } from '../utils/cn.js'
import { formatDuration } from '../utils/date.js'
import { DIFFICULTY } from '../utils/sudokuLogic.js'

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="h-7 w-7"
    >
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="h-4 w-4"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

/**
 * 勝利對話框：overlay + 焦點管理（開啟時聚焦主要按鈕、Tab 循環、Esc 關閉）。
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {'daily' | 'random'} props.mode
 * @param {1 | 2 | 3} props.difficulty
 * @param {number} props.elapsed
 * @param {() => void} props.onReplay
 * @param {() => void} props.onNewGame
 * @param {() => void} props.onClose
 */
export default function WinDialog({ open, mode, difficulty, elapsed, onReplay, onNewGame, onClose }) {
  const dialogRef = useRef(null)
  const primaryRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return undefined
    const previouslyFocused = document.activeElement
    primaryRef.current?.focus({ preventScroll: true })

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(dialogRef.current?.querySelectorAll('button') ?? [])
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      } else if (!focusable.includes(document.activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [open, onClose])

  if (!open) return null

  const difficultyLabel = DIFFICULTY[difficulty]?.labelZh ?? ''
  const modeLabel = mode === 'daily' ? '每日挑戰' : '自由練習'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-sm motion-safe:animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[420px] rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-900/5 motion-safe:animate-dialog-in sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 motion-safe:animate-cell-pop">
            <CheckIcon />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉完成視窗"
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-colors',
              'hover:bg-slate-100 hover:text-slate-600 touch-manipulation',
            )}
          >
            <CloseIcon />
          </button>
        </div>

        <h2 id={titleId} className="mt-4 text-xl font-bold tracking-tight text-slate-900">
          完成了！
        </h2>
        <p id={descriptionId} className="mt-1 text-sm text-slate-500">
          {modeLabel} · {difficultyLabel}
        </p>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
          <span className="text-xs font-medium text-slate-500">完成時間</span>
          <span className="tabular text-2xl font-bold text-brand-700">{formatDuration(elapsed)}</span>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            ref={primaryRef}
            type="button"
            onClick={onReplay}
            className={cn(
              'flex h-12 flex-1 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white',
              'shadow-sm transition-colors hover:bg-brand-700 active:bg-brand-800 touch-manipulation',
            )}
          >
            再玩一次
          </button>
          <button
            type="button"
            onClick={onNewGame}
            className={cn(
              'flex h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700',
              'transition-colors hover:bg-slate-50 active:bg-slate-100 touch-manipulation',
            )}
          >
            新遊戲
          </button>
        </div>
      </div>
    </div>
  )
}
