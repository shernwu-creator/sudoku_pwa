# AGENTS.md — sudoku_pwa 開發指引（給 AI 代理）

本檔適用於所有在此 repo 工作的 AI 代理（Claude Code、Codex、Cursor、DSH 等）。
**開始任何探索或修改前，請先讀完本檔。**

## 0. 專案速覽

完全離線可玩的數獨 PWA（React 19 + Vite 8 + Tailwind 3 + vite-plugin-pwa）。
沒有任何後端或外部 API；所有資源都必須在第一次載入時被 Service Worker 預快取。

- 線上版本：<https://shernwu-creator.github.io/sudoku_pwa/>
- 部署方式：push 到 `main` → GitHub Actions `.github/workflows/deploy.yml` → GitHub Pages
- 建置子路徑：`/sudoku_pwa/`（可用 `VITE_BASE_PATH` 覆寫）

```bash
npm ci                  # 安裝依賴（與 CI 相同）
npm run dev             # 開發伺服器 http://localhost:5173
npm test                # Vitest：數獨邏輯單元測試
npm run build           # 產出 dist/（含 sw.js、manifest.webmanifest）
npm run preview         # 以 /sudoku_pwa/ 子路徑驗證 PWA
npm run generate:icons  # 重新產生 public/ 下的 PWA 圖示（純 Node.js）
```

驗證 PWA／離線功能時**一定**要用 `npm run build && npm run preview`，
開發伺服器預設不啟用 Service Worker（`devOptions.enabled: false`）。

## 1. 探索規則：CodeGraph 優先（強制）

本 repo 已建立 CodeGraph 代碼圖譜（索引在 `.codegraph/`，已加入 `.gitignore`，**不要提交**）。
所有結構探索、符號定位、影響分析，**必須先用 codegraph CLI**，再用 read 讀取「已定位的具體檔案與行號」。

### 1.1 建議順序

```bash
codegraph status                          # 索引狀態／是否需 sync
codegraph files                           # 專案檔案樹（先看有哪些檔案）
codegraph explore "數獨挖洞與每日挑戰資料流"  # 一次取得相關符號原始碼＋呼叫路徑（最常用）
codegraph query <symbol>                  # 以名稱搜尋符號
codegraph node <symbol>                   # 單一符號原始碼＋caller/callee
codegraph context "新增功能描述"           # 為任務建立上下文
codegraph callers <symbol>                # 誰呼叫它（改函式前必查）
codegraph callees <symbol>                # 它呼叫誰
codegraph impact <symbol>                 # 改動影響範圍（改 API／hook 前必查）
```

探索時請用**中文或英文的自然語言**描述意圖（例：`codegraph explore "棋盤點選與衝突高亮"`），
比逐檔閱讀快得多。codegraph 回傳的原始碼等同已讀取，可直接依行號 edit。

### 1.2 禁止事項（違反視同未完成工作）

- ❌ **禁止大範圍 grep／ripgrep**：不得對整個 repo 執行 `grep -r`、`rg`、`grep` 掃目錄來「找東西」。
  需要搜尋時先用 `codegraph query` / `codegraph explore`；真的需要文字搜尋時，
  限縮到「codegraph 已定位的單一檔案」且只搜尋該檔。
- ❌ **禁止大範圍讀檔**：不得用 `cat`／read 一次讀整個 `src/`、`node_modules/`、
  `package-lock.json`、`dist/` 或 `public/` 的全部內容。
- ❌ **禁止用 `find` 掃描**：用 `codegraph files` 或 `glob` 限定 pattern。
- ❌ 不要在回覆中貼出整份檔案；只引用需要修改的行號區間。

### 1.3 例外（可少量直接讀取）

- `package.json`、`vite.config.js`、`vitest.config.js`、`tailwind.config.js`、`.gitignore`、
  `index.html`、`src/index.css`、`src/utils/cn.js` 等小型設定檔。
- codegraph 回報「找不到符號」時，可退回 `glob` 限定目錄，再讀取單一檔案。
- 你剛剛建立或修改的檔案可直接讀取。
- 修改完成後執行 `codegraph sync`（或 `npm run codegraph:sync`），讓圖譜保持最新。

## 2. 架構地圖

