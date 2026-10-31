import { describe, expect, it } from 'vitest'
import {
  freezeElapsed,
  isPristineBoard,
  readElapsed,
  resumeElapsed,
  shouldAutoRollover,
} from './gameSession.js'

const SIZE = 9

function emptyBoard() {
  return Array.from({ length: SIZE }, () => new Array(SIZE).fill(0))
}

/** 一個固定的小題目：3 個提示、其餘空格 */
function makePuzzle() {
  const puzzle = emptyBoard()
  puzzle[0][0] = 5
  puzzle[1][4] = 8
  puzzle[8][8] = 2
  return puzzle
}

const puzzle = makePuzzle()
const pristineBoard = puzzle.map((row) => row.slice())

function dailyGame(overrides = {}) {
  return {
    mode: 'daily',
    dateKey: '2026-10-30',
    status: 'playing',
    elapsed: 0,
    board: pristineBoard,
    puzzle,
    ...overrides,
  }
}

const TODAY = '2026-10-31'

describe('isPristineBoard', () => {
  it('盤面與題目完全相同 → true', () => {
    expect(isPristineBoard(pristineBoard, puzzle)).toBe(true)
  })

  it('玩家填過任何一格 → false', () => {
    const board = pristineBoard.map((row) => row.slice())
    board[0][1] = 7
    expect(isPristineBoard(board, puzzle)).toBe(false)
  })

  it('玩家改動題目格或還原成相同內容 → 仍視為空盤', () => {
    const board = pristineBoard.map((row) => row.slice())
    board[0][0] = 5
    expect(isPristineBoard(board, puzzle)).toBe(true)
  })

  it('格式不對 → false，不拋錯', () => {
    expect(isPristineBoard(null, puzzle)).toBe(false)
    expect(isPristineBoard([], puzzle)).toBe(false)
    expect(isPristineBoard(pristineBoard, null)).toBe(false)
  })
})

describe('shouldAutoRollover', () => {
  it('同一天 → 不換題', () => {
    expect(shouldAutoRollover(dailyGame(), '2026-10-30')).toBe(false)
  })

  it('昨天已完成（won）→ 換成今天的題目', () => {
    const game = dailyGame({ status: 'won', elapsed: 300, board: emptyBoard() })
    expect(shouldAutoRollover(game, TODAY)).toBe(true)
  })

  it('昨天進行中但還是空盤且 0 秒 → 換題', () => {
    expect(shouldAutoRollover(dailyGame(), TODAY)).toBe(true)
  })

  it('昨天進行中且已開始計時 → 不換題（保留給玩家解完）', () => {
    expect(shouldAutoRollover(dailyGame({ elapsed: 42 }), TODAY)).toBe(false)
  })

  it('昨天進行中但盤面已修改 → 不換題', () => {
    const board = pristineBoard.map((row) => row.slice())
    board[0][1] = 7
    expect(shouldAutoRollover(dailyGame({ board }), TODAY)).toBe(false)
  })

  it('自由模式（random）→ 不換題', () => {
    expect(shouldAutoRollover(dailyGame({ mode: 'random', dateKey: null }), TODAY)).toBe(false)
  })

  it('沒有日期 key 的每日挑戰且空盤 → 換題', () => {
    expect(shouldAutoRollover(dailyGame({ dateKey: null }), TODAY)).toBe(true)
  })

  it('game 為 null → false，不拋錯', () => {
    expect(shouldAutoRollover(null, TODAY)).toBe(false)
  })
})

describe('計時基準點工具', () => {
  it('readElapsed：依 at 累加秒數', () => {
    expect(readElapsed({ elapsed: 10, at: 1000 }, 4000)).toBe(13)
  })

  it('readElapsed：at 在未來或時間倒退時不會少於已定格秒數', () => {
    expect(readElapsed({ elapsed: 10, at: 5000 }, 4000)).toBe(10)
  })

  it('readElapsed：暫停中（at === null）回傳定格秒數', () => {
    expect(readElapsed({ elapsed: 10, at: null }, 999999)).toBe(10)
  })

  it('readElapsed：base 不合法時回傳 0', () => {
    expect(readElapsed(null, 1000)).toBe(0)
    expect(readElapsed({ elapsed: Number.NaN, at: 1000 }, 2000)).toBe(0)
  })

  it('freezeElapsed：把目前時間定格，之後不再增加', () => {
    const frozen = freezeElapsed({ elapsed: 10, at: 1000 }, 4000)
    expect(frozen).toEqual({ elapsed: 13, at: null })
    expect(readElapsed(frozen, 999999)).toBe(13)
  })

  it('resumeElapsed：以定格秒數與新基準點繼續計時', () => {
    const resumed = resumeElapsed({ elapsed: 13, at: null }, 9000)
    expect(resumed).toEqual({ elapsed: 13, at: 9000 })
    expect(readElapsed(resumed, 11000)).toBe(15)
  })
})
