# Code Viewer Bot

Code Viewer Bot is a Visual Studio Code extension that starts automatically after VS Code finishes launching, waits for user idle time, and then can:

- move the mouse in a small loop to keep activity going
- open files from the current workspace on a timed interval
- run only inside configured schedule windows

It is designed for local desktop use and depends on `robotjs` for native mouse control.

When multiple VS Code windows are open, the extension can coordinate so only one window owns execution at a time while the others remain in standby.

## What It Does

When the extension is active, it evaluates three conditions:

1. The current time must be inside an allowed schedule window.
2. The mouse must have been idle for at least the configured motion idle interval.
3. If workspace browsing is enabled, the mouse must remain idle for the separate workspace idle interval before file rotation starts.

Once those conditions are met, the extension can:

- move the cursor in a circular pattern
- browse files from the workspace using either:
  - the most common text-file extension in the workspace
  - a manually selected extension such as `.js` or `.ts`
- reuse the same editor tab or open files in new tabs

## Open the Configuration

Open the configuration panel in either of these ways:

- Command Palette: `Code Viewer Bot: Configure Bot`
- Shortcut on macOS: `⌘⌥B`
- Shortcut on Windows/Linux: `Ctrl+Alt+B`

### Step 1: Open the Command Palette

![Configuration command in the palette](docs/screenshots/command_palette_open.png)

### Step 2: Select the Extension Command

![Code Viewer Bot command option](docs/screenshots/configurations_palette_option.png)

### Step 3: Configure the Bot

![Extension configuration panel](docs/screenshots/extension_configurations.png)

## How To Configure It

The configuration panel is split into three areas.

It also shows two runtime identity fields at the top:

- `This window`: the current VS Code window identity
- `Active window`: the window that currently owns bot execution

### Motion

These settings control cursor movement after idle:

- `Move the mouse automatically while the bot is active`: enables or disables mouse motion without affecting workspace file rotation
- `Idle before motion (sec)`: how long the mouse must remain idle before cursor movement can start
- `Radius (px)`: the size of the circular movement
- `Speed (degrees)`: how many degrees are advanced on each rotation tick
- `Rotate interval (ms)`: how often the cursor position is updated
- `Poll interval (ms)`: how often the extension checks mouse state and schedule state
- `Tolerance (px)`: how much cursor drift is allowed before movement is treated as real user input

### Workspace

These settings control automatic file browsing:

- `Open workspace files automatically while the bot is active`: enables workspace file rotation
- `File source`:
  - `Use the most common extension`: automatically chooses the most common text-file extension in the workspace
  - `Use a specific extension`: rotates only files matching the chosen extension
- `Open behavior`:
  - `Reuse same tab`: closes the current active editor before opening the next file
  - `Open new tab`: keeps opening files in additional editor tabs
- `Idle before file browsing`: separate idle threshold before file browsing starts
- `Delay between file opens`: wait time between file transitions
- `Exclude glob`: paths to ignore while scanning the workspace

### Schedule

These settings control when the bot is allowed to run:

- `Only run inside scheduled windows`: enables schedule gating
- `Random offset (minutes)`: adds per-day jitter to each configured window start and end
- schedule windows: one or more start/end time ranges for the day

If schedule mode is enabled, the extension does nothing outside the generated daily schedule.

### Instance Control

- `Allow only one VS Code window to run the bot`: keeps one window active and places the others in standby

## Install From a Release

Install a packaged `.vsix` from the GitHub Releases page:

[GitHub Releases](https://github.com/kalpak44/code-viewer-bot/releases)

In VS Code:

1. Open `Extensions`
2. Click the `...` menu
3. Choose `Install from VSIX...`
4. Select the downloaded `.vsix`

## Build and Install Locally

### Prerequisites

- Node.js and npm
- VS Code
- native build prerequisites required by `robotjs`

Install dependencies:

```sh
npm install
```

Build the extension bundle:

```sh
npm run build
```

Package a local VSIX for Apple Silicon macOS:

```sh
npx @vscode/vsce package --target darwin-arm64
```

Other supported package targets:

- `linux-x64`
- `darwin-x64`
- `darwin-arm64`
- `win32-x64`

Install the packaged extension into local VS Code:

```sh
code --install-extension code-viewer-bot-darwin-arm64-0.0.1.vsix
```

Replace an existing local install:

```sh
code --install-extension code-viewer-bot-darwin-arm64-0.0.1.vsix --force
```

Remove the extension from local VS Code:

```sh
code --uninstall-extension kalpak44.code-viewer-bot
```

## Fast Local Development Flow

For extension development without packaging:

1. Open this repository in VS Code.
2. Press `F5`.
3. Test the extension inside the Extension Development Host window.

This is the fastest way to validate config changes and runtime behavior.

## Release Strategy

The repository includes a GitHub Actions release workflow in [`./.github/workflows/release.yml`](./.github/workflows/release.yml).

Current release process:

1. Update the version in [`./package.json`](./package.json) and update [`./CHANGELOG.md`](./CHANGELOG.md).
2. Commit the release changes and push them to the `main` branch.
3. GitHub Actions will read the version directly from `package.json`, convert it to a release tag such as `v0.0.3`, then:
   - create or reuse the matching GitHub Release
   - build platform-specific VSIX files for Linux, macOS Apple Silicon, macOS Intel, and Windows
   - upload those VSIX files to that release

Recommended release discipline:

- keep `CHANGELOG.md` current for every release
- bump `package.json` before the `main` push that should produce a release
- test the packaged VSIX locally before pushing the release commit
- if you push more commits to `main` without changing the version, the workflow will reuse the same GitHub Release and replace its VSIX assets

## Runtime Structure

Key files:

- runtime entrypoint: [`./src/extension.js`](./src/extension.js)
- config normalization and persistence: [`./src/config/config-store.js`](./src/config/config-store.js)
- core runtime behavior: [`./src/services/mouse-bot.js`](./src/services/mouse-bot.js)
- workspace file rotation: [`./src/services/workspace-navigator.js`](./src/services/workspace-navigator.js)
- schedule generation: [`./src/services/schedule-service.js`](./src/services/schedule-service.js)
- webview UI: [`./src/ui/config-panel.js`](./src/ui/config-panel.js)

## Notes

- The extension uses `robotjs`, so OS-level accessibility or input-control permissions may be required depending on the platform.
- Workspace browsing only opens text-like files and skips files that appear binary.
- If nothing happens, check the config panel status first: the bot may simply be outside the active schedule window or still waiting for the configured idle interval.

## License

[MIT](LICENSE.md)
