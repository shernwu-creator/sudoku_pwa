/**
 * sudokuLogic.js — 數獨純邏輯模組（零 React / DOM / localStorage 依賴）。
 *
 * 棋盤一律為 `number[9][9]`，`0`（EMPTY）代表空格，合法數字為 `1..9`。
 * 所有函式皆為純函式：不修改傳入的棋盤，相同輸入（含 seed）必得到相同輸出。
 *
 * 演算法：
 * - 填盤：以 seedrandom 建立「每次呼叫專用」的 rng，逐格以 Fisher–Yates 洗牌後的
 *   候選數做 backtracking，填滿即為合法終盤。
 * - 挖洞：以衍生 seed（`${seed}:puzzle:${difficulty}`）洗牌格子順序，逐格嘗試挖除；
 *   先以「有限節點預算」的計數解求解器做唯一解檢查（低成本維持唯一解），
 *   若預算耗盡或無法再挖，再以盲挖補足，保證提示數「精確」等於難度設定。
 */
import seedrandom from 'seedrandom'

/** 空格 */
export const EMPTY = 0

/** 難度設定：key 為 1|2|3，clues 為保留（提示）數字數量 */
export const DIFFICULTY = Object.freeze({
  1: Object.freeze({ id: 1, key: 'easy', label: 'Easy', labelZh: '簡單', clues: 40 }),
  2: Object.freeze({ id: 2, key: 'medium', label: 'Medium', labelZh: '中等', clues: 30 }),
  3: Object.freeze({ id: 3, key: 'hard', label: 'Hard', labelZh: '困難', clues: 25 }),
})

/** 難度顯示順序 */
export const DIFFICULTY_ORDER = Object.freeze([1, 2, 3])

const SIZE = 9
const CELL_COUNT = 81
const ALL_DIGITS_MASK = 0b1111111110 // bit 1..9
const UNIQUENESS_NODE_BUDGET = 60000 // 整個 createPuzzle 呼叫共用，避免昂貴重試

/* ------------------------------------------------------------------ */
/* 基礎工具（模組內部，不 export）                                      */
/* ------------------------------------------------------------------ */

/** @returns {number[][]} 9×9 全 0 棋盤 */
function createEmptyGrid() {
  return Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY))
}

/**
 * @param {unknown} value
 * @returns {boolean} 是否為合法棋盤：9×9、每格為 0..9 整數
 */
function isBoardLike(value) {
  if (!Array.isArray(value) || value.length !== SIZE) return false
  for (let r = 0; r < SIZE; r += 1) {
    const row = value[r]
    if (!Array.isArray(row) || row.length !== SIZE) return false
    for (let c = 0; c < SIZE; c += 1) {
      const cell = row[c]
      if (!Number.isInteger(cell) || cell < EMPTY || cell > 9) return false
    }
  }
  return true
}

/**
 * @param {number} r 0..8
 * @param {number} c 0..8
 * @returns {number} 0..8 的宮索引
 */
function boxIndex(r, c) {
  return ((r / 3) | 0) * 3 + ((c / 3) | 0)
}

/**
 * 以 Fisher–Yates 就地洗牌（使用傳入的 rng，維持決定性）。
 * @template T
 * @param {T[]} items
 * @param {() => number} rng
 * @returns {T[]} 同一個陣列
 */
function shuffleInPlace(items, rng) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }
  return items
}

/**
 * 建立本次呼叫專用的 rng。有 seed 時用 seedrandom（不設 global），未給才用 Math.random。
 * @param {string|number|undefined|null} seed
 * @returns {() => number}
 */
function createRng(seed) {
  if (seed === undefined || seed === null) return Math.random
  return seedrandom(String(seed))
}

/** @param {number[][]} grid @returns {number[][]} 逐列複製 */
function cloneGrid(grid) {
  return grid.map((row) => row.slice())
}

/* ------------------------------------------------------------------ */
/* 填盤（backtracking + 洗牌）                                          */
/* ------------------------------------------------------------------ */

