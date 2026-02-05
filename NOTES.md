Project Notes (Latest)

Service worker and updates
- `public/sw.js` caches the app shell and assets (stale-while-revalidate), and uses network-first for navigation.
- Updates are silent: the new worker skips waiting and a single reload happens on `controllerchange`.

Offline behavior
- Home page is accessible offline.
- Rankings show "Connection required" when offline or Firebase is unavailable.
- Login, New Game, and Arena actions use `useConnectionGate` to block actions and show `ConnectionModal`.
- Local storage is cleared if Firebase becomes unavailable to avoid stale data.
- `/arena` redirects to `/` when there is no active character and offline/unavailable.

UI tuning
- Arena header action buttons are larger and spaced more on mobile/tablet.
- Character creation layout tuned for mobile and small screens:
  - Small mobile overrides reduce stat density to avoid vertical scroll.
  - Action buttons are positioned to fill remaining space without forcing scroll.
  - Creation form uses `min-height: clamp(200px, 34vh, 340px)`.

Icons
- `public/icon.svg` matches the PNG icon style; Apple touch icons are in `public/`.

Known warnings (build)
- Sass emits deprecation warnings for `@import` and `darken()` in legacy usage.
