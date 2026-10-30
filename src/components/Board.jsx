import { memo, useEffect, useRef } from 'react'
import { cn } from '../utils/cn.js'

const INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8]

/**
 * 棋盤格線一律 1px：3×3 宮的界線只用「較深的顏色」區隔，避免出現粗細不一。
 * 最右欄／最下列由棋盤外框負責，避免雙重邊框。
 */
function cellBorderClass(row, col) {
  return cn(
    col < 8 && 'border-r',
    row < 8 && 'border-b',
    col < 8 && (col === 2 || col === 5 ? 'border-r-slate-500' : 'border-r-slate-300'),
    row < 8 && (row === 2 || row === 5 ? 'border-b-slate-500' : 'border-b-slate-300'),
  )
}

function cellAriaLabel({ row, col, value, given, conflict }) {
  const position = `第${row + 1}列第${col + 1}欄`
  const content = value === 0 ? '空白' : given ? `題目數字${value}` : `數字${value}`
  return conflict ? `${position}，${content}，與同列、同行或同宮的數字重複` : `${position}，${content}`
}

/**
 * 9×9 棋盤。純呈現元件：所有狀態都由 useSudokuGame 傳入，
 * 方便之後單獨測試或替換輸入方式。
 *
 * @param {object} props
 * @param {number[][]} props.board 目前盤面（0 = 空格）
 * @param {boolean[][]} props.givens 題目給定格
 * @param {{row: number, col: number} | null} props.selected
 * @param {Set<string>} props.conflicts `"row,col"` 集合
 * @param {{row: number, col: number, token: number} | null} props.lastPlaced 剛填入的格子（播放入場動畫）
 * @param {(row: number, col: number) => void} props.onSelect
 */
function Board({ board, givens, selected, conflicts, lastPlaced, onSelect }) {
  const cellRefs = useRef([])

  // 讓焦點跟著選取格移動：方向鍵操作時螢幕閱讀器才會跟著讀新格子
  useEffect(() => {
    if (!selected) return
    const node = cellRefs.current[selected.row * 9 + selected.col]
    if (node && document.activeElement !== node) {
      node.focus({ preventScroll: true })
    }
  }, [selected])

  const selectedValue = selected ? board[selected.row][selected.col] : 0

  return (
    <section aria-label="數獨" className="w-full">
      <p id="sudoku-board-help" className="sr-only">
        9 乘 9 數獨棋盤。方向鍵移動選取格，數字鍵 1 到 9
        填入，Backspace、Delete 或 0 清除，Escape 取消選取；也可以直接點選格子後使用下方數字鍵盤。
      </p>

      <div
        role="group"
        aria-label="9 乘 9 數獨棋盤"
        aria-describedby="sudoku-board-help"
        className="grid grid-cols-9 overflow-hidden rounded-2xl border-2 border-slate-500 bg-white shadow-board"
      >
        {INDICES.map((row) =>
          INDICES.map((col) => {
            const value = board[row][col]
            const isGiven = givens[row][col]
            const isSelected = selected?.row === row && selected?.col === col
            const isPeer =
              Boolean(selected) && !isSelected && (selected.row === row || selected.col === col)
            const isSameNumber = !isSelected && value !== 0 && value === selectedValue
            const isConflict = conflicts.has(`${row},${col}`)
            const isLastPlaced = lastPlaced?.row === row && lastPlaced?.col === col

            const backgroundClass = isConflict
              ? 'bg-red-100'
              : isSelected
                ? 'bg-brand-200'
                : isSameNumber
                  ? 'bg-brand-100'
                  : isPeer
                    ? 'bg-brand-50'
                    : 'bg-white'

            const textClass = isConflict
              ? 'font-bold text-red-700'
              : value === 0
                ? 'text-slate-900'
                : isGiven
                  ? 'font-bold text-black'
                  : 'font-semibold text-red-600'

            return (
              <button
                key={`${row}-${col}`}
                ref={(node) => {
                  cellRefs.current[row * 9 + col] = node
                }}
                type="button"
                onClick={() => onSelect(row, col)}
                tabIndex={isSelected || (!selected && row === 0 && col === 0) ? 0 : -1}
                aria-label={cellAriaLabel({
                  row,
                  col,
                  value,
                  given: isGiven,
                  conflict: isConflict,
                })}
                aria-selected={isSelected}
                aria-invalid={isConflict || undefined}
                className={cn(
                  'relative flex aspect-square w-full items-center justify-center',
                  'text-[clamp(1.05rem,4.6vw,1.6rem)] leading-none tabular',
                  'touch-manipulation no-select transition-colors duration-100',
                  'focus-visible:z-10',
                  'active:brightness-95',
                  cellBorderClass(row, col),
                  backgroundClass,
                  textClass,
                  isSelected &&
                    (isConflict
                      ? 'ring-2 ring-inset ring-red-500'
                      : 'ring-2 ring-inset ring-brand-600'),
                  isConflict && 'motion-safe:animate-shake',
                  !isSelected && !isConflict && 'hover:brightness-95',
                )}
              >
                {value !== 0 && (
                  <span
                    key={isLastPlaced ? `placed-${lastPlaced.token}` : 'stable'}
                    className={cn(isLastPlaced && 'motion-safe:animate-cell-pop')}
                  >
                    {value}
                  </span>
                )}
                {isConflict && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500"
                  />
                )}
              </button>
            )
          }),
        )}
      </div>
    </section>
  )
}

export default memo(Board)
