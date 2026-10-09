# Install Warborn

The easiest method is [GitHub Releases](https://github.com/J-davidsm/Warborn/releases/latest): Windows installer, Ubuntu `.deb`, or Mac ZIP. No developer tools are needed for manual downloads.

## One terminal workflow for all three systems

Install Git and Node.js 22 LTS or newer first. Then run these commands in Terminal (Mac/Ubuntu) or PowerShell (Windows):

```sh
git clone https://github.com/J-davidsm/Warborn.git
cd Warborn
node scripts/install.cjs
```

The installer detects OS and CPU, downloads the latest **published desktop release**, verifies SHA-256 against its release manifest, and launches the appropriate installer. It does not compile the game. Quit Warborn before updating. Windows opens the normal installation wizard; Ubuntu uses `sudo apt-get` to install dependencies; Mac replaces an existing `/Applications/Warborn.app` or installs in `~/Applications`.

To update later, from the same checkout:

```sh
git pull --ff-only
node scripts/install.cjs
```

Pulling `main` does not guarantee a newer desktop release: automated releases are published only after all platform builds pass. See each release’s validation notes for locally built releases. Saves are preserved but are local to each computer. Export/import scenarios to move them.

Supported packages: Mac Intel/Apple Silicon; Ubuntu/Debian x64/ARM64; Windows x64 (Windows on ARM through x64 emulation). This does not support phones, Chromebooks, 32-bit PCs, or every Linux distribution. Windows ARM emulation is not a native ARM build.

## Build the current source instead

```sh
npm ci
npm test
npm run test:desktop
npm run dist
```

Output is in `dist/`; install the resulting `.exe`, `.deb`, or Mac ZIP. `npm start` runs the checkout directly without installing it. Linux development needs graphical libraries and a desktop session. CI uses Xvfb for its startup check. Do not run the game as root or disable its sandbox.

## Publishing updates

The Desktop builds GitHub Action runs on a `v*` tag or manual dispatch. It tests and packages on Windows, Ubuntu x64/ARM64 and Mac Intel/ARM64. Only successful tagged builds publish a release and checksums. Manual runs produce downloadable Actions artifacts without publishing.

Update `package.json` version and the lockfile, commit, then push a matching tag, for example `v1.1.0`. Published versions/tags must be unique.

## App stores

Warborn is not listed in the Mac App Store, Microsoft Store or Snap Store. Those require publisher accounts, store-specific packaging, and approval; Apple distribution also requires signing/provisioning. GitHub Releases is the available installation route. Unsigned Windows and non-notarized Mac downloads can display OS security prompts. Store signing can be added later without changing game rules.
