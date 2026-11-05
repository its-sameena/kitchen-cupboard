/**
 * App-level settings that shape the UI. See "Customising the look" in README.md.
 */
import type { LucideIcon } from 'lucide-react'
import { UI } from './icons'

export type TabId = 'cupboard' | 'grocery' | 'house'

export interface TabConfig {
  id: TabId
  label: string
  /** Subtitle shown under the kitchen name in the top bar. */
  title: string
  icon: LucideIcon
  /** Used instead while a grocery run is active (grocery tab only). */
  liveLabel?: string
  liveIcon?: LucideIcon
}

/** Bottom tab bar, left to right. Reorder these to reorder the tabs. */
export const TABS: TabConfig[] = [
  { id: 'cupboard', label: 'Cupboard', title: 'Shared cupboard', icon: UI.cupboard },
  { id: 'grocery', label: 'Groceries', title: 'Groceries', icon: UI.groceries, liveLabel: 'Grocery run', liveIcon: UI.groceryRun },
  { id: 'house', label: 'House', title: 'House', icon: UI.house },
]

/** Tab shown when the app opens. */
export const DEFAULT_TAB: TabId = 'cupboard'

/** Size (px) of icons inside cupboard jars, shelf labels and lists. */
export const ICON_SIZES = { jar: 28, shelf: 13, list: 22, tab: 22, button: 18 }