/**
 * 產生一個完整合法終盤。
 * @param {() => number} rng
 * @returns {number[][]}
 */
function fillCompleteGrid(rng) {
  const grid = createEmptyGrid()
  const rowMask = new Array(SIZE).fill(0)
  const colMask = new Array(SIZE).fill(0)
  const boxMask = new Array(SIZE).fill(0)
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9]

  const fill = (index) => {
    if (index === CELL_COUNT) return true
    const r = (index / SIZE) | 0
    const c = index % SIZE
    const box = boxIndex(r, c)
    const candidates = shuffleInPlace(digits.slice(), rng)

    for (let i = 0; i < candidates.length; i += 1) {
      const num = candidates[i]
      const bit = 1 << num
      if ((rowMask[r] | colMask[c] | boxMask[box]) & bit) continue

      grid[r][c] = num
      rowMask[r] |= bit
      colMask[c] |= bit
      boxMask[box] |= bit

      if (fill(index + 1)) return true

      grid[r][c] = EMPTY
      rowMask[r] &= ~bit
      colMask[c] &= ~bit
      boxMask[box] &= ~bit
    }
    return false
  }

  fill(0)
  return grid
}

/* ------------------------------------------------------------------ */
/* 計數解求解器（bitmask + MRV，限節點數）                                */
/* ------------------------------------------------------------------ */

/**
 * 計算棋盤的解數量（最多數到 limit）。
 * 以 row/col/box bitmask 與「最少候選格優先（MRV）」加速，
 * 並以共享節點預算避免在刁鑽盤面上失控（耗盡時回報 aborted）。
 *
 * @param {number[][]} grid 9×9（0 為空格），不會被修改
 * @param {number} limit 最多數幾個解（通常 2）
 * @param {{ remaining: number }} budget 共享節點預算
 * @returns {{ count: number, aborted: boolean }}
 */
function countSolutions(grid, limit, budget) {
  const rowMask = new Array(SIZE).fill(0)
  const colMask = new Array(SIZE).fill(0)
  const boxMask = new Array(SIZE).fill(0)
  const blanks = []

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const num = grid[r][c]
      if (num === EMPTY) {
        blanks.push(r * SIZE + c)
      } else {
        const bit = 1 << num
        rowMask[r] |= bit
        colMask[c] |= bit
        boxMask[boxIndex(r, c)] |= bit
      }
    }
  }

  let count = 0
  let aborted = false

  /**
   * @param {number} depth 已填的格子數（blanks[0..depth) 已處理）
   * @returns {boolean} 是否因預算耗盡而中止
   */
  const search = (depth) => {
    if (depth === blanks.length) {
      count += 1
      return false
    }
    if (budget.remaining <= 0) {
      aborted = true
      return true
    }
    budget.remaining -= 1

    // MRV：找出候選數最少的空格（限制在深度後方，以 swap 維持 O(1) 選取）
    let bestIndex = -1
    let bestMask = 0
    let bestCount = 10
    for (let i = depth; i < blanks.length; i += 1) {
      const pos = blanks[i]
      const r = (pos / SIZE) | 0
      const c = pos % SIZE
      const used = rowMask[r] | colMask[c] | boxMask[boxIndex(r, c)]
      const mask = ALL_DIGITS_MASK & ~used
      const candidateCount = popcount(mask)
      if (candidateCount < bestCount) {
        bestCount = candidateCount
        bestMask = mask
        bestIndex = i
        if (candidateCount === 0) break
      }
    }

    if (bestCount === 0) return false // 死路

    // 將選中的空格換到 depth 位置
    const tmp = blanks[depth]
    blanks[depth] = blanks[bestIndex]
    blanks[bestIndex] = tmp
    const pos = blanks[depth]
    const r = (pos / SIZE) | 0
    const c = pos % SIZE
    const box = boxIndex(r, c)

    for (let num = 1; num <= 9 && count < limit; num += 1) {
      const bit = 1 << num
      if (!(bestMask & bit)) continue

      rowMask[r] |= bit
      colMask[c] |= bit
      boxMask[box] |= bit

      const stopped = search(depth + 1)
      if (stopped) return true
      if (count >= limit) break

      rowMask[r] &= ~bit
      colMask[c] &= ~bit
      boxMask[box] &= ~bit
    }

    return false
  }

  if (blanks.length === 0) {
    // 已填滿：0 個空格視為 1 個（完整）解；有衝突則無解
    for (let r = 0; r < SIZE; r += 1) {
      if (rowMask[r] !== ALL_DIGITS_MASK) return { count: 0, aborted: false }
    }
    for (let c = 0; c < SIZE; c += 1) {
      if (colMask[c] !== ALL_DIGITS_MASK) return { count: 0, aborted: false }
    }
    for (let b = 0; b < SIZE; b += 1) {
      if (boxMask[b] !== ALL_DIGITS_MASK) return { count: 0, aborted: false }
    }
    return { count: 1, aborted: false }
  }

  search(0)
  return { count, aborted }
}

