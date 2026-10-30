/**
 * 日期／時間小工具（純函式，無 React / DOM 依賴）。
 *
 * 每日挑戰一律以「使用者裝置的本地日期」為準（不是 UTC）：
 * 跨時區時才不會在當地時間還在前一天時就提前換題。
 */

const pad2 = (value) => String(value).padStart(2, '0')

/**
 * 本地日期 key，格式固定為 `YYYY-MM-DD`。
 * @param {Date} [date]
 * @returns {string}
 */
export function getDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  return `${year}-${month}-${day}`
}

/**
 * 今天的本地日期 key。
 * @returns {string}
 */
export function getTodayKey() {
  return getDateKey(new Date())
}

/**
 * 每日挑戰的固定 seed：`daily-YYYY-MM-DD`。
 * 同一天、同一難度在任何裝置都會得到同一題。
 * @param {string} dateKey 本地日期 key
 * @returns {string}
 */
export function dailySeed(dateKey) {
  return `daily-${dateKey}`
}

/**
 * 顯示用日期，例如「2026年10月30日 星期五」。
 * @param {Date} [date]
 * @returns {string}
 */
export function formatDisplayDate(date = new Date()) {
  try {
    const datePart = new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
    const weekdayPart = new Intl.DateTimeFormat('zh-TW', { weekday: 'long' }).format(date)
    return `${datePart} ${weekdayPart}`
  } catch {
    // 舊環境沒有 Intl 時的退路
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
  }
}

/**
 * 秒數 → `mm:ss`（分鐘至少兩位，超過 99 分鐘自然進位）。
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatDuration(totalSeconds) {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${pad2(minutes)}:${pad2(seconds)}`
}
