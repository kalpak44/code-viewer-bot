# Security Policy

## Supported Versions

Code Viewer Bot is maintained as a single moving line. Only the latest published version receives security fixes.

| Version | Supported |
| --- | --- |
| Latest release (see [Releases](https://github.com/kalpak44/code-viewer-bot/releases)) | yes |
| Any older release | no |

If you are affected by an issue, upgrade to the latest release first. Fixes are shipped as a new version through the normal release pipeline described in the [README](./README.md#release-pipeline): a version bump on `main` produces a GitHub Release with platform VSIX files, followed by a manual Marketplace publish.

## Reporting a Vulnerability

Please do not open a public issue or pull request for a suspected vulnerability.

Report it privately using GitHub's private vulnerability reporting:

1. Go to the [Security tab](https://github.com/kalpak44/code-viewer-bot/security/advisories) of this repository.
2. Choose `Report a vulnerability`.
3. Include the details listed below.

Helpful details to include:

- affected extension version and installed VSIX target, for example `darwin-arm64`
- operating system and VS Code version
- a description of the issue and its impact
- reproduction steps, or a minimal configuration that triggers it
- any logs or stack traces, with local paths redacted if needed

### What to Expect

- acknowledgement of the report within 7 days
- an initial assessment, including whether the report is accepted as a vulnerability, within 14 days
- for accepted reports, a fix in a following release, coordinated with you on disclosure timing
- credit in the release notes and advisory, unless you prefer to stay anonymous

This is a small, volunteer-maintained project. There is no bug bounty, and response times are best effort.

## Scope

In scope:

- the extension source in [`./src`](./src) and the bundled output it produces
- the configuration webview panel and how it handles persisted configuration
- workspace file scanning and file-opening behavior
- the build, release, and publish workflows in [`./.github/workflows`](./.github/workflows)
- the [`./scripts/postinstall.js`](./scripts/postinstall.js) install hook

Out of scope:

- vulnerabilities in third-party dependencies with no exploitable path through this extension; report those upstream. Dependency updates are tracked by Dependabot, configured in [`./.github/dependabot.yml`](./.github/dependabot.yml)
- vulnerabilities in VS Code itself, or in the Visual Studio Marketplace; report those to Microsoft
- issues that require an already-compromised machine or an attacker who can already write to the user's VS Code configuration
- the intended behavior of the extension, described below

## Security Model and Intended Behavior

Some capabilities of this extension look alarming out of context. They are intentional, user-controlled, and not vulnerabilities in themselves:

- **Native input control.** The extension depends on `robotjs` to move the mouse pointer. This requires OS-level accessibility or input-control permissions on some platforms, and those permissions are granted by the user.
- **Native module build at install time.** The `postinstall` hook builds native code for `robotjs`, which requires platform build tooling. This runs when you install dependencies from source.
- **Workspace file reading.** When workspace browsing is enabled, the extension scans and opens files in the currently open workspace. It only opens text-like files and skips files it detects as binary. It does not transmit file contents anywhere.
- **No network activity.** The extension performs no outbound network requests, sends no telemetry, and does not collect usage data. Configuration is stored locally through VS Code's own storage.

A report is in scope if it shows the extension exceeding this model, for example: sending data off the machine, executing content from a scanned workspace file, escalating privileges, reading paths outside the open workspace and configured excludes, or letting untrusted input reach the webview or a shell.

## Verifying a Download

Every platform VSIX is built by GitHub Actions and attached to the matching GitHub Release. The Marketplace publish step uploads those same artifacts without rebuilding them, so a Marketplace install and the corresponding release asset are the same build.

If you install a `.vsix` manually, download it only from the [Releases page](https://github.com/kalpak44/code-viewer-bot/releases) of this repository, and check that the release tag matches the version you expect.