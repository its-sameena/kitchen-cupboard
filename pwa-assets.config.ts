// App icons and iOS launch screens, generated from public/favicon.svg by `npm run icons`.
// After changing anything here, run `npm run icons`, delete public/splash/*landscape*, and make sure
// index.html links each portrait image (see docs/customising.md → Splash screen).
import { combinePresetAndAppleSplashScreens, defineConfig, minimal2023Preset, type AppleDeviceName } from '@vite-pwa/assets-generator/config'

/** Launch-screen background: keep in sync with --bg in src/theme.css and background_color in vite.config.ts. */
const SPLASH_BACKGROUND = '#f3f2ee'
/**
 * Logo size on the launch screen: 0.7 = the logo is 30% of the screen width.
 * The in-app loading screen (.boot-logo in src/styles.css) uses the same 30vw so the hand-off is seamless.
 */
const SPLASH_PADDING = 0.7

/** iPhones that run iOS 26 (the app's audience). Models with the same screen share one image. */
const DEVICES: AppleDeviceName[] = [
  'iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone Air', 'iPhone 17',
  'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16', 'iPhone 16e',
  'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
  'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
  'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 mini',
  'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 mini',
  'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11', 'iPhone SE 4.7"',
]

const icons = {
  ...minimal2023Preset,
  maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#141414' } },
  apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#141414' } },
}

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: combinePresetAndAppleSplashScreens(
    icons,
    {
      padding: SPLASH_PADDING,
      resizeOptions: { background: SPLASH_BACKGROUND, fit: 'contain' },
      linkMediaOptions: { log: true, addMediaScreen: true, basePath: '/', xhtml: false },
      // Landscape images are generated too; only the portrait ones are kept and linked (the app is portrait-only).
      name: (landscape, size) => `splash/apple-splash-${landscape ? 'landscape' : 'portrait'}-${size.width}x${size.height}.png`,
    },
    DEVICES,
  ),
  images: ['public/favicon.svg'],
})
