/**
 * Food icons Lucide doesn't have, made to look like Lucide icons
 * (24×24, 2px round strokes), so they can be used like any other icon.
 *
 * - Tabler Icons (https://tabler.io/icons, MIT): same line style; they accept
 *   size / strokeWidth / className like Lucide icons do.
 * - Lucide Lab (https://github.com/lucide-icons/lucide-lab, ISC): Lucide's
 *   community icons, shipped as icon data.
 * - Drawn for this app: tomato, spice mill, cereal box. Edit the paths below
 *   (any SVG drawn on a 24×24 grid with strokes, no fills, works).
 */
import { garlic, onion } from '@lucide/lab'
import { IconPepper, IconSalt } from '@tabler/icons-react'
import { createLucideIcon, type LucideIcon } from 'lucide-react'

const fromTabler = (icon: unknown) => icon as LucideIcon

// Tabler
export const SaltShaker = fromTabler(IconSalt)
export const BellPepper = fromTabler(IconPepper)

// Lucide Lab
export const Garlic = createLucideIcon('garlic', garlic)
export const Onion = createLucideIcon('onion', onion)

// Drawn for this app
export const Tomato = createLucideIcon('tomato', [
  ['path', { d: 'M12 6.5c-5 0-9 3-9 7.25S7 21 12 21s9-3 9-7.25-4-7.25-9-7.25Z', key: 'body' }],
  ['path', { d: 'M12 6.5V2.5', key: 'stem' }],
  ['path', { d: 'm7.5 7.5 2 2.25L12 6.5l2.5 3.25 2-2.25', key: 'leaves' }],
])

export const SpiceMill = createLucideIcon('spice-mill', [
  ['path', { d: 'M12 2v2', key: 'knob' }],
  ['path', { d: 'M8 8a4 4 0 0 1 8 0Z', key: 'cap' }],
  ['path', { d: 'm8.5 8 1.5 4.5-1.8 7.4a.9.9 0 0 0 .9 1.1h5.8a.9.9 0 0 0 .9-1.1L14 12.5 15.5 8', key: 'body' }],
  ['path', { d: 'M10 12.5h4', key: 'band' }],
])

export const CerealBox = createLucideIcon('cereal-box', [
  ['rect', { x: '5', y: '2.5', width: '14', height: '19', rx: '1.5', key: 'box' }],
  ['path', { d: 'M5 7h14', key: 'flap' }],
  ['path', { d: 'M8 14.5h8a4 4 0 0 1-8 0Z', key: 'bowl' }],
  ['path', { d: 'M10 11.5h.01M12.5 10.5h.01M14 12h.01', key: 'flakes' }],
])
