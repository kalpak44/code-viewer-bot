# Change Log

All notable changes to the "code-viewer-bot" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.5]

- Added `SECURITY.md` with the supported-version policy, private vulnerability reporting process, scope, and the extension's security model.
- Documented the two-stage release pipeline in `README.md`: automatic GitHub Release on push to `main`, followed by a manual Marketplace publish of those same artifacts.

## [0.0.4]

- Added a separate motion toggle so mouse movement can be enabled or disabled independently of workspace file rotation.

## [0.0.3]

- Added single-window coordination so the bot runs in only one VS Code window when multiple instances are open.
- Added instance visibility in the configuration panel to show which window is active and which window you are viewing.
