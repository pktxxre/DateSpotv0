# Changelog

All notable changes to DateSpot are documented here.

## [0.1.0.0] - 2026-05-08

### Added
- Full app scaffold: Expo SDK 54, Apple Maps (react-native-maps), SQLite local storage
- Map screen with live pin colours, FAB log button, and tap-to-detail callout
- Log flow (5-step bottom sheet): location pin drop, venue name, activity type, price, ranking, notes, and photos
- Beli-style pairwise ranking engine — triage new spot against existing spots, produces 0.1–10.0 rating
- Photo upload to Supabase Storage with lazy-require expo-image-picker (works in Expo Go and compiled binary)
- Home screen with Favorites tab (top 3 per category with full-bleed banner images) and All Spots tab (sort by date / best / worst)
- Category banner images for food, drinks, outdoors, pretty view, entertainment, and other
- Spot detail screen with photos, rating pill, mini-map widget, edit and delete actions
- Profile screen with avatar, username, bio, and edit flow
- Settings screen (change email/phone/password, privacy, log out, delete account)
- Unified color system via `lib/theme.ts` replacing per-screen color objects
- Draft persistence: in-progress log flow survives app backgrounding via AsyncStorage
- Supabase Storage integration for photo upload and deletion

### Fixed
- `friendlyDate` now parses dates as local time, preventing wrong Today/Yesterday in UTC-west timezones
- `openLog` deep-link param now fires only once per navigation (useRef latch prevents sheet re-opening on tab refocus)
- Settings back button touch area covers the full circle (removed absolutelypositioned title intercepting touches)
- expo-image-picker loaded via lazy require to prevent route crash when native pod not compiled
- Activity chip background and photo icon alignment in log details step

### Changed
- Culture removed from activity type options; spots are now categorised as food, drinks, outdoors, view, entertainment, or other
