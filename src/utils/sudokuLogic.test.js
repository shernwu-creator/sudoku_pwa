import { describe, expect, it } from 'vitest'
import {
  DIFFICULTY,
  DIFFICULTY_ORDER,
  EMPTY,
  checkValidity,
  countSolutions,
  createPuzzle,
  generatePuzzle,
  generateSudoku,
  getConflicts,
  isComplete,
} from './sudokuLogic.js'

/* ------------------------------ helpers ------------------------------ */

const SIZE = 9

/** @param {number[][]} board */
function clone(board) {
  return board.map((row) => row.slice())
}

/** @param {number[][]} board */
function countNonZero(board) {
  let n = 0
  for (const row of board) for (const cell of row) if (cell !== EMPTY) n += 1
  return n
}

const SORTED_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/**
 * 驗證完整盤面：每列／欄／宮都是 1..9 的排列。
 * @param {number[][]} board
 */
function expectValidSolution(board) {
  expect(board).toHaveLength(SIZE)
  for (const row of board) expect(row).toHaveLength(SIZE)

  for (let r = 0; r < SIZE; r += 1) {
    expect([...board[r]].sort((a, b) => a - b)).toEqual(SORTED_DIGITS)
  }
  for (let c = 0; c < SIZE; c += 1) {
    const column = []
    for (let r = 0; r < SIZE; r += 1) column.push(board[r][c])
    expect(column.sort((a, b) => a - b)).toEqual(SORTED_DIGITS)
  }
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxCol = 0; boxCol < 3; boxCol += 1) {
      const box = []
      for (let r = boxRow * 3; r < boxRow * 3 + 3; r += 1) {
        for (let c = boxCol * 3; c < boxCol * 3 + 3; c += 1) box.push(board[r][c])
      }
      expect(box.sort((a, b) => a - b)).toEqual(SORTED_DIGITS)
    }
  }
}

const SEED_A = 'daily-2026-10-30'
const SEED_B = 'daily-2026-10-31'

/* ------------------------------ constants ----------------------------- */

describe('常數契約', () => {
  it('EMPTY 為 0', () => {
    expect(EMPTY).toBe(0)
  })

  it('DIFFICULTY 三難度含正確 id/key/label/labelZh/clues', () => {
    expect(DIFFICULTY_ORDER).toEqual([1, 2, 3])
    expect(DIFFICULTY[1]).toMatchObject({
      id: 1,
      key: 'easy',
      label: 'Easy',
      labelZh: '簡單',
      clues: 40,
    })
    expect(DIFFICULTY[2]).toMatchObject({
      id: 2,
      key: 'medium',
      label: 'Medium',
      labelZh: '中等',
      clues: 30,
    })
    expect(DIFFICULTY[3]).toMatchObject({
      id: 3,
      key: 'hard',
      label: 'Hard',
      labelZh: '困難',
      clues: 25,
    })
  })
})

/* ----------------------------- generateSudoku ------------------------- */

describe('generateSudoku', () => {
  it('相同 seed 兩次結果 deepEqual；每次都是新陣列', () => {
    const first = generateSudoku(SEED_A)
    const second = generateSudoku(SEED_A)

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first[0]).not.toBe(second[0])
    expect(first[4]).not.toBe(second[4])

    // 修改第二次結果不影響第三次（無共用的可變狀態）
    second[0][0] = second[0][0] === 1 ? 2 : 1
    expect(generateSudoku(SEED_A)).toEqual(first)
  })

  it('不同 seed 得到不同盤面', () => {
    const a = generateSudoku(SEED_A)
    const b = generateSudoku(SEED_B)
    expect(a).not.toEqual(b)
  })

  it('產生的盤面合法：每列／欄／宮都是 1..9 的排列', () => {
    for (const seed of [SEED_A, SEED_B, 'random-seed-42', 'x']) {
      expectValidSolution(generateSudoku(seed))
    }
  })

  it('未傳 seed 也能產生合法完整盤面', () => {
    const board = generateSudoku()
    expectValidSolution(board)
    expect(countNonZero(board)).toBe(81)
  })

  it('接受數字 seed 且具決定性', () => {
    expect(generateSudoku(12345)).toEqual(generateSudoku(12345))
  })
})

/* ------------------------------ createPuzzle ------------------------- */

