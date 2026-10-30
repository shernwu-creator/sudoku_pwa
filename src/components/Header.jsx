import { cn } from '../utils/cn.js'
import { formatDuration } from '../utils/date.js'
import { DIFFICULTY, DIFFICULTY_ORDER } from '../utils/sudokuLogic.js'

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="h-4 w-4 shrink-0"
    >
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="h-4 w-4 shrink-0"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

function ChevronDownIcon() {
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
      className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

/**
 * 頂部資訊列：日期、計時器、模式切換、難度選單。
 *
 * @param {object} props
 * @param {string} props.dateLabel 已格式化的本地日期（zh-TW）
 * @param {'daily' | 'random'} props.mode
 * @param {1 | 2 | 3} props.difficulty
 * @param {number} props.elapsed 已遊玩秒數
 * @param {(difficulty: number) => void} props.onDifficultyChange
 * @param {() => void} props.onNewGame
 * @param {() => void} props.onStartDaily
 */
export default function Header({
  dateLabel,
  mode,
  difficulty,
  elapsed,
  onDifficultyChange,
  onNewGame,
  onStartDaily,
}) {
  const isDaily = mode === 'daily'

  return (
    <header className="rounded-2xl bg-white p-3 shadow-card ring-1 ring-slate-200/70 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5 text-slate-500">
          <CalendarIcon />
          <p className="truncate text-xs font-medium tracking-tight sm:text-sm">{dateLabel}</p>
        </div>
        <div
          role="timer"
          aria-label={`已遊玩時間 ${formatDuration(elapsed)}`}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-brand-700"
        >
          <ClockIcon />
          <span aria-hidden="true" className="tabular text-sm font-semibold leading-none">
            {formatDuration(elapsed)}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-stretch gap-2">
        <div
          role="group"
          aria-label="遊戲模式"
          className="flex min-w-0 flex-1 gap-1 rounded-xl bg-slate-100 p-1"
        >
          <button
            type="button"
            onClick={onStartDaily}
            aria-pressed={isDaily}
            className={cn(
              'flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg px-2 text-sm font-semibold transition-colors touch-manipulation no-select',
              isDaily
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/70 active:bg-white',
            )}
          >
            每日挑戰
          </button>
          <button
            type="button"
            onClick={onNewGame}
            aria-pressed={!isDaily}
            className={cn(
              'flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg px-2 text-sm font-semibold transition-colors touch-manipulation no-select',
              !isDaily
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/70 active:bg-white',
            )}
          >
            新遊戲
          </button>
        </div>

        <div className="relative shrink-0">
          <select
            aria-label="難度"
            value={difficulty}
            onChange={(event) => onDifficultyChange(Number(event.target.value))}
            className="h-11 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 touch-manipulation"
          >
            {DIFFICULTY_ORDER.map((value) => (
              <option key={value} value={value}>
                {DIFFICULTY[value]?.labelZh ?? DIFFICULTY[value]?.label ?? value}
              </option>
            ))}
          </select>
          <ChevronDownIcon />
        </div>
      </div>
    </header>
  )
}
