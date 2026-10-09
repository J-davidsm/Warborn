Cross-platform Warborn desktop release.

- Windows: download `Warborn-win-x64.exe` and run the installer. Windows on ARM uses x64 emulation.
- Ubuntu/Debian: download the `.deb` matching your CPU (`amd64` = Intel/AMD; `arm64` = ARM), then run `sudo apt install ./Warborn-linux-ARCH.deb`.
- macOS: download the `mac` ZIP matching your CPU (`arm64` = Apple Silicon; `x64` = Intel), extract it and move Warborn to Applications.

These are independent unsigned/not-notarized releases, not Microsoft/Apple Store releases. Windows SmartScreen or macOS Gatekeeper may request approval. Do not disable system-wide security protections.

For the auto-selecting terminal installer and source-build instructions, see [Desktop installation](https://github.com/J-davidsm/Warborn/blob/main/docs/desktop-install.md).

All packages include the same game and online lobby. Existing saves remain in the app's user data. Export important scenarios before moving between computers: installing the game does not transfer saves.

## Validation for v1.1.0

Built locally with official Electron runtimes. The 51 game/packaging regression checks pass, packaged runtime files were compared against source, and Mac startup was tested. Native Windows and Ubuntu runtime tests remain unverified: GitHub refused to start their runners because the repository owner’s account is locked due to a billing issue. The workflow is configured to run those tests once that account issue is resolved.
