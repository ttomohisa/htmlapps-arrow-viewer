# Arrow Viewer — App Specification

Version: v1.0.1

## Purpose

Open Apache Arrow IPC File / Stream inputs locally and inspect their schema, metadata, record batches, dictionaries, and rows without uploading files.

## v1.0.1 scope

- Open one or more `.arrow`, `.arrows`, or `.ipc` files.
- Detect Arrow IPC File and Arrow IPC Stream containers.
- Show row count, root fields, record batch count, dictionary count, file size, metadata version, endianness, and metadata.
- Show schema as a hierarchical tree or raw JSON.
- Show record batch row counts, metadata/body sizes, and offsets.
- Preview rows with 50 / 100 / 250 / 500 / 1,000 rows per page.
- Read only record batches needed for the current page and keep a small recent-batch cache.
- Table / Record views, visible-column selection, current-page sorting, and Cell Inspector.
- Sortable column headers are native keyboard-operable buttons. Activate repeatedly to cycle ascending, descending, and source order; expose the active direction with `aria-sort`.
- Show a localized current-page sort summary and Clear sort in both Table and Record views, including when the sorted column is hidden. Clearing sort restores source order without reading another batch.
- Declared decimal columns (including dictionary-encoded decimals) sort by exact signed coefficients at their common scale, without Number conversion. Nulls remain last and equal values preserve source order; displayed and exported decimal strings are unchanged. Ordinary text and composite sorting retain their existing behavior.
- Compare complete binary/nested values rather than abbreviated previews. Prepare each comparison key once per sort, preserve exact primitive Number/BigInt comparisons, keep nulls last in both directions, and keep ties in source order.
- Sorting is page-local and per file. Page/page-size changes clear it; switching views, hiding columns, changing language, and returning to a loaded tab preserve it. Stale header callbacks cannot sort a newer page or another file.
- Decode common primitive values, timestamps, List / Struct nested values, and dictionary-encoded fields used by the included fixtures.
- Copy or save only the successfully loaded current page as CSV. Disable and guard both actions while the selected page is unread, loading, or failed; a successful empty page may export headers.
- A newer page/page-size read owns rows, loading, errors, and export readiness. Discard older completions and prevent closed files from committing inspection, page, dictionary, or batch-cache results.
- Preserve successfully loaded background tabs, per-file filenames, visible-column order, and current-page sorting.
- Copy schema only when that file has a parsed header, even if its row read is still pending or has failed.
- CSV, Cell Inspector/copy, and expanded records retain complete binary bytes in space-separated lowercase hexadecimal, including nested values. BigInt values serialize as decimal strings. Only compact table/record summaries abbreviate binary values.
- Register all supported files before inspecting them during multi-file selection/drop, so one invalid file does not prevent the rest from opening.
- Keep status, errors, overview, schema, metadata, record batches, dictionaries, and data scoped to each file tab; switching tabs must never show stale state from another file.
- Allow additional file drag and drop while files are already open.
- Japanese / English UI, responsive mobile bottom navigation, and multiple-file tabs.

## Non-goals for v1.0.1

- Editing or rewriting Arrow IPC files.
- Feather as an advertised supported format.
- LZ4 / ZSTD compressed IPC body-buffer decoding.
- SQL/query engine.
- Whole-file CSV export.

## Privacy

Runtime network access is blocked by CSP (`connect-src 'none'`). Selected files are read with browser file APIs and stay on the device.

## Page lifecycle acceptance criteria

- File inspection is pending / reading / ready / error and owned by the open file lifecycle.
- Page data is unread, loading, successful (including zero rows), or failed. Beginning a page read clears previous rows, errors, and export readiness.
- Closing a file invalidates in-flight work. Switching tabs does not invalidate a valid background read, but that read cannot repaint the active tab.
- Late clipboard completion cannot announce CSV success for a different file/page request.
- The normal build synchronizes the root `arrow-viewer.html` download; custom output builds leave it unchanged. Source, standalone, root, and self-extracted runtime behavior share the regression suite.

## Header consistency

- Use EN in Japanese UI and JA in English UI, with localized target-language accessible names and titles.
- Preserve 完全ローカル処理 / Fully local processing and localized Help labels/titles.
- Header versions use vMAJOR.MINOR.PATCH; existing responsive visibility is unchanged.
