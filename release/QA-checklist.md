# Portal release verification

Run `npm run build:web`, then ZIP the contents of `dist/web` (index.html at ZIP root).
The exporter uses the actual startup asset catalog, not the entire assets directory.
Original artwork remains in the repository; no originals or saves are deleted.

## Reproducible browser checks
Install Playwright in a test environment and its browser engines. Start `python3 -m http.server 8878 --bind 127.0.0.1 --directory dist/web`.
Run `PLAYWRIGHT_MODULE=/path/to/playwright node scripts/test-web-release.cjs webkit` (or chromium/firefox).
The harness embeds port 8878 in a port 8877 parent on 127.0.0.1, exercising a cross-origin frame.
For a cold bandwidth-limited run, start `python3 scripts/serve-web-test.py --slow` and append `--slow` to the browser test. The server shares 10 Mbps among all transfers with 100 ms delay per request. This is simulated bandwidth, not a physical mobile network.

## Required external sign-off
- Test native Chrome, Edge, Firefox, and Safari on the actual unpublished portal page.
- Test browser fullscreen entry/exit as well as window resizing.
- Confirm audible music/effects after a real click, mute, backgrounding, and return.
- Connect two computers on different networks (for example broadband and a phone hotspot).
- Join by room code and by the generated invite; agree to settings and generate a battle.
- Have the second player buy each unit type, pass turns, reconnect after a short network loss, and finish a match. Repeat with four players.
- Verify the resulting save can be loaded after closing and reopening that portal page.

The automated multiplayer suite uses simulated PeerJS transport. It does not certify public relay availability, restrictive NAT/firewall traversal, or separate real networks.
Portal invites intentionally open the public Acadania website, where the same room can be joined. They do not point at a portal's internal asset CDN. A portal-native invite API can replace that fallback in a dedicated integration.