describe('createPuzzle', () => {
  const solution = generateSudoku(SEED_A)
  const frozenSolution = clone(solution)

  it('三難度提示數精確為 40 / 30 / 25', () => {
    for (const difficulty of DIFFICULTY_ORDER) {
      const puzzle = createPuzzle(solution, difficulty, SEED_A)
      expect(countNonZero(puzzle)).toBe(DIFFICULTY[difficulty].clues)
    }
  })

  it('所有非 0 格與解答相同，且回傳新盤面、不 mutate 輸入', () => {
    for (const difficulty of DIFFICULTY_ORDER) {
      const puzzle = createPuzzle(solution, difficulty, SEED_A)
      expect(puzzle).not.toBe(solution)
      expect(puzzle[0]).not.toBe(solution[0])

      for (let r = 0; r < SIZE; r += 1) {
        for (let c = 0; c < SIZE; c += 1) {
          if (puzzle[r][c] !== EMPTY) expect(puzzle[r][c]).toBe(solution[r][c])
        }
      }
    }
    // 輸入完全未被修改
    expect(solution).toEqual(frozenSolution)
  })

  it('相同 seed + 相同 difficulty 結果 deepEqual', () => {
    for (const difficulty of DIFFICULTY_ORDER) {
      expect(createPuzzle(solution, difficulty, SEED_A)).toEqual(
        createPuzzle(solution, difficulty, SEED_A),
      )
    }
  })

  it('不同 difficulty 提示數不同（40 / 30 / 25）', () => {
    const easy = createPuzzle(solution, 1, SEED_A)
    const medium = createPuzzle(solution, 2, SEED_A)
    const hard = createPuzzle(solution, 3, SEED_A)
    expect(countNonZero(easy)).toBe(40)
    expect(countNonZero(medium)).toBe(30)
    expect(countNonZero(hard)).toBe(25)
    expect(easy).not.toEqual(medium)
    expect(medium).not.toEqual(hard)
  })

  it('不同 seed 產生不同題目（同難度）', () => {
    const other = generateSudoku(SEED_B)
    expect(createPuzzle(solution, 2, SEED_A)).not.toEqual(createPuzzle(other, 2, SEED_B))
  })

  it('未傳 seed 時仍精確命中題數且合法', () => {
    const puzzle = createPuzzle(solution, 3)
    expect(countNonZero(puzzle)).toBe(25)
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (puzzle[r][c] !== EMPTY) expect(puzzle[r][c]).toBe(solution[r][c])
      }
    }
  })

  it('difficulty 非法時丟 RangeError', () => {
    for (const bad of [0, 4, -1, 1.5, '1', null, undefined, NaN]) {
      expect(() => createPuzzle(solution, bad, SEED_A)).toThrow(RangeError)
    }
  })

  it('board 格式非法時丟 TypeError（防禦性）', () => {
    expect(() => createPuzzle([[1, 2, 3]], 1, SEED_A)).toThrow(TypeError)
    expect(() => createPuzzle(null, 1, SEED_A)).toThrow(TypeError)
  })
})

/* ------------------------------ checkValidity ------------------------ */

describe('checkValidity', () => {
  const solution = generateSudoku(SEED_A)

  it('合法落子回傳 true', () => {
    // 從解答挖出一個空格，再放回正確數字
    const board = clone(solution)
    const [r, c] = [0, 0]
    board[r][c] = EMPTY
    expect(checkValidity(board, r, c, solution[r][c])).toBe(true)
  })

  it('同列已有相同數字 → false', () => {
    const board = clone(solution)
    board[0][0] = EMPTY
    expect(checkValidity(board, 0, 0, board[0][8])).toBe(false)
  })

  it('同欄已有相同數字 → false', () => {
    const board = clone(solution)
    board[0][0] = EMPTY
    expect(checkValidity(board, 0, 0, board[8][0])).toBe(false)
  })

  it('同 3×3 宮已有相同數字 → false', () => {
    const board = clone(solution)
    board[0][0] = EMPTY
    expect(checkValidity(board, 0, 0, board[1][1])).toBe(false)
  })

  it('同一格重新輸入自身數字 → true（忽略自己目前的值）', () => {
    const board = clone(solution)
    expect(board[2][3]).toBeGreaterThan(0)
    expect(checkValidity(board, 2, 3, board[2][3])).toBe(true)
  })

  it('空格棋盤上任何合法數字皆 true', () => {
    const board = Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY))
    expect(checkValidity(board, 4, 4, 7)).toBe(true)
  })

  it('非法座標或數字 → false', () => {
    const board = clone(solution)
    expect(checkValidity(board, -1, 0, 1)).toBe(false)
    expect(checkValidity(board, 9, 0, 1)).toBe(false)
    expect(checkValidity(board, 0, -1, 1)).toBe(false)
    expect(checkValidity(board, 0, 9, 1)).toBe(false)
    expect(checkValidity(board, 1.5, 0, 1)).toBe(false)
    expect(checkValidity(board, 0, 0, 0)).toBe(false)
    expect(checkValidity(board, 0, 0, 10)).toBe(false)
    expect(checkValidity(board, 0, 0, 3.5)).toBe(false)
    expect(checkValidity(board, 0, 0, '5')).toBe(false)
    expect(checkValidity(board, null, 0, 1)).toBe(false)
  })

  it('board 格式不對時安全回傳 false，不拋錯', () => {
    expect(checkValidity(null, 0, 0, 1)).toBe(false)
    expect(checkValidity([], 0, 0, 1)).toBe(false)
    expect(checkValidity([[1, 2, 3]], 0, 0, 1)).toBe(false)
    expect(checkValidity('not a board', 0, 0, 1)).toBe(false)
  })
})

