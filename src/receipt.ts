/**
 * Receipt scanning: shrink the photo on the phone, then ask the `scan-receipt`
 * edge function (Gemini) to list the groceries on it.
 */
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

export interface ScanResult {
  store: string
  items: ScannedItem[]
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
  const image = await photoToJpeg(file)
  const { data, error } = await sb.functions.invoke('scan-receipt', { body: { image, mime: 'image/jpeg' } })
  if (error) {
    // The function sends a friendly { error } message; dig it out of the HTTP error.
    const ctx = (error as { context?: Response }).context
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null
    if (body?.error) throw new Error(body.error)
    if (/not found|404/i.test(error.message)) throw new Error('Receipt scanning isn’t set up yet (the scan-receipt function isn’t deployed).')
    throw new Error('Couldn’t reach the receipt scanner. Check your connection and try again.')
  }
  return data as ScanResult
}
