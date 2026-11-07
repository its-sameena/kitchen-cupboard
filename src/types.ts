export type CategoryId =
  | 'spices'
  | 'dairy'
  | 'cold'
  | 'frozen'
  | 'drinks'
  | 'baking'
  | 'coffee'
  | 'cereals'
  | 'grains'
  | 'canned'
  | 'sauces'
  | 'snacks'
  | 'produce'
  | 'other'

import type { AvatarConfig } from './avatar'

export interface User {
  id: string
  name: string
  color: string
  /** DiceBear sprouts avatar; undefined = show initials. */
  avatar?: AvatarConfig
  /** Timestamp of the newest event this user has seen. */
  seenAt: number
  createdAt: number
}

export interface Item {
  id: string
  name: string
  /** Icon key from ITEM_ICONS in src/icons.tsx. */
  icon: string
  category: CategoryId
  /** Users who currently have this item in the kitchen. Length = the "xN" count. */
  owners: string[]
  createdBy: string
  updatedAt: number
}

export interface GroceryEntry {
  id: string
  name: string
  icon: string
  category: CategoryId
  /** Cupboard item this entry restocks, if any. */
  itemId?: string
  addedBy: string
  /** Who wants it (set when requested during a grocery run). */
  forUser?: string
  /** Set when the entry was requested during a specific run. */
  runId?: string
  /** Ticked off by a shopper, waiting for the run to finish. */
  gotBy?: string
  addedAt: number
}

export interface GroceryRun {
  id: string
  shopperId: string
  store: string
  startedAt: number
  endedAt?: number
}

export type EventType =
  | 'run_started'
  | 'run_ended'
  | 'request'
  | 'out_of_stock'
  | 'restocked'
  | 'joined'

export interface KitchenEvent {
  id: string
  type: EventType
  actorId: string
  /** Only these users are notified. Omit to notify everyone except the actor. */
  targets?: string[]
  title: string
  body: string
  at: number
}

export interface KitchenState {
  kitchenId: string
  kitchenName: string
  inviteCode: string
  users: User[]
  items: Item[]
  grocery: GroceryEntry[]
  runs: GroceryRun[]
  events: KitchenEvent[]
  feedback: Feedback[]
}

export type FeedbackKind = 'bug' | 'idea' | 'other'
export type FeedbackStatus = 'new' | 'planned' | 'in_progress' | 'done' | 'wont_do'

export interface Feedback {
  id: string
  memberId?: string
  memberName: string
  kind: FeedbackKind
  message: string
  status: FeedbackStatus
  reply?: string
  editedAt?: number
  createdAt: number
  updatedAt: number
}