/* ------------------------------- getConflicts ------------------------ */

describe('getConflicts', () => {
  it('無衝突時回傳空 Set', () => {
    const board = generateSudoku(SEED_A)
    expect(getConflicts(board).size).toBe(0)

    const empty = Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY))
    expect(getConflicts(empty).size).toBe(0)
  })

  it('同列重複 → 雙方都被標示', () => {
    const board = Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY))
    board[0][0] = 5
    board[0][6] = 5
    const conflicts = getConflicts(board)
    expect(conflicts.has('0,0')).toBe(true)
    expect(conflicts.has('0,6')).toBe(true)
    expect(conflicts.size).toBe(2)
  })

  it('同欄重複 → 雙方都被標示', () => {
    const board = Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY))
    board[1][2] = 7
    board[7][2] = 7
    const conflicts = getConflicts(board)
    expect(conflicts.has('1,2')).toBe(true)
    expect(conflicts.has('7,2')).toBe(true)
    expect(conflicts.size).toBe(2)
  })

  it('同 3×3 宮重複（不同列也不同欄）→ 雙方都被標示', () => {
    const board = Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY))
    board[3][3] = 9 // 宮 (1,1)
    board[4][5] = 9 // 宮 (1,1)，但不同列也不同欄
    const conflicts = getConflicts(board)
    expect(conflicts.has('3,3')).toBe(true)
    expect(conflicts.has('4,5')).toBe(true)
    expect(conflicts.size).toBe(2)
  })

  it('多個重複（三個同數字）→ 全部標示', () => {
    const board = Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY))
    board[0][0] = 3
    board[0][3] = 3
    board[0][7] = 3
    const conflicts = getConflicts(board)
    expect([...conflicts].sort()).toEqual(['0,0', '0,3', '0,7'])
  })

  it('忽略 0（空格）', () => {
    const board = Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY))
    expect(getConflicts(board).size).toBe(0)
  })

  it('board 格式不對時回傳空 Set，不拋錯', () => {
    expect(getConflicts(null).size).toBe(0)
    expect(getConflicts([[]]).size).toBe(0)
  })
})

/* -------------------------------- isComplete ------------------------- */

describe('isComplete', () => {
  it('合法滿盤 → true', () => {
    expect(isComplete(generateSudoku(SEED_A))).toBe(true)
  })

  it('有空格 → false', () => {
    const board = clone(generateSudoku(SEED_A))
    board[3][4] = EMPTY
    expect(isComplete(board)).toBe(false)
  })

  it('81 格填滿但有衝突 → false', () => {
    const board = clone(generateSudoku(SEED_A))
    board[0][1] = board[0][0] // 同列與同宮重複
    expect(countNonZero(board)).toBe(81)
    expect(isComplete(board)).toBe(false)
  })

  it('格式不對 → false', () => {
    expect(isComplete(null)).toBe(false)
    expect(isComplete([])).toBe(false)
  })
})

/* ----------------------------- countSolutions ------------------------ */

describe('countSolutions', () => {
  it('完整合法盤面 → 1 個解', () => {
    expect(isComplete(generateSudoku('count-full'))).toBe(true)
    expect(countSolutions(generateSudoku('count-full'), 2)).toBe(1)
  })

  it('空盤面 → 至少 2 個解（limit 2）', () => {
    const empty = Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY))
    expect(countSolutions(empty, 2)).toBe(2)
  })

  it('題目若多解 → 回傳 2（達 limit）', () => {
    // 只留少量提示，幾乎一定多解。
    const puzzle = generateSudoku('count-multi').map((row, r) =>
      row.map((value, c) => ((r * 9 + c) % 7 === 0 ? value : EMPTY)),
    )
    expect(countSolutions(puzzle, 2)).toBe(2)
  })

  it('格式不對 → 0，不拋錯', () => {
    expect(countSolutions(null, 2)).toBe(0)
    expect(countSolutions([[]], 2)).toBe(0)
  })
})

/* ------------------------------ generatePuzzle ----------------------- */

