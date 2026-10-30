import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合併 class name：clsx 處理條件式，tailwind-merge 處理衝突的 Tailwind utility
 * （後者覆蓋前者，例如 `bg-white` + `bg-brand-100` → `bg-brand-100`）。
 *
 * @param {...import('clsx').ClassValue} inputs
 * @returns {string}
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
