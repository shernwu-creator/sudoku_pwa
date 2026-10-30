import { useEffect } from 'react'
import Board from './components/Board.jsx'
import Header from './components/Header.jsx'
import NumberPad from './components/NumberPad.jsx'
import WinDialog from './components/WinDialog.jsx'
import { useSudokuGame } from './hooks/useSudokuGame.js'
import { formatDisplayDate, formatDuration } from './utils/date.js'

const DIGIT_PATTERN = /^[1-9]$/

/**
 * 版面組合 + 全域鍵盤操作。
 * 遊戲狀態全部集中在 useSudokuGame，元件只負責呈現。
 */
export default function App() {
  const {
    mode,
    difficulty,
    board,
    givens,
    selected,
    conflicts,
    status,
    elapsed,
    remaining,
    canInput,
    winDismissed,
    lastPlaced,
    selectCell,
    clearSelection,
    moveSelection,
    inputNumber,
    erase,
    restart,
    newGame,
    startDaily,
    changeDifficulty,
    dismissWin,
  } = useSudokuGame()

  const isWinDialogOpen = status === 'won' && !winDismissed
  const dateLabel = formatDisplayDate(new Date())

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.isComposing) return

      // 在表單元件上打字時不要攔截（select 的方向鍵、數字鍵都要留給它）
      const target = event.target
      if (target instanceof HTMLElement) {
        const tagName = target.tagName
        if (
          tagName === 'SELECT' ||
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return
        }
      }

      if (isWinDialogOpen) {
        if (event.key === 'Escape') {
          event.preventDefault()
          dismissWin()
        }
        return
      }

      const { key } = event

      if (DIGIT_PATTERN.test(key)) {
        event.preventDefault()
        inputNumber(Number(key))
        return
      }
      if (key === '0' || key === 'Backspace' || key === 'Delete') {
        event.preventDefault()
        erase()
        return
      }
      if (key === 'ArrowUp') {
        event.preventDefault()
        moveSelection(-1, 0)
        return
      }
      if (key === 'ArrowDown') {
        event.preventDefault()
        moveSelection(1, 0)
        return
      }
      if (key === 'ArrowLeft') {
        event.preventDefault()
        moveSelection(0, -1)
        return
      }
      if (key === 'ArrowRight') {
        event.preventDefault()
        moveSelection(0, 1)
        return
      }
      if (key === 'Escape') {
        clearSelection()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isWinDialogOpen, dismissWin, inputNumber, erase, moveSelection, clearSelection])

  return (
    <div className="flex min-h-app w-full justify-center overflow-x-hidden bg-slate-100 px-2 pb-safe pt-safe sm:px-4">
      <div className="my-auto flex w-full max-w-[520px] flex-col gap-3 sm:gap-4">
        <Header
          dateLabel={dateLabel}
          mode={mode}
          difficulty={difficulty}
          elapsed={elapsed}
          onDifficultyChange={changeDifficulty}
          onNewGame={newGame}
          onStartDaily={startDaily}
        />

        <main className="flex flex-col gap-3 sm:gap-4">
          <Board
            board={board}
            givens={givens}
            selected={selected}
            conflicts={conflicts}
            lastPlaced={lastPlaced}
            onSelect={selectCell}
          />

          <NumberPad
            onInput={inputNumber}
            onErase={erase}
            disabled={!canInput}
            remaining={remaining}
          />
        </main>

        <p className="hidden pb-1 text-center text-[11px] leading-relaxed text-slate-400 sm:block">
          鍵盤：1–9 填入 · 方向鍵移動 · Backspace／Delete 清除 · Esc 取消選取
        </p>

        <p role="status" aria-live="polite" className="sr-only">
          {status === 'won' ? `恭喜完成，完成時間 ${formatDuration(elapsed)}。` : ''}
        </p>
      </div>

      <WinDialog
        open={isWinDialogOpen}
        mode={mode}
        difficulty={difficulty}
        elapsed={elapsed}
        onReplay={restart}
        onNewGame={newGame}
        onClose={dismissWin}
      />
    </div>
  )
}