/** @param {number} mask @returns {number} 1 bits 數量 */
function popcount(mask) {
  let n = mask
  let total = 0
  while (n) {
    n &= n - 1
    total += 1
    if (total > 9) return total
  }
  return total
}

/* ------------------------------------------------------------------ */
/* 公開 API                                                           */
/* ------------------------------------------------------------------ */

/**
 * 產生一個完整、合法的 9×9 數獨終盤（1..9 填滿）。
 *
 * - 傳入相同 seed（字串或數字）→ 完全相同的盤面（決定性，適合每日挑戰）。
 * - 未傳 seed 才使用 Math.random。
 * - 每次呼叫都回傳全新陣列，不共用任何狀態。
 *
 * @param {string|number} [seed]
 * @returns {number[][]} 9×9，每格為 1..9
 */
export function generateSudoku(seed) {
  return fillCompleteGrid(createRng(seed))
}

/**
 * 從完整終盤挖洞產生題目。
 *
 * - 回傳新棋盤，不修改傳入的 board。
 * - 保留（非 0）數字數量精確等於 DIFFICULTY[difficulty].clues。
 * - 相同 seed + difficulty 結果完全相同（供每日挑戰跨裝置一致）。
 * - 唯一解為「盡力而為」：以有限節點預算檢查，預算內維持唯一解；
 *   為確保精確提示數與效能，必要時退化為盲挖（唯一解非硬性需求）。
 *
 * @param {number[][]} board 完整終盤（9×9，可含 0 代表已挖空）
 * @param {1|2|3} difficulty
 * @param {string|number} [seed]
 * @returns {number[][]} 9×9 題目，非 0 數量 == clues
 * @throws {RangeError} difficulty 非法
 * @throws {TypeError} board 格式非法
 */
export function createPuzzle(board, difficulty, seed) {
  if (!Number.isInteger(difficulty) || !DIFFICULTY[difficulty]) {
    throw new RangeError(`invalid difficulty: ${String(difficulty)} (expected 1, 2 or 3)`)
  }
  if (!isBoardLike(board)) {
    throw new TypeError('createPuzzle(board, ...) requires a 9x9 number grid')
  }

  const { clues } = DIFFICULTY[difficulty]
  const puzzle = cloneGrid(board)
  let givenCount = 0
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (puzzle[r][c] !== EMPTY) givenCount += 1
    }
  }
  // 正常情況（完整終盤）目標空格數 = 81 - clues；若傳入的盤面本來就不完整，
  // 則最多只能挖到剩下既有的數字，避免回傳不可能的題數。
  const targetBlanks = Math.min(Math.max(0, CELL_COUNT - clues), givenCount)
  // 衍生 seed：同 seed + difficulty 固定；不同難度得到不同挖洞順序
  const rng = createRng(seed === undefined || seed === null ? undefined : `${seed}:puzzle:${difficulty}`)
  const order = shuffleInPlace(
    Array.from({ length: CELL_COUNT }, (_, i) => i),
    rng,
  )
  const budget = { remaining: UNIQUENESS_NODE_BUDGET }

  let blanks = 0
  // 第一階段：逐格嘗試挖除，並在節點預算內要求唯一解
  for (let i = 0; i < order.length && blanks < targetBlanks; i += 1) {
    const pos = order[i]
    const r = (pos / SIZE) | 0
    const c = pos % SIZE
    const saved = puzzle[r][c]
    if (saved === EMPTY) continue

    puzzle[r][c] = EMPTY
    const { count, aborted } = countSolutions(puzzle, 2, budget)
    if (aborted || count === 1) {
      blanks += 1
    } else {
      puzzle[r][c] = saved // 挖除會產生多解 → 復原
    }
  }

  // 第二階段：若第一階段（唯一解限制太嚴）未達標，盲挖補足，保證精確提示數
  for (let i = 0; i < order.length && blanks < targetBlanks; i += 1) {
    const pos = order[i]
    const r = (pos / SIZE) | 0
    const c = pos % SIZE
    if (puzzle[r][c] === EMPTY) continue
    puzzle[r][c] = EMPTY
    blanks += 1
  }

  return puzzle
}

