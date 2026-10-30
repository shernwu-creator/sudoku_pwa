import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * GitHub Pages 專案站台（https://<user>.github.io/<repo>/）需要子路徑，
 * 因此正式建置預設使用 /sudoku_pwa/；部署到自有網域時可用
 * VITE_BASE_PATH=/ 覆寫。`vite preview` 也必須沿用同一子路徑才能驗證 PWA。
 */
const DEFAULT_BASE = '/sudoku_pwa/'

function withTrailingSlash(value) {
  if (!value) return '/'
  return value.endsWith('/') ? value : `${value}/`
}

export default defineConfig(({ command, isPreview }) => {
  const base = withTrailingSlash(
    process.env.VITE_BASE_PATH ?? (command === 'build' || isPreview ? DEFAULT_BASE : '/'),
  )

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        // 新版本 SW 自動接管，玩家下次開啟即為最新版
        registerType: 'autoUpdate',
        // 由 src/main.jsx 手動註冊，方便集中處理離線就緒與錯誤
        injectRegister: null,
        manifest: {
          name: '數獨 Sudoku｜離線每日挑戰',
          short_name: '數獨',
          description: '完全離線的 PWA 數獨：每日挑戰、三種難度、行列與九宮格即時錯誤提示。',
          lang: 'zh-Hant',
          dir: 'ltr',
          id: base,
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f8fafc',
          theme_color: '#4338ca',
          categories: ['games', 'puzzle', 'education'],
          icons: [
            { src: `${base}pwa-192x192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: `${base}pwa-512x512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: `${base}pwa-maskable-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // 預快取所有靜態資源，離線時完整可玩（本遊戲沒有任何網路 API）。
          // manifest.webmanifest 由 vite-plugin-pwa 自動加入，不需列在 globPatterns。
          globPatterns: ['**/*.{js,css,html,svg,png}'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
        },
        devOptions: {
          // 開發時停用 SW，避免 HMR 被快取干擾；請用 npm run build && npm run preview 驗證
          enabled: false,
        },
      }),
    ],
  }
})
