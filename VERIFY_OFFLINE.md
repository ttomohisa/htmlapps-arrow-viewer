# Offline verification

1. Build `dist/index.html`.
2. Open browser DevTools > Network and enable Preserve log.
3. Open `dist/index.html` directly and load one or more test `.arrow`, `.arrows`, or `.ipc` files.
4. Verify that no HTTP(S), WebSocket, EventSource, or external font/image requests are made.
5. Confirm the document CSP contains `connect-src 'none'`.
