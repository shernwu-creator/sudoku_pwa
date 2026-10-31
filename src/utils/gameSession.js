/**
 * gameSession.js — 遊戲工作階段（跨日換題、計時暫停）的純規則。
 *
 * 與 React／DOM 解耦，方便用 vitest 直接測試；useSudokuGame 只負責把
 * 這些規則接到 state 與計時器上。
 */

/**
 * 盤面是否仍與題目完全相同（玩家尚未動過任何一格）。
 *
 * @param {number[][]} board 目前盤面
 * @param {number[][]} puzzle 題目（0 = 空格）
 * @returns {boolean}
 */
export function isPristineBoard(board, puzzle) {
  if (!Array.isArray(board) || !Array.isArray(puzzle)) return false
  if (board.length !== puzzle.length) return false
  return board.every(
    (row, rowIndex) =>
      Array.isArray(row) &&
      Array.isArray(puzzle[rowIndex]) &&
      row.length === puzzle[rowIndex].length &&
      row.every((value, colIndex) => value === puzzle[rowIndex][colIndex]),
  )
}

/**
 * 跨日時是否應自動換成「新的一天」每日挑戰。
 *
 * 規則：
 * - 非每日挑戰、或日期相同 → 不換題。
 * - 進行中（'playing'）且有進度（已開始計時或盤面已修改）→ 不換題，
 *   讓玩家可以把昨天開始的題目解完。
 * - 進行中但仍是空盤且計時 0 秒，或已完成（'won'）→ 換成今天的每日挑戰。
 *
 * @param {{ mode: string, dateKey: string | null, status: string, elapsed: number, board: number[][], puzzle: number[][] }} game
 * @param {string} todayKey 今天的本地日期 key（YYYY-MM-DD）
 * @returns {boolean}
 */
export function shouldAutoRollover(game, todayKey) {
  if (!game || game.mode !== 'daily') return false
  if (game.dateKey === todayKey) return false
  if (game.status === 'playing') {
    const hasProgress = game.elapsed > 0 || !isPristineBoard(game.board, game.puzzle)
    if (hasProgress) return false
  }
  return true
}

/**
 * 依計時基準點計算目前秒數。
 * `base.at === null` 代表計時暫停中（例如分頁進入背景），只回傳已定格秒數。
 *
 * @param {{ elapsed: number, at: number | null }} base
 * @param {number} [now] 目前時間戳
 * @returns {number} 無條件捨去到整秒
 */
export function readElapsed(base, now = Date.now()) {
  if (!base || !Number.isFinite(base.elapsed)) return 0
  const elapsed = Math.max(0, Math.floor(base.elapsed))
  if (base.at === null || base.at === undefined) return elapsed
  const nowValue = Number.isFinite(now) ? now : Date.now()
  return elapsed + Math.max(0, Math.floor((nowValue - base.at) / 1000))
}

/**
 * 進入背景時把目前秒數定格，避免背景時間被計入。
 *
 * @param {{ elapsed: number, at: number | null }} base
 * @param {number} [now]
 * @returns {{ elapsed: number, at: null }}
 */
export function freezeElapsed(base, now = Date.now()) {
  return { elapsed: readElapsed(base, now), at: null }
}

/**
 * 回到前景時以定格秒數重新設定基準點，從現在繼續計時。
 *
 * @param {{ elapsed: number, at: number | null }} base
 * @param {number} [now]
 * @returns {{ elapsed: number, at: number }}
 */
export function resumeElapsed(base, now = Date.now()) {
  return { elapsed: readElapsed(base, now), at: now }
}