```
sudoku_pwa/
├─ index.html                    # PWA meta、%BASE_URL% 圖示、掛載點
├─ vite.config.js                # base path、VitePWA manifest/workbox 設定
├─ vitest.config.js              # 邏輯測試設定（node 環境）
├─ tailwind.config.js            # 品牌色、陰影、動畫 keyframes
├─ src/
│  ├─ main.jsx                   # React 掛載 + 手動註冊 Service Worker
│  ├─ index.css                  # Tailwind 入口＋安全區 utilities
│  ├─ App.jsx                    # 版面組合、全域鍵盤事件、勝負狀態
│  ├─ components/
│  │  ├─ Header.jsx              # 日期、難度選單、新遊戲／每日挑戰、計時器
│  │  ├─ Board.jsx               # 9×9 棋盤、選取/同列/同欄/同數字/錯誤高亮
│  │  └─ NumberPad.jsx           # 手機數字鍵盤（1–9 + 清除）
│  ├─ hooks/
│  │  └─ useSudokuGame.js        # 遊戲狀態機、計時、localStorage 自動存檔
│  └─ utils/
│     ├─ sudokuLogic.js          # 純邏輯（零 React 依賴，可單獨測試）
│     ├─ sudokuLogic.test.js     # Vitest 單元測試
│     ├─ date.js                 # 本地日期 key（每日挑戰種子）
│     └─ cn.js                   # clsx + tailwind-merge
├─ scripts/generate-icons.mjs    # 純 Node.js 產生 PWA 圖示
├─ public/                       # favicon、PWA 圖示
└─ .github/workflows/deploy.yml  # GitHub Pages 部署
```

## 3. 核心邏輯契約（不可隨意破壞）

`src/utils/sudokuLogic.js` 是**純函式模組**：不得 import React、不得碰 DOM／localStorage，
必須能在 `vitest` 的 node 環境直接執行。

- 棋盤一律是 `number[9][9]`，`0` 代表空格；合法數字為 `1..9`。
- `EMPTY = 0`。
- `DIFFICULTY`：key 為 `1|2|3`，每筆含 `{ id, key, label, labelZh, clues }`。
  難度與保留數字：1 Easy = **40**、2 Medium = **30**、3 Hard = **25**。
- `generateSudoku(seed?)`：回傳完整合法盤面（81 格皆有 1–9，列／欄／宮皆不重複）。
  傳入相同 `seed`（字串）必須得到完全相同的盤面（seedrandom）；未傳 seed 才可用
  `Math.random`。不得每次呼叫都建立 global 隨機狀態。
- `createPuzzle(board, difficulty, seed?)`：回傳**新的**挖洞盤面（不修改傳入的 board），
  保留數字數量必須精確等於該難度 `clues`，其餘為 `0`；保留格的值不得改變。
  傳入相同 `seed` + `difficulty` 時結果必須固定，供「每日挑戰」跨裝置一致。
- `checkValidity(board, row, col, num)`：檢查把 `num` 放入 `(row, col)` 是否不違反
  列／欄／3×3 宮規則；**忽略該格目前的值**（同格重新輸入相同數字不應誤判衝突）。
  座標或數字不合法時回傳 `false`。
- `getConflicts(board)`：回傳所有參與重複的格子座標 `Set<"row,col">`（忽略 `0`）。
- `isComplete(board)`：81 格皆為 1–9 且 `getConflicts` 為空。
- 效能：單次 `generateSudoku` + `createPuzzle` 應在一般手機上 < 500ms；不要加入
  昂貴且無上限的重試迴圈。
- 唯一解不是硬性需求，但挖洞時若能低成本維持唯一解更好；**精確題目數字量優先**。

## 4. 開發慣例

- **Mobile-First**：手機（375×667 起）滿版、不需橫向捲動；桌機置中並限制最大寬度
  （約 520–560px）。使用 `100dvh` 與 `pt-safe` / `pb-safe` 處理瀏海與 Home Indicator。
- **樣式**：只用 Tailwind utility；動態合併 class 一律用 `cn()`（`clsx` + `tailwind-merge`）。
  不新增第二套 CSS 架構；品牌色用 `brand-*`，勿硬編碼色碼（圖示腳本除外）。
- **元件分割**：`App.jsx` 只負責組合與全域事件；棋盤渲染歸 `Board.jsx`；
  輸入面板歸 `NumberPad.jsx`；遊戲狀態機集中在 `useSudokuGame.js`。
- **可存取性**：格子用 `<button>`，提供 `aria-label`（列、欄、數字）與 `aria-selected`；
  錯誤／選取不可只靠顏色（粗體、外框、圖示輔助）；觸控目標至少 44×44px；
  不要停用瀏覽器縮放（`user-scalable=no` 禁止使用）。
