import type { CategoryId } from '../types'

/**
 * An icon drawing on a 24×24 grid: a list of SVG shapes, e.g.
 * [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M12 7v5l3 3' }]].
 * Shapes are drawn as 2px round lines in the current text colour (like Lucide).
 */
export type IconNode = [tag: string, attrs: Record<string, string>][]

export interface ItemIconData {
  /** Shown in the icon picker. */
  label: string
  /** Where it came from, e.g. "lucide:milk", "tabler:salt", "lucide-lab:onion", "custom". */
  source: string
  node: IconNode
}

/** "If the name contains any of these keywords, use this icon on this shelf." */
export interface KeywordRule {
  shelf: CategoryId
  icon: string
  keywords: string[]
}

/** A name and what it should guess. shelf: null = no guess expected. icon is optional. */
export interface KeywordTest {
  name: string
  shelf: CategoryId | null
  icon?: string
}
