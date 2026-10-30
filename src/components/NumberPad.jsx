import { memo } from 'react'
import { cn } from '../utils/cn.js'

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

function EraseIcon() {
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
      <path d="M20 20H8.5L3 14.5a2 2 0 0 1 0-2.8l7.7-7.7a2 2 0 0 1 2.8 0l5.8 5.8a2 2 0 0 1 0 2.8L13.8 18" />
      <path d="m9 9 6 6" />
    </svg>
  )
}

/**
 * 手機用數字鍵盤：1–5 / 6–9+清除，兩列五欄。
 * 沒選取可輸入的格子時整組禁用；數字填滿 9 個後淡化並禁用。
 *
 * @param {object} props
 * @param {(number: number) => void} props.onInput
 * @param {() => void} props.onErase
 * @param {boolean} props.disabled 是否禁用輸入（沒選取／選到題目格／已完成）
 * @param {Record<number, number>} props.remaining 每個數字還剩幾格
 */
function NumberPad({ onInput, onErase, disabled, remaining }) {
  return (
    <div
      role="group"
      aria-label="數字輸入鍵盤"
      className="rounded-2xl bg-white p-2 shadow-card ring-1 ring-slate-200/70 sm:p-2.5"
    >
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {NUMBERS.map((number) => {
          const left = remaining?.[number] ?? 9
          const isFinished = left === 0
          const isDisabled = disabled || isFinished

          return (
            <button
              key={number}
              type="button"
              disabled={isDisabled}
              onClick={() => onInput(number)}
              aria-label={
                isFinished ? `數字 ${number} 已全部填入` : `填入數字 ${number}，還剩 ${left} 個`
              }
              className={cn(
                'relative flex h-12 min-w-0 items-center justify-center rounded-xl',
                'text-lg font-semibold leading-none tabular transition-colors touch-manipulation no-select',
                'focus-visible:ring-offset-0',
                isFinished
                  ? 'bg-slate-100 text-slate-400 line-through decoration-1'
                  : 'bg-slate-100 text-slate-800 hover:bg-brand-50 active:bg-brand-200 active:scale-95',
                isDisabled && 'cursor-not-allowed opacity-40',
              )}
            >
              {number}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute right-1 top-1 text-[10px] font-medium leading-none tabular',
                  left === 0 ? 'text-slate-300' : 'text-slate-400',
                )}
              >
                {left}
              </span>
            </button>
          )
        })}

        <button
          type="button"
          disabled={disabled}
          onClick={onErase}
          aria-label="清除選取格的數字"
          className={cn(
            'relative flex h-12 min-w-0 items-center justify-center gap-1 rounded-xl',
            'text-sm font-semibold leading-none transition-colors touch-manipulation no-select',
            'bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600 active:bg-red-100 active:scale-95',
            'focus-visible:ring-offset-0',
            disabled && 'cursor-not-allowed opacity-40',
          )}
        >
          <EraseIcon />
          <span>清除</span>
        </button>
      </div>
    </div>
  )
}

export default memo(NumberPad)
