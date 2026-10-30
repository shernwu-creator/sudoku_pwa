import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service Worker 由 vite-plugin-pwa 產生；autoUpdate 會在背景自動更新。
// 本遊戲完全離線可用，第一次載入完成後所有資源都會進入預快取。
registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('[PWA] 靜態資源已快取，現在可以完全離線遊玩。')
  },
  onRegisterError(error) {
    console.warn('[PWA] Service Worker 註冊失敗：', error)
  },
})
