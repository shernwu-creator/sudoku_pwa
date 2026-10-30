import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DIFFICULTY_ORDER,
  EMPTY,
  generatePuzzle,
  getConflicts,
  isComplete,
} from '../utils/sudokuLogic.js'
import { dailySeed, getTodayKey } from '../utils/date.js'

/**
 * 遊戲狀態機：出題、計時、輸入、勝負、localStorage 自動存檔／還原。
 *
 * 存檔格式（單一 key，內含兩個模式各自的進度）：
 *   sudoku:v1:game = {
 *     version: 3,
 *     activeMode: 'daily' | 'random',
 *     difficulty: 1 | 2 | 3,
 *     slots: { daily: record | null, random: record | null },
 *   }
 *
 * 為什麼分兩個 slot：
 * - 「每日挑戰」與「新遊戲」互相切換時，不會把另一邊的進度洗掉。
 * - 每日挑戰的 record 帶 dateKey；跨日後自動失效並換成當天題目。
 */

const STORAGE_KEY = 'sudoku:v1:game'
// v2：每日挑戰改為「日期 + 難度」各自產生不同終盤。
// v3：改用 generatePuzzle() 保證每題唯一解；舊存檔（可能含多解題目）直接失效重開。
const STORAGE_VERSION = 3
const DEFAULT_DIFFICULTY = 1
const BOARD_SIZE = 9
const MODES = ['daily', 'random']

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isDifficulty = (value) => DIFFICULTY_ORDER.includes(value)

