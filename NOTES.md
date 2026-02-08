Project Notes (Latest)

Service worker and updates
- `public/sw.js` caches the app shell and assets (stale-while-revalidate), and uses network-first for navigation.
- Updates are silent: the new worker skips waiting and a single reload happens on `controllerchange`.
- Current SW version is `v3` (bumped to force cache refresh).

Offline behavior
- Home page is accessible offline.
- Rankings show "Connection required" when offline or Firebase is unavailable.
- Login, New Game, and Arena actions use `useConnectionGate` to block actions and show `ConnectionModal`.
- Arena is accessible offline in read-only mode using the last synced snapshot; fights are disabled and a warning banner is shown.
- Local storage is kept on Firebase/network errors to allow offline snapshots; it's cleared only on logout, corrupted data, or missing server record.
- `/arena` redirects to `/` when there is no active character and offline/unavailable.
- Daily reset is gated by a loading screen to avoid stat “flash” when energy resets.

UI tuning
- Arena header action buttons are larger and spaced more on mobile/tablet.
- Arena has an Inventory modal (backpack icon) with a responsive grid of empty slots.
- Character creation layout tuned for mobile and small screens:
  - Small mobile overrides reduce stat density to avoid vertical scroll.
  - Action buttons are positioned to fill remaining space without forcing scroll.
  - Creation form uses `min-height: clamp(200px, 34vh, 340px)`.

Icons
- `public/icon.svg` matches the PNG icon style; Apple touch icons are in `public/`.
- `PixelIcon` includes a backpack icon for the Inventory button.

Known warnings (build)
- Sass deprecations resolved: `@import` replaced with `meta.load-css`, `darken()` replaced with `color.adjust`, Vite Sass API set to `modern`.
- Bundle size warning resolved via Rollup `manualChunks`; routes are lazy-loaded with prefetch on Login/Character creation.
