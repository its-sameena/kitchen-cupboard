/**
 * App-level settings that shape the UI. See "Customising the look" in README.md.
 */
import type { LucideIcon } from 'lucide-react'
import { UI } from './icons'

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

/** Shops offered when starting a grocery run (2 per row). See "Shop logos" in README.md. */
export const STORES: StoreConfig[] = [
  { name: 'ASDA', label: 'ASDA', color: '#78be20' },
  { name: 'Lidl', label: 'Lidl', color: '#0050aa' },
  { name: "Sainsbury's", label: "Sainsbury's", color: '#f06c00' },
  { name: '', label: 'Other', color: '#9a9a9a' },
]