- **鍵盤**：實體鍵盤 1–9 填入、Backspace/Delete/0 清除、方向鍵移動選取、Esc 取消選取。
  事件掛在 `window` 時要忽略 `<select>`、`<input>`、`<textarea>` 上的按鍵。
- **離線**：禁止外部字型、CDN、遠端圖片或 API。新資源放 `public/` 或 `import` 進 bundle，
  確保被 Workbox 的 `globPatterns` 預快取。新增檔案類型時同步更新 `vite.config.js`。
- **子路徑**：不要硬編碼 `/` 開頭的資源路徑；用 `import.meta.env.BASE_URL` 或 Vite 的
  相對資源處理。測試 PWA 請用 `npm run preview`（預設掛在 `/sudoku_pwa/`）。
- **本機儲存**：key 一律以 `sudoku:v1:` 開頭；讀取時 try/catch，格式錯誤就丢棄重來；
  schema 變更時提升版本號，不要讓舊資料弄壞新版本。
- **每日挑戰**：以**本地日期** `YYYY-MM-DD` 產生 seed（例如 `daily-2026-10-30`）；
  同一天、同一難度在任何裝置都必須是同一題。新遊戲則使用隨機 seed。
- **無障礙與動效**：尊重 `prefers-reduced-motion`（可選）；動畫短（< 300ms）且不阻擋操作。

## 5. 完成定義（Definition of Done）

修改任何功能後，至少完成：

1. `npm test` 全數通過（邏輯改動必附／更新測試）。
2. `npm run build` 成功；`dist/sw.js`、`dist/manifest.webmanifest` 存在，
   precache 清單包含所有 js/css/html/svg/png。
3. `npm run preview` 開啟無 console error；Service Worker 狀態為 activated。
4. 新依賴需在 PR／commit 說明理由，避免為了小事加大 bundle。
5. 不要提交 `dist/`、`node_modules/`、`.codegraph/`、`.env*`。
6. 更新 `codegraph sync`，並在必要時同步更新本 `AGENTS.md`。
7. Commit message 採 Conventional Commits：`feat(board): ...`、`fix(sw): ...`、
   `docs(readme): ...`、`chore(ci): ...`。

## 6. 部署與 PWA 注意事項

- GitHub Pages 網址為 `https://shernwu-creator.github.io/sudoku_pwa/`，因此建置 base 必須是
  `/sudoku_pwa/`。若改為自訂網域，於 CI 設定 `VITE_BASE_PATH=/`。
- Pages 的來源必須是 **GitHub Actions**（由 `actions/deploy-pages` 部署），
  不是 `gh-pages` 分支。
- `manifest.webmanifest` 的 `start_url`、`scope`、icons 路徑都依賴 `base`；
  改動 `vite.config.js` 的 `base` 時要一起確認。
- Service Worker 使用 `registerType: 'autoUpdate'`，舊快取由 `cleanupOutdatedCaches`
  清除；若改了快取策略，請在瀏覽器 DevTools → Application → Service Workers
  勾選 Update on reload 驗證。
- iOS 需 Safari「分享 → 加入主畫面」才會以 standalone 模式啟動；
  `apple-touch-icon.png` 必須是**不透明**滿版 PNG。

## 7. 常見陷阱

- **每日挑戰不一致**：生成流程任何一處用了 `Math.random` 都會破壞跨裝置一致性；
  seed 必須一路傳進 `generateSudoku` 與 `createPuzzle`。
- **棋盤格線不明顯**：3×3 宮的粗線與格內細線要用不同粗細／顏色，
  且外框不可被相鄰格子的 border 疊加蓋掉（用 `border-r-2` 於第 2、5 欄與
  `border-b-2` 於第 2、5 列，並注意最後一列／欄不重複加框）。
- **手機點擊延遲／雙擊縮放**：棋盤與數字鍵盤加 `touch-action: manipulation`。
- **錯誤高亮範圍**：衝突要同時標示「剛填入的格子」與造成衝突的既有格子，
  否則玩家不知道錯在哪。
- **localStorage 還原**：`board`、`puzzle`、`solution` 都要存；只存 puzzle 會讓
  已填進度消失。還原前驗證維度與日期（每日挑戰跨日要換題）。
- **SW 在 dev 模式不存在**：看到 404 `/sw.js` 是正常的；請用 preview 驗證。
- **base path 寫死**：`/favicon.svg` 在 Pages 子路徑會 404，必須用 `%BASE_URL%`。
