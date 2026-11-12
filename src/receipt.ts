/**
 * Receipt scanning: shrink the photo on the phone, then ask the `scan-receipt`
 * edge function (Gemini) to list the groceries on it.
 */
import { suggestFor } from './data'
import { DEFAULT_ITEM_ICON } from './icons'
import { sb } from './supabase'
import type { CategoryId } from './types'

export interface ScannedItem {
  name: string
  quantity: number
  category: CategoryId
  icon: string
  raw: string
  confidence: 'high' | 'low'
}

/** How long a scan took and why (shown as "Read in 4.2 s"; tap for details). */
export interface ScanTiming {
  /** Whole wait, tap → list (ms). */
  totalMs: number
  /** Shrinking the photo on the phone. */
  photoMs: number
  /** Upload + download between the phone and Supabase (total minus everything else). */
  networkMs: number
  /** Inside the function: checking the phone + Gemini. */
  serverMs: number
  /** Waiting for Google's answer. */
  geminiMs: number
  model: string
  modelVersion: string
  usage: { input: number; thinking: number; output: number }
  imageKB: number
  items: number
  at: number
}

export interface ScanResult {
  store: string
  items: ScannedItem[]
  timing: ScanTiming | null
}

const LAST_SCAN = 'kc-last-scan'

/** The most recent scan's timing, if it was in the last hour (attached to feedback). */
export function lastScanTiming(): ScanTiming | null {
  try {
    const t = JSON.parse(localStorage.getItem(LAST_SCAN) ?? 'null') as ScanTiming | null
    return t && Date.now() - t.at < 3_600_000 ? t : null
  } catch {
    return null
  }
}

/** Load any photo the phone gives us (JPEG/PNG/HEIC) the right way up. */
async function loadImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

/** Resize to at most `max` px on the long side and return base64 JPEG (no data: prefix). ~200–400 KB. */
export async function photoToJpeg(file: File, max = 1600): Promise<string> {
  const img = await loadImage(file)
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82).split(',')[1]
}

export async function scanReceipt(file: File): Promise<ScanResult> {
  const t0 = performance.now()
  const image = await photoToJpeg(file)
  const t1 = performance.now()
  const { data, error } = await sb.functions.invoke('scan-receipt', { body: { image, mime: 'image/jpeg' } })
  const t2 = performance.now()
  if (error) {
    // The function sends a friendly { error } message; dig it out of the HTTP error.
    const ctx = (error as { context?: Response }).context
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null
    if (body?.error) throw new Error(body.detail ? `${body.error}\n\nDetails: ${body.detail}` : body.error)
    if (/not found|404/i.test(error.message)) throw new Error('Receipt scanning isn’t set up yet (the scan-receipt function isn’t deployed).')
    throw new Error('Couldn’t reach the receipt scanner. Check your connection and try again.')
  }
  const res = data as { store: string; items: ScannedItem[]; meta?: { model: string; modelVersion: string; usage: ScanTiming['usage']; ms: { server: number; gemini: number }; imageKB: number } }
  // Shelf and icon: use Gemini's when it gives them, otherwise the app's own guesser.
  const items = res.items.map((it) => {
    const guess = it.category && it.icon ? null : suggestFor(it.name)
    const category = (it.category || guess?.category || 'other') as CategoryId
    return { ...it, category, icon: it.icon || guess?.icon || DEFAULT_ITEM_ICON[category] }
  })
  const m = res.meta
  const timing: ScanTiming | null = m
    ? {
        totalMs: Math.round(t2 - t0),
        photoMs: Math.round(t1 - t0),
        networkMs: Math.max(0, Math.round(t2 - t1 - m.ms.server)),
        serverMs: m.ms.server,
        geminiMs: m.ms.gemini,
        model: m.model,
        modelVersion: m.modelVersion,
        usage: m.usage,
        imageKB: m.imageKB,
        items: items.length,
        at: Date.now(),
      }
    : null
  try {
    if (timing) localStorage.setItem(LAST_SCAN, JSON.stringify(timing))
  } catch {
    /* private mode */
  }
  return { store: res.store, items, timing }
}
