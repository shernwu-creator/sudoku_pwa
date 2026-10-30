/**
 * 產生 PWA 圖示（純 Node.js，零外部依賴）
 * ------------------------------------------------------------------
 * 執行：npm run generate:icons
 * 產出：
 *   public/pwa-192x192.png
 *   public/pwa-512x512.png
 *   public/pwa-maskable-512x512.png（滿版、內容置中於安全區）
 *   public/apple-touch-icon.png（滿版，iOS 自行裁圓角）
 *
 * 圖示是「9×9 數獨盤面」的抽象幾何圖形：靛藍底色、米白盤面、
 * 3×3 粗格線，以及散落在不同宮格內的色塊（象徵已填入的數字）。
 * 不含任何字型或外部資源，確保離線與各平台一致。
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const PUBLIC_DIR = path.join(process.cwd(), 'public')
const SS = 3 // 超取樣倍率（3×3 平均降採樣 = 抗鋸齒）

const COLOR = {
  bgTop: [79, 70, 229], // brand-600 #4f46e5
  bgBottom: [49, 46, 129], // brand-900 #312e81
  board: [248, 250, 252], // slate-50
  thinLine: [199, 210, 254], // brand-200
  thickLine: [67, 56, 202], // brand-700
  darkTile: [67, 56, 202], // brand-700
  lightTile: [129, 140, 248], // brand-400
}

const BOARD_INSET = { rounded: 0.15, maskable: 0.22, apple: 0.15 }

// 已填入的色塊位置（列, 欄, 顏色）；刻意分散在不同 3×3 宮格
const TILES = [
  [0, 1, 'dark'],
  [0, 7, 'light'],
  [1, 4, 'dark'],
  [2, 7, 'light'],
  [3, 3, 'dark'],
  [4, 0, 'light'],
  [4, 8, 'dark'],
  [5, 5, 'light'],
  [6, 2, 'dark'],
  [7, 6, 'light'],
  [8, 1, 'light'],
]

const inRoundedRect = (x, y, x0, y0, x1, y1, radius) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + radius), x1 - radius)
  const cy = Math.min(Math.max(y, y0 + radius), y1 - radius)
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
}

const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
]

const tileColor = (r, c) => {
  const hit = TILES.find(([tr, tc]) => tr === r && tc === c)
  if (!hit) return null
  return hit[2] === 'dark' ? COLOR.darkTile : COLOR.lightTile
}

/**
 * 回傳某個取樣點的顏色（null = 透明）。x, y 為 0–1 的歸一化座標。
 */
function colorAt(x, y, options) {
  const { shape } = options
  const isRounded = shape === 'rounded'
  if (isRounded && !inRoundedRect(x, y, 0, 0, 1, 1, 0.22)) return null

  // 1) 靛藍漸層底
  let color = mix(COLOR.bgTop, COLOR.bgBottom, y)

  // 2) 米白盤面
  const inset = BOARD_INSET[shape] ?? BOARD_INSET.rounded
  const x0 = inset
  const y0 = inset
  const x1 = 1 - inset
  const y1 = 1 - inset
  const radius = 0.055
  if (!inRoundedRect(x, y, x0, y0, x1, y1, radius)) return color
  color = COLOR.board

  const w = x1 - x0
  const h = y1 - y0
  const u = (x - x0) / w // 0–1 盤面內座標
  const v = (y - y0) / h

  // 3) 格線：細線 0.006、3×3 粗線 0.02（以盤面寬度為單位）
  const boundaries = []
  for (let i = 1; i <= 8; i += 1) boundaries.push({ pos: i / 9, thick: i % 3 === 0 })
  const cellU = 1 / 9
  const cellV = 1 / 9
  // 先畫細線
  for (const line of boundaries) {
    if (line.thick) continue
    if (Math.abs(u - line.pos) < 0.004 || Math.abs(v - line.pos) < 0.004) color = COLOR.thinLine
  }
  // 再畫粗線（覆蓋細線）
  for (const line of boundaries) {
    if (!line.thick) continue
    if (Math.abs(u - line.pos) < 0.016 || Math.abs(v - line.pos) < 0.016) color = COLOR.thickLine
  }

  // 4) 填入的色塊（每個 cell 為 1/9 × 1/9，留 12% padding，圓角）
  const c = Math.min(8, Math.floor(u / cellU))
  const r = Math.min(8, Math.floor(v / cellV))
  const fill = tileColor(r, c)
  if (fill) {
    const padU = cellU * 0.18
    const padV = cellV * 0.18
    const cx0 = x0 + c * cellU * w + padU * w
    const cy0 = y0 + r * cellV * h + padV * h
    const cx1 = x0 + (c + 1) * cellU * w - padU * w
    const cy1 = y0 + (r + 1) * cellV * h - padV * h
    const tileRadius = Math.min(cx1 - cx0, cy1 - cy0) * 0.22
    if (inRoundedRect(x, y, cx0, cy0, cx1, cy1, tileRadius)) color = fill
  }

  return color
}

/** 以 SS 倍解析度取樣後平均降採樣，產生抗鋸齒的 RGBA buffer */
function renderRgba(size, options) {
  const out = Buffer.alloc(size * size * 4)
  const samples = SS * SS

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0

      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const nx = (x * SS + sx + 0.5) / (size * SS)
          const ny = (y * SS + sy + 0.5) / (size * SS)
          const color = colorAt(nx, ny, options)
          if (!color) continue
          r += color[0]
          g += color[1]
          b += color[2]
          a += 1
        }
      }

      const index = (y * size + x) * 4
      if (a === 0) {
        out.writeUInt32BE(0, index)
        continue
      }
      out[index] = Math.round(r / a)
      out[index + 1] = Math.round(g / a)
      out[index + 2] = Math.round(b / a)
      out[index + 3] = Math.round((a / samples) * 255)
    }
  }

  return out
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // color type: RGBA
  header[10] = 0
  header[11] = 0
  header[12] = 0

  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const TARGETS = [
  { file: 'pwa-192x192.png', size: 192, shape: 'rounded' },
  { file: 'pwa-512x512.png', size: 512, shape: 'rounded' },
  { file: 'pwa-maskable-512x512.png', size: 512, shape: 'maskable' },
  { file: 'apple-touch-icon.png', size: 180, shape: 'apple' },
]

fs.mkdirSync(PUBLIC_DIR, { recursive: true })
for (const target of TARGETS) {
  const png = encodePng(target.size, renderRgba(target.size, { shape: target.shape }))
  fs.writeFileSync(path.join(PUBLIC_DIR, target.file), png)
  console.log(`✔ public/${target.file} (${target.size}×${target.size})`)
}
