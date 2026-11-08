/**
 * Every icon in the app lives here, so the look can be changed in one place.
 * Icons come from Lucide (https://lucide.dev/icons). To swap one, import a
 * different icon from 'lucide-react' and change the mapping below. Item icons
 * (the food ones) are data in src/catalog/item-icons.ts: see docs/icons-and-keywords.md.
 */
import { createLucideIcon, type IconNode, type LucideIcon, type LucideProps } from 'lucide-react'
import {
  Archive, ArrowLeft, ArrowLeftRight, Bell, BellRing, Bug, Camera, Can, Carrot, Check, ChevronLeft,
  ChevronRight, Clipboard, ClipboardCheck, ClipboardList, Coffee, Cookie, CookingPot, CornerDownRight,
  CupSoda, Droplet, Heart, House, Leaf, Lightbulb, MessageCircle, MessageSquare, Milk, Package, Pencil, Plus,
  ReceiptText, Refrigerator, Search, Share2, ShoppingBag, ShoppingBasket, ShoppingCart, Shuffle, Smartphone,
  Snowflake, Sprout, Store, Trash2, TriangleAlert, Unplug, Wheat, WifiOff, X,
} from 'lucide-react'
import { ITEM_ICON_DATA } from './catalog/item-icons.ts'
import type { CategoryId, EventType, FeedbackKind } from './types'

// ───────────────────────── interface icons ─────────────────────────

export const UI = {
  // Tab bar (order and labels are in src/config.ts)
  cupboard: Archive,
  groceries: ClipboardList,
  groceryRun: ShoppingCart,
  house: House,
  // Top bar
  feedback: MessageCircle,
  activity: Bell,
  // Actions
  add: Plus,
  close: X,
  edit: Pencil,
  delete: Trash2,
  check: Check,
  search: Search,
  share: Share2,
  copy: Clipboard,
  copied: ClipboardCheck,
  shuffle: Shuffle,
  camera: Camera,
  receipt: ReceiptText,
  avatar: Sprout,
  switchProfile: ArrowLeftRight,
  back: ArrowLeft,
  chevron: ChevronRight,
  chevronLeft: ChevronLeft,
  reply: CornerDownRight,
  disconnect: Unplug,
  // Status / empty states
  warning: TriangleAlert,
  offline: WifiOff,
  emptyList: ShoppingBasket,
  thanks: Heart,
  notificationsOn: BellRing,
  install: Smartphone,
  store: Store,
} satisfies Record<string, LucideIcon>

export const FEEDBACK_ICONS: Record<FeedbackKind, LucideIcon> = {
  bug: Bug,
  idea: Lightbulb,
  other: MessageSquare,
}

export const EVENT_ICONS: Record<EventType, LucideIcon> = {
  run_started: ShoppingCart,
  run_ended: House,
  request: ShoppingBag,
  out_of_stock: TriangleAlert,
  restocked: Check,
  joined: Heart,
}

// ───────────────────────── shelves ─────────────────────────

/** An item icon from src/catalog/item-icons.ts as a Lucide-style component (box if the key is unknown). */
function catalogIcon(key: string): LucideIcon {
  const data = ITEM_ICON_DATA[key]
  if (!data) return Package
  return createLucideIcon(key, data.node.map(([tag, attrs], i) => [tag, { ...attrs, key: String(i) }]) as IconNode)
}

export const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  spices: Leaf,
  baking: Wheat,
  coffee: Coffee,
  cereals: catalogIcon('cereal-box'),
  grains: CookingPot,
  canned: Can,
  sauces: Droplet,
  snacks: Cookie,
  drinks: CupSoda,
  produce: Carrot,
  dairy: Milk,
  cold: Refrigerator,
  frozen: Snowflake,
  other: Package,
}

// ───────────────────────── items ─────────────────────────

/** Item icon used when the name doesn't suggest a better one. */
export const DEFAULT_ITEM_ICON: Record<CategoryId, string> = {
  spices: 'flask-round',
  baking: 'wheat',
  coffee: 'coffee',
  cereals: 'cereal-box',
  grains: 'cooking-pot',
  canned: 'can',
  sauces: 'droplet',
  snacks: 'cookie',
  drinks: 'cup-soda',
  produce: 'carrot',
  dairy: 'milk',
  cold: 'package',
  frozen: 'snowflake',
  other: 'package',
}

/**
 * Icons housemates can pick for cupboard items, built from src/catalog/item-icons.ts
 * (add or change them with `npm run tune`). The key is what gets saved in the database.
 */
export const ITEM_ICONS: Record<string, { icon: LucideIcon; label: string }> = Object.fromEntries(
  Object.entries(ITEM_ICON_DATA).map(([key, { label }]) => [key, { label, icon: catalogIcon(key) }]),
)

/** Renders an item's icon by key; unknown keys fall back to a box. */
export function ItemIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = ITEM_ICONS[name]?.icon ?? Package
  return <Icon aria-hidden {...props} />
}