describe('generatePuzzle（保證唯一解）', () => {
  const seeds = [
    'daily-2026-10-30',
    'daily-2026-10-31',
    'unique-seed-a',
    'unique-seed-b',
    'unique-seed-c',
    'unique-seed-d',
  ]

  it('三難度都精確提示數、唯一解、題目與解答一致', () => {
    for (const difficulty of DIFFICULTY_ORDER) {
      for (const seed of seeds) {
        const { solution, puzzle, unique, attempts } = generatePuzzle(seed, difficulty)
        expect(unique).toBe(true)
        expect(attempts).toBeGreaterThanOrEqual(1)
        expect(countNonZero(puzzle)).toBe(DIFFICULTY[difficulty].clues)
        expectValidSolution(solution)
        expect(isComplete(solution)).toBe(true)
        expect(countSolutions(puzzle, 2)).toBe(1)

        let givensMatch = true
        for (let r = 0; r < SIZE; r += 1) {
          for (let c = 0; c < SIZE; c += 1) {
            if (puzzle[r][c] !== EMPTY && puzzle[r][c] !== solution[r][c]) givensMatch = false
          }
        }
        expect(givensMatch).toBe(true)
      }
    }
  })

  it('相同 seed + 難度可重現（每日挑戰跨裝置一致）', () => {
    const first = generatePuzzle('daily-2026-10-30', 3)
    const second = generatePuzzle('daily-2026-10-30', 3)
    expect(first.puzzle).toEqual(second.puzzle)
    expect(first.solution).toEqual(second.solution)
    expect(first.seed).toBe(second.seed)
  })

  it('不同難度得到不同終盤與不同題目', () => {
    const easy = generatePuzzle('daily-2026-10-30', 1)
    const medium = generatePuzzle('daily-2026-10-30', 2)
    const hard = generatePuzzle('daily-2026-10-30', 3)
    const solutions = [easy, medium, hard].map(({ solution }) => solution.flat().join(''))
    const puzzles = [easy, medium, hard].map(({ puzzle }) => puzzle.flat().join(''))
    expect(new Set(solutions).size).toBe(3)
    expect(new Set(puzzles).size).toBe(3)
  })

  it('舊版曾挖出多解的 seed 會自動重試成唯一解', () => {
    // 這些 seed 在舊 createPuzzle（盲挖補足版）下會產生多解。
    const regressionSeeds = ['test-seed-9', 'test-seed-12', 'test-seed-27', 'test-seed-29', 'test-seed-33']
    for (const seed of regressionSeeds) {
      const { puzzle, unique } = generatePuzzle(seed, 3)
      expect(unique).toBe(true)
      expect(countSolutions(puzzle, 2)).toBe(1)
    }
  })

  it('30 組 hard seed 全部唯一解（回歸抽樣）', () => {
    for (let i = 0; i < 30; i += 1) {
      const { puzzle, unique } = generatePuzzle(`hard-regression-${i}`, 3)
      expect(unique).toBe(true)
      expect(countSolutions(puzzle, 2)).toBe(1)
    }
  })

  it('maxAttempts=1 時仍回傳可玩的保底題目（極端案例）', () => {
    const fallback = generatePuzzle('test-seed-9', 3, { maxAttempts: 1 })
    expect(fallback.unique).toBe(false)
    expect(countNonZero(fallback.puzzle)).toBe(DIFFICULTY[3].clues)
    expect(countSolutions(fallback.puzzle, 2)).toBeGreaterThanOrEqual(2)
    expect(isComplete(fallback.solution)).toBe(true)
  })

  it('非法難度丟 RangeError', () => {
    expect(() => generatePuzzle('x', 4)).toThrow(RangeError)
    expect(() => generatePuzzle('x', 0)).toThrow(RangeError)
    expect(() => generatePuzzle('x', '1')).toThrow(RangeError)
  })
})

/* --------------------------------- 效能 ------------------------------ */

describe('效能', () => {
  it('generateSudoku + 三難度 createPuzzle 總時間 < 3000ms', () => {
    const start = performance.now()

    const solution = generateSudoku('perf-seed')
    for (const difficulty of DIFFICULTY_ORDER) {
      createPuzzle(solution, difficulty, 'perf-seed')
    }

    const elapsed = performance.now() - start
    // 詳細數據供 Lead 寫 README
    // eslint-disable-next-line no-console
    console.log(
      `[perf] generateSudoku + createPuzzle(1,2,3) 總耗時: ${elapsed.toFixed(1)}ms`,
    )
    expect(elapsed).toBeLessThan(3000)
  })

  it('generatePuzzle 三難度總時間 < 3000ms（含唯一解重試）', () => {
    const start = performance.now()

    for (let i = 0; i < 10; i += 1) {
      for (const difficulty of DIFFICULTY_ORDER) {
        generatePuzzle(`perf-generate-${i}`, difficulty)
      }
    }

    const elapsed = performance.now() - start
    // eslint-disable-next-line no-console
    console.log(`[perf] generatePuzzle(10 seeds × 3 難度) 總耗時: ${elapsed.toFixed(1)}ms`)
    expect(elapsed).toBeLessThan(3000)
  })
})
