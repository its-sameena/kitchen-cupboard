/**
 * Every icon in the app lives here, so the look can be changed in one place.
 * Icons come from Lucide (https://lucide.dev/icons). To swap one, import a
 * different icon from 'lucide-react' and change the mapping below.
 */
import type { LucideIcon, LucideProps } from 'lucide-react'
import {
  Amphora, Apple, ArrowLeft, ArrowLeftRight, Avocado, Banana, Bean, Beef, Beer, Bell, BellRing, BottleWine,
  Broccoli, Bug, CakeSlice, Can, Candy, Carrot, Check, Cherry, ChevronRight, Citrus, Coffee, Cookie, CookingPot,
  CornerDownRight, Croissant, CupSoda, Cupcake, Droplet, Drumstick, Egg, Fish, Flame, FlaskRound, GlassWater,
  Grape, Ham, Heart, House, IceCreamCone, Leaf, LeafyGreen, Lightbulb, Martini, MessageCircle, MessageSquare,
  Milk, Nut, Package, PaperBag, Pencil, Pizza, Plus, Popcorn, Popsicle, Refrigerator, Salad, Sandwich, Search,
  Share2, ShoppingBag, ShoppingBasket, ShoppingCart, Shrimp, Smartphone, Snowflake, Soup, SprayCan, Sprout,
  Store, Trash2, TriangleAlert, Unplug, Wheat, Wine, WifiOff, X, Archive, ClipboardList,
} from 'lucide-react'
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
  switchProfile: ArrowLeftRight,
  back: ArrowLeft,
  chevron: ChevronRight,
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

export const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  spices: Leaf,
  baking: Wheat,
  coffee: Coffee,
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
 * Icons housemates can pick for cupboard items. The key is what gets saved in
 * the database, so keep existing keys when changing the icon they point to.
 */
export const ITEM_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  'flask-round': { icon: FlaskRound, label: 'Spice jar' },
  flame: { icon: Flame, label: 'Chilli / hot' },
  leaf: { icon: Leaf, label: 'Herbs' },
  milk: { icon: Milk, label: 'Milk' },
  egg: { icon: Egg, label: 'Eggs' },
  drumstick: { icon: Drumstick, label: 'Chicken' },
  beef: { icon: Beef, label: 'Meat' },
  ham: { icon: Ham, label: 'Ham' },
  fish: { icon: Fish, label: 'Fish' },
  shrimp: { icon: Shrimp, label: 'Seafood' },
  snowflake: { icon: Snowflake, label: 'Frozen' },
  'ice-cream': { icon: IceCreamCone, label: 'Ice cream' },
  popsicle: { icon: Popsicle, label: 'Ice lolly' },
  pizza: { icon: Pizza, label: 'Pizza' },
  wheat: { icon: Wheat, label: 'Flour / grain' },
  'cake-slice': { icon: CakeSlice, label: 'Cake' },
  cupcake: { icon: Cupcake, label: 'Baking' },
  candy: { icon: Candy, label: 'Sweets' },
  cookie: { icon: Cookie, label: 'Biscuits' },
  croissant: { icon: Croissant, label: 'Pastry' },
  sandwich: { icon: Sandwich, label: 'Bread' },
  coffee: { icon: Coffee, label: 'Coffee / tea' },
  'cup-soda': { icon: CupSoda, label: 'Soft drink' },
  'glass-water': { icon: GlassWater, label: 'Water' },
  beer: { icon: Beer, label: 'Beer' },
  wine: { icon: Wine, label: 'Wine' },
  'bottle-wine': { icon: BottleWine, label: 'Bottle' },
  martini: { icon: Martini, label: 'Spirits' },
  can: { icon: Can, label: 'Tin' },
  soup: { icon: Soup, label: 'Soup / bowl' },
  'cooking-pot': { icon: CookingPot, label: 'Pasta / rice' },
  bean: { icon: Bean, label: 'Beans' },
  nut: { icon: Nut, label: 'Nuts' },
  popcorn: { icon: Popcorn, label: 'Snacks' },
  amphora: { icon: Amphora, label: 'Jar' },
  droplet: { icon: Droplet, label: 'Oil / sauce' },
  apple: { icon: Apple, label: 'Apple' },
  banana: { icon: Banana, label: 'Banana' },
  citrus: { icon: Citrus, label: 'Citrus' },
  cherry: { icon: Cherry, label: 'Berries' },
  grape: { icon: Grape, label: 'Grapes' },
  avocado: { icon: Avocado, label: 'Avocado' },
  carrot: { icon: Carrot, label: 'Carrot' },
  broccoli: { icon: Broccoli, label: 'Broccoli' },
  'leafy-green': { icon: LeafyGreen, label: 'Greens' },
  salad: { icon: Salad, label: 'Salad' },
  sprout: { icon: Sprout, label: 'Mushroom / veg' },
  'spray-can': { icon: SprayCan, label: 'Cleaning' },
  'paper-bag': { icon: PaperBag, label: 'Bag' },
  package: { icon: Package, label: 'Other' },
  'shopping-bag': { icon: ShoppingBag, label: 'Shopping' },
}

/** Renders an item's icon by key; unknown keys fall back to a box. */
export function ItemIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = ITEM_ICONS[name]?.icon ?? Package
  return <Icon aria-hidden {...props} />
}
