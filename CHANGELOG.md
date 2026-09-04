# Changelog

## v1.0.0 - 2026-09-04

- First stable release.
- Finalize the shared Data Viewer-series UI and per-file tab state handling.
- Verify multi-file loading, invalid-file isolation, paging, Cell Inspector, CSV export, Japanese/English UI, and mobile layout.
- Finalize the Browser Kitty `#16624F` labeled-file + magnifier SVG icon and favicon.
- Refresh release documentation and Japanese/English screenshots.

## v0.1.6
- redesign the Viewer icon as a labeled file with a magnifying glass
- use Browser Kitty primary color `#16624F` for the app icon and favicon
- keep the header icon and `assets/favicon.svg` visually consistent

## v0.1.5
- update the app icon and favicon to make the file type easier to recognize
- add a viewer-style magnifier motif while keeping the Browser Kitty look

## 0.1.4

- Align long filename and close-button accessibility with the other Data Viewer apps.
- Translate remaining Japanese metadata and record-batch labels and align footer privacy wording.
- Remove patch-version-specific wording from help text.

## 0.1.3

- Scope the status banner to the active file tab so an invalid file error does not remain visible when switching to a valid file.
- Track per-file inspection state and progress while multiple Arrow files are being inspected.
- Keep data-preview errors associated with the file that produced them.

## 0.1.2

- Fix multi-file selection and drag and drop so every supported Arrow IPC file is registered before inspection starts.
- Isolate file inspection failures so one invalid file does not stop the remaining files from opening.
- Fix the missing `escapeHtml` helper that could stop processing after the first file.
- Accept additional drag and drop anywhere on the app after files are already open.
- Correct Arrow Viewer repository documentation that still contained Avro Viewer text.

## 0.1.1

- Fix data table and CSV rendering by restoring the missing `visibleFields` helper.
- Prevent valid Arrow IPC fixtures from being misreported as invalid due to that UI runtime error.

## 0.1.0

- Initial Arrow IPC File / Stream viewer.
- Added schema tree/raw views, metadata, record batch and dictionary information, paginated preview, Cell Inspector, and CSV export.
- Added local decoding for the Arrow types used by the included IPC fixtures.