/**
 * 檢查 `num` 放入 `(row, col)` 是否不違反列／欄／3×3 宮規則。
 * 會忽略該格目前的值（同一格重新輸入相同數字不算衝突）。
 * 座標或數字非法時回傳 false。
 *
 * @param {number[][]} board
 * @param {number} row 0..8
 * @param {number} col 0..8
 * @param {number} num 1..9
 * @returns {boolean}
 */
export function checkValidity(board, row, col, num) {
  try {
    if (!isBoardLike(board)) return false
    if (!Number.isInteger(row) || row < 0 || row >= SIZE) return false
    if (!Number.isInteger(col) || col < 0 || col >= SIZE) return false
    if (!Number.isInteger(num) || num < 1 || num > 9) return false

    for (let i = 0; i < SIZE; i += 1) {
      if (i !== col && board[row][i] === num) return false
      if (i !== row && board[i][col] === num) return false
    }

    const boxRow = row - (row % 3)
    const boxCol = col - (col % 3)
    for (let r = boxRow; r < boxRow + 3; r += 1) {
      for (let c = boxCol; c < boxCol + 3; c += 1) {
        if (r === row && c === col) continue
        if (board[r][c] === num) return false
      }
    }

    return true
  } catch {
    return false
  }
}

/**
 * 找出所有「參與列／欄／3×3 宮重複」的格子座標。
 * key 格式為 `${row},${col}`，忽略 0（空格）。
 * 重複的雙方都會被標示。
 *
 * @param {number[][]} board
 * @returns {Set<string>}
 */
export function getConflicts(board) {
  const conflicts = new Set()
  try {
    if (!isBoardLike(board)) return conflicts

    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const num = board[r][c]
        if (num === EMPTY) continue

        for (let i = 0; i < SIZE; i += 1) {
          if (i !== c && board[r][i] === num) {
            conflicts.add(`${r},${c}`)
            conflicts.add(`${r},${i}`)
          }
          if (i !== r && board[i][c] === num) {
            conflicts.add(`${r},${c}`)
            conflicts.add(`${i},${c}`)
          }
        }

        const boxRow = r - (r % 3)
        const boxCol = c - (c % 3)
        for (let br = boxRow; br < boxRow + 3; br += 1) {
          for (let bc = boxCol; bc < boxCol + 3; bc += 1) {
            if (br === r && bc === c) continue
            if (board[br][bc] === num) {
              conflicts.add(`${r},${c}`)
              conflicts.add(`${br},${bc}`)
            }
          }
        }
      }
    }
  } catch {
    return conflicts
  }
  return conflicts
}

/**
 * 棋盤是否已完成：81 格皆為 1..9 且沒有任何衝突。
 *
 * @param {number[][]} board
 * @returns {boolean}
 */
export function isComplete(board) {
  try {
    if (!isBoardLike(board)) return false
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (board[r][c] < 1 || board[r][c] > 9) return false
      }
    }
    return getConflicts(board).size === 0
  } catch {
    return false
  }
}
