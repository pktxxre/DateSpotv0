# Changelog

All notable changes to DateSpot are documented here.

## [0.1.2.0] - 2026-05-19

### Added
- Stack creation modal now includes a cover photo picker below the name field — tap to upload from your library; the selected image becomes the stack's cover photo
- Stacks without a cover photo now show a letter placeholder tile (first character of the stack name) in the tier list — styled with an orange tint border matching the New Stack button
- Occasion type (Romantic / Friend / Solo) is now a distinct field from activity type in the log flow, allowing both dimensions to be tracked independently
- Activity type gains new categories: Bars, Cafes, Indoors, and Shopping (replaces Drinks)
- Map screen pans to the newly saved pin location after a log is completed

### Changed
- Stack cover photo falls back to the first spot's photo if no stack-level photo is set, preserving existing behavior
- Seed venue type filter on the map now uses expanded categories matching the new activity type list

## [0.1.1.0] - 2026-05-17

### Added
- All Date Spots screen now shows a shimmer skeleton while spots load — chip rows, price filters, and spot rows all animate in sync
- Stack detail screen shows a horizontal photo strip of all photos from the selected visits, placed below the spots list
- Stack detail photo strip is edge-to-edge with rounded thumbnails

### Changed
- Compare step (logging flow) cards have fixed height so names, pills, and labels stay at consistent eye level across all comparison rounds
- Compare step rating pill now uses transparent background with colored border and text (matching the map view style)
- New spot in compare step shows a grey "?" pill before its first comparison, then updates live as ratings are assigned
- Stack list card removes the trash icon, creation date, and score — showing only name and spot journey
- Stack creation modal slides up without a dark overlay behind the card
- Stack detail hero removes the creation date; average rating pill switches to transparent background with colored border and text
- All Spots list truncates long venue names to a single line with ellipsis so row heights stay uniform

### Fixed
- Real category chips and price filter row are hidden during skeleton load, preventing overlap with skeleton UI

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
