# Verification — 2026-10-22

- Export: 181 files, approximately 48.87 MB uncompressed (previous whole web tree: 153.18 MB). Originals and desktop files excluded from the export.
- WebKit 27.2: cross-origin embedded tutorial, save/load, doctrine research, audio toggle, invite URL and viewport resizing passed; no missing assets or uncaught script errors.
- Cold startup on local HTTP: 1.64 seconds. Shared 10 Mbps / 100 ms simulated request latency: 42.59 seconds. This is still a substantial slow-connection wait: all gameplay/menu artwork and music are intentionally loaded before play, per the existing design.
- Multiplayer deterministic regressions passed: recruitment by host and guest, large state messages, reconnects and reloads, 3/4-player synchronization, victory/defeat. These are simulated transport tests, not physical separate-network tests.
- Native Safari WebDriver refused to create a session because Allow remote automation is disabled. WebKit is not labelled Safari certification.
- Chrome for Testing 156.0.8078.4: all embedded checks passed, 3.41-second local cold startup. The test fixture grants loopback access and uses a larger HTTP connection queue; these fix test-host restrictions, not game code. Local Firefox could not open its temporary profile. GitHub's clean Linux browser matrix provides a separate reproducible check; see workflow results rather than treating workflow creation as a pass.
- Native fullscreen transitions, audible playback, restricted third-party browser storage, and real two-network matches still need external sign-off in QA-checklist.md.

No storefront submission is performed by these scripts. The GitHub Pages version remains the public fallback for embedded invite links.
