/**
 * App-level settings that shape the UI. See docs/customising.md.
 */
import type { LucideIcon } from 'lucide-react'
import { UI } from './icons'
import type { Item } from './types'

export type TabId = 'cupboard' | 'grocery' | 'house'

export interface TabConfig {
  id: TabId
  label: string
  /** Big serif page title (shown under the kitchen name). */
  title: string
  icon: LucideIcon
  /** Used instead while a grocery run is active (grocery tab only). */
  liveLabel?: string
  liveIcon?: LucideIcon
}

/** Bottom tab bar, left to right. Reorder these to reorder the tabs. */
export const TABS: TabConfig[] = [
  { id: 'cupboard', label: 'Cupboard', title: 'Cupboard', icon: UI.cupboard },
  { id: 'grocery', label: 'Groceries', title: 'Groceries', icon: UI.groceries, liveLabel: 'Grocery run', liveIcon: UI.groceryRun },
  { id: 'house', label: 'House', title: 'House', icon: UI.house },
]

/** Tab shown when the app opens. */
export const DEFAULT_TAB: TabId = 'cupboard'

/**
 * Order of the item cards on each shelf, left to right. Swap in one of the
 * alternatives below (or write your own: return < 0 to put `a` first).
 */
export const SHELF_ITEM_ORDER: (a: Item, b: Item) => number = (a, b) =>
  // In stock first, then A→Z
  Number(b.owners.length > 0) - Number(a.owners.length > 0) || a.name.localeCompare(b.name)

// Alternatives:
//   A→Z only:                (a, b) => a.name.localeCompare(b.name)
//   Most owners first (×N):  (a, b) => b.owners.length - a.owners.length || a.name.localeCompare(b.name)
//   Recently changed first:  (a, b) => b.updatedAt - a.updatedAt

/** Size (px) of icons on item cards, shelf headings, lists, tabs and buttons. */
export const ICON_SIZES = { card: 30, shelf: 16, list: 22, tab: 22, button: 18 }

export interface StoreConfig {
  /** Saved as the run's store name, shown in alerts ("Sam is going grocery shopping at ASDA"). Empty = no name. */
  name: string
  /** Text on the button when there's no logo. */
  label: string
  /** Button border colour. */
  color: string
  /** Optional logo image in public/stores/, e.g. '/stores/asda.svg'. Leave undefined to show the label. */
  logo?: string
}

/** Shops offered when starting a grocery run (2 per row). See "Shop logos" in docs/customising.md. */
export const STORES: StoreConfig[] = [
  { name: 'ASDA', label: 'ASDA', color: '#78be20' },
  { name: 'Lidl', label: 'Lidl', color: '#0050aa' },
  { name: "Sainsbury's", label: "Sainsbury's", color: '#f06c00' },
  { name: '', label: 'Other', color: '#9a9a9a' },
]

/**
 * Receipt scanning: give up after this long and offer "Scan again" (ms).
 * The scanner function keeps its own total under this (see docs/receipt-speed.md).
 */
export const SCAN_TIMEOUT_MS = 15_000
