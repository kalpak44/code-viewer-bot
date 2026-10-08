# Change Log

All notable changes to the "code-viewer-bot" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.1]

- Added a Content-Security-Policy to the configuration webview, with a per-session nonce
  on its inline script.
- Fixed the cross-window instance lease logging and re-emitting state on every 4-second
  heartbeat even when ownership hadn't changed, because the change check compared the
  full lease payload instead of just who owns it.
- Fixed disabling single-window coordination leaving a stale lock file on disk instead of
  releasing it, because `updateConfig` applied the new config before the release check
  that depends on the old one.
- Added full test coverage for the cross-window instance coordinator (previously
  untested), including the two bugs above and the lease handoff between two windows.

## [0.1.0]

- Fixed `robotjs` failing to load on every platform since 0.0.6: `.vscodeignore` dropped
  `node-gyp-build` and the `robotjs` native prebuilds from the packaged VSIX.
- Added `linux-arm64` and `win32-arm64` as built and published platform targets, for six total.
- Added a release-pipeline smoke test that loads `robotjs` from each packaged VSIX before
  it's accepted, so a packaging regression like the one above fails the build instead of shipping.
- Rewrote `README.md` for the Marketplace listing: Marketplace badges, a features summary,
  required OS permissions, a supported-platforms table, and a troubleshooting section.

## [0.0.5]

- Added `SECURITY.md` with the supported-version policy, private vulnerability reporting process, scope, and the extension's security model.
- Documented the two-stage release pipeline in `README.md`: automatic GitHub Release on push to `main`, followed by a manual Marketplace publish of those same artifacts.

## [0.0.4]

- Added a separate motion toggle so mouse movement can be enabled or disabled independently of workspace file rotation.

## [0.0.3]

- Added single-window coordination so the bot runs in only one VS Code window when multiple instances are open.
- Added instance visibility in the configuration panel to show which window is active and which window you are viewing.