const isBoardOfIntegers = (value) =>
  Array.isArray(value) &&
  value.length === BOARD_SIZE &&
  value.every(
    (row) =>
      Array.isArray(row) &&
      row.length === BOARD_SIZE &&
      row.every((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 9),
  )

const isFullSolution = (value) =>
  Array.isArray(value) &&
  value.length === BOARD_SIZE &&
  value.every(
    (row) =>
      Array.isArray(row) &&
      row.length === BOARD_SIZE &&
      row.every((cell) => Number.isInteger(cell) && cell >= 1 && cell <= 9),
  )

const cloneBoard = (board) => board.map((row) => row.slice())

function createRandomSeed() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `game-${crypto.randomUUID()}`
    }
  } catch {
    // 忽略：舊瀏覽器沒有 crypto.randomUUID
  }
  return `game-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function readStore() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!isPlainObject(parsed) || parsed.version !== STORAGE_VERSION) return null
    return parsed
  } catch {
    // JSON 壞掉、私密模式停用 storage：一律當作沒有存檔
    return null
  }
}

/**
 * 把存檔記錄還原成遊戲狀態；任何一項驗證失敗就回 null（安全重置）。
 * @param {unknown} record
 * @param {string} todayKey
 * @returns {object | null}
 */
function restoreRecord(record, todayKey) {
  if (!isPlainObject(record)) return null

  const { mode, difficulty, seed, dateKey, solution, puzzle, board } = record
  if (!MODES.includes(mode)) return null
  if (!isDifficulty(difficulty)) return null
  if (typeof seed !== 'string' || seed.length === 0) return null
  if (mode === 'daily' && dateKey !== todayKey) return null
  if (!isFullSolution(solution) || !isBoardOfIntegers(puzzle) || !isBoardOfIntegers(board)) {
    return null
  }

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      // 題目保留格必須與解答一致，玩家盤面也必須保留題目數字
      if (puzzle[row][col] !== EMPTY && puzzle[row][col] !== solution[row][col]) return null
      if (puzzle[row][col] !== EMPTY && board[row][col] !== puzzle[row][col]) return null
    }
  }

  const elapsed =
    typeof record.elapsed === 'number' && Number.isFinite(record.elapsed) && record.elapsed >= 0
      ? Math.floor(record.elapsed)
      : 0
  // 狀態一律由盤面重新推導，避免存檔瞬間的競態留下錯誤的 status
  const status = isComplete(board) ? 'won' : 'playing'

  return {
    mode,
    difficulty,
    seed,
    dateKey: mode === 'daily' ? dateKey : null,
    solution,
    puzzle,
    board,
    elapsed,
    status,
    winDismissed: status === 'won' ? Boolean(record.winDismissed) : false,
  }
}

function toRecord(game) {
  return {
    mode: game.mode,
    difficulty: game.difficulty,
    seed: game.seed,
    dateKey: game.dateKey,
    solution: game.solution,
    puzzle: game.puzzle,
    board: game.board,
    elapsed: game.elapsed,
    status: game.status,
    winDismissed: game.winDismissed,
  }
}

function persistGame(game) {
  if (typeof window === 'undefined') return
  try {
    const existing = readStore()
    const slots = isPlainObject(existing?.slots) ? { ...existing.slots } : {}
    slots[game.mode] = toRecord(game)
    const next = {
      version: STORAGE_VERSION,
      activeMode: game.mode,
      difficulty: game.difficulty,
      slots,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 容量不足或被瀏覽器封鎖時，遊戲仍可繼續，只是不存檔
  }
}

function generateGame({ mode, difficulty, seed, dateKey = null }) {
  // generatePuzzle 會把難度混入 seed，並反覆重試直到題目保證唯一解：
  // 同一天的三個難度各自是不同終盤與不同題目，且同一天、同一難度
  // 在任何裝置仍會得到完全相同的題目。
  const { solution, puzzle } = generatePuzzle(seed, difficulty)
  return {
    mode,
    difficulty,
    seed,
    dateKey: mode === 'daily' ? dateKey : null,
    solution,
    puzzle,
    board: cloneBoard(puzzle),
    elapsed: 0,
    status: 'playing',
    winDismissed: false,
  }
}

function buildDailyGame(difficulty, todayKey = getTodayKey()) {
  return generateGame({ mode: 'daily', difficulty, seed: dailySeed(todayKey), dateKey: todayKey })
}

function buildRandomGame(difficulty) {
  return generateGame({ mode: 'random', difficulty, seed: createRandomSeed() })
}

/**
 * 初次載入策略（直覺優先）：
 * 1. 有上次進行中的存檔 → 還原（每日挑戰要驗證是「今天的」題目）。
 * 2. 沒有存檔／存檔壞掉／每日挑戰已跨日 → 直接開今天的每日挑戰。
 * 3. 難度沿用上次選擇（沒有就用簡單）。
 */
function createInitialGame() {
  const todayKey = getTodayKey()
  const store = readStore()
  const preferredDifficulty = isDifficulty(store?.difficulty) ? store.difficulty : DEFAULT_DIFFICULTY

  if (store) {
    const activeMode = MODES.includes(store.activeMode) ? store.activeMode : 'daily'
    const restored = restoreRecord(store.slots?.[activeMode], todayKey)
    if (restored) return restored
  }

  return buildDailyGame(preferredDifficulty, todayKey)
}

export function useSudokuGame() {
  const [game, setGame] = useState(createInitialGame)
  const [selected, setSelected] = useState(null)
  const [lastPlaced, setLastPlaced] = useState(null)

  // 事件處理器需要讀「目前最新」的狀態，但不想每幀重建 callback
  const gameRef = useRef(game)
  gameRef.current = game
  const selectedRef = useRef(selected)
  selectedRef.current = selected

  // 計時基準：base.elapsed 是起算秒數，base.at 是起算時間點
  const baseRef = useRef({ elapsed: game.elapsed, at: Date.now() })
  const popTokenRef = useRef(0)

  // 自動存檔（每次狀態變更；含每秒計時）
  useEffect(() => {
    persistGame(game)
  }, [game])

  // 計時器：用時間戳換算，分頁被瀏覽器節流時也不會少算
  useEffect(() => {
    if (game.status !== 'playing') return undefined
    const intervalId = window.setInterval(() => {
      const base = baseRef.current
      const elapsed = base.elapsed + Math.floor((Date.now() - base.at) / 1000)
      setGame((previous) =>
        previous.status !== 'playing' || previous.elapsed === elapsed
          ? previous
          : { ...previous, elapsed },
      )
    }, 500)
    return () => window.clearInterval(intervalId)
  }, [game.status])

  const conflicts = useMemo(() => getConflicts(game.board), [game.board])

  const givens = useMemo(
    () => game.puzzle.map((row) => row.map((value) => value !== EMPTY)),
    [game.puzzle],
  )

  const remaining = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 }
    for (const row of game.board) {
      for (const value of row) {
        if (value !== EMPTY) counts[value] += 1
      }
    }
    const result = {}
    for (let number = 1; number <= 9; number += 1) {
      result[number] = Math.max(0, 9 - counts[number])
    }
    return result
  }, [game.board])

  const selectedGiven = selected ? givens[selected.row][selected.col] : false
  const canInput = Boolean(selected) && !selectedGiven && game.status === 'playing'

  const getLiveElapsed = useCallback(() => {
    const base = baseRef.current
    return base.elapsed + Math.floor((Date.now() - base.at) / 1000)
  }, [])

  /** 換一局（也會重置計時基準與選取） */
  const startGame = useCallback((nextGame) => {
    baseRef.current = { elapsed: nextGame.elapsed, at: Date.now() }
    setGame(nextGame)
    setSelected(null)
    setLastPlaced(null)
  }, [])

  // 每日挑戰跨日自動換題：回到前景、視窗重新聚焦或每分鐘檢查一次本地日期。
  // 只在使用者正處於「每日挑戰」時觸發；自由練習與其他模式不受影響。
  useEffect(() => {
    const checkDayRollover = () => {
      const current = gameRef.current
      if (current.mode !== 'daily' || current.dateKey === getTodayKey()) return
      startGame(buildDailyGame(current.difficulty, getTodayKey()))
    }
    const handleVisibility = () => {
      if (!document.hidden) checkDayRollover()
    }
    const intervalId = window.setInterval(checkDayRollover, 60_000)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', checkDayRollover)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', checkDayRollover)
    }
  }, [startGame])

  // 點同一格不會取消選取（避免手殘多點一下就把選取弄掉）；取消選取交給 Esc
  const selectCell = useCallback((row, col) => {
    setSelected((previous) =>
      previous && previous.row === row && previous.col === col ? previous : { row, col },
    )
  }, [])

  const clearSelection = useCallback(() => {
    setSelected(null)
  }, [])

  /** 方向鍵移動；尚未選取時先選第一個可輸入的空格 */
  const moveSelection = useCallback((deltaRow, deltaCol) => {
    setSelected((previous) => {
      if (!previous) {
        const current = gameRef.current
        for (let row = 0; row < BOARD_SIZE; row += 1) {
          for (let col = 0; col < BOARD_SIZE; col += 1) {
            if (current.puzzle[row][col] === EMPTY) return { row, col }
          }
        }
        return { row: 0, col: 0 }
      }
      const row = Math.min(BOARD_SIZE - 1, Math.max(0, previous.row + deltaRow))
      const col = Math.min(BOARD_SIZE - 1, Math.max(0, previous.col + deltaCol))
      if (row === previous.row && col === previous.col) return previous
      return { row, col }
    })
  }, [])

  const inputNumber = useCallback(
    (number) => {
      const current = gameRef.current
      const currentSelection = selectedRef.current
      if (!currentSelection || current.status !== 'playing') return
      if (!Number.isInteger(number) || number < 1 || number > 9) return

      const { row, col } = currentSelection
      if (current.puzzle[row][col] !== EMPTY) return
      if (current.board[row][col] === number) return

      const board = cloneBoard(current.board)
      board[row][col] = number
      const complete = isComplete(board)

      setGame({
        ...current,
        board,
        elapsed: getLiveElapsed(),
        status: complete ? 'won' : 'playing',
        winDismissed: false,
      })
      popTokenRef.current += 1
      setLastPlaced({ row, col, token: popTokenRef.current })
    },
    [getLiveElapsed],
  )

  const erase = useCallback(() => {
    const current = gameRef.current
    const currentSelection = selectedRef.current
    if (!currentSelection || current.status !== 'playing') return

    const { row, col } = currentSelection
    if (current.puzzle[row][col] !== EMPTY || current.board[row][col] === EMPTY) return

    const board = cloneBoard(current.board)
    board[row][col] = EMPTY
    setGame({ ...current, board, elapsed: getLiveElapsed() })
    setLastPlaced(null)
  }, [getLiveElapsed])

  /** 重玩同一題（保留每日挑戰的日期與 seed） */
  const restart = useCallback(() => {
    const current = gameRef.current
    startGame({
      ...current,
      board: cloneBoard(current.puzzle),
      elapsed: 0,
      status: 'playing',
      winDismissed: false,
    })
  }, [startGame])

  /** 隨機新局（保留目前難度） */
  const newGame = useCallback(() => {
    startGame(buildRandomGame(gameRef.current.difficulty))
  }, [startGame])

  /** 切到今天（或還原今天已存在的）每日挑戰 */
  const startDaily = useCallback(() => {
    const current = gameRef.current
    const todayKey = getTodayKey()

    if (current.mode === 'daily' && current.dateKey === todayKey) {
      // 已經在今天的每日挑戰上：保留進度；若已完成則重玩今天這一題
      if (current.status === 'won') restart()
      return
    }

    const store = readStore()
    const restored = restoreRecord(store?.slots?.daily, todayKey)
    if (restored) {
      // 今天的每日挑戰已完成 → 點按鈕直接重玩，不要停在已完成的盤面
      startGame(
        restored.status === 'won'
          ? {
              ...restored,
              board: cloneBoard(restored.puzzle),
              elapsed: 0,
              status: 'playing',
              winDismissed: false,
            }
          : restored,
      )
      return
    }
    startGame(buildDailyGame(current.difficulty, todayKey))
  }, [restart, startGame])

  const changeDifficulty = useCallback(
    (nextDifficulty) => {
      if (!isDifficulty(nextDifficulty)) return
      const current = gameRef.current
      if (current.difficulty === nextDifficulty) return

      // 每日挑戰：同一天、同難度固定題目；換難度等於換一題今天的題目
      if (current.mode === 'daily') {
        startGame(buildDailyGame(nextDifficulty, getTodayKey()))
      } else {
        startGame(buildRandomGame(nextDifficulty))
      }
    },
    [startGame],
  )

  const dismissWin = useCallback(() => {
    const current = gameRef.current
    if (current.status !== 'won' || current.winDismissed) return
    setGame({ ...current, winDismissed: true })
  }, [])

  return {
    // 狀態
    mode: game.mode,
    difficulty: game.difficulty,
    dateKey: game.dateKey,
    seed: game.seed,
    solution: game.solution,
    puzzle: game.puzzle,
    board: game.board,
    givens,
    selected,
    conflicts,
    status: game.status,
    elapsed: game.elapsed,
    remaining,
    canInput,
    winDismissed: game.winDismissed,
    lastPlaced,
    // 操作
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
  }
}
