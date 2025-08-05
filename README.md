
# Code Viewer Bot

A Visual Studio Code joke extension that randomly opens files and moves the cursor.

## Features
- Run and stop the bot from the command palette or context menus.
- Press **Esc** to stop the bot immediately.

## Dependencies
- `@nut-tree-fork/nut-js` for smooth, human-like cursor movements.  
  Documentation: https://nutjs.dev/

## Installation
You can install the latest release from the [GitHub Releases page](https://github.com/kalpak44/code-viewer-bot/releases).

Or build from source:
```sh
npm install
npx @vscode/vsce package
```
This will generate a `.vsix` file you can install in VS Code.

## Usage
- **Run**: Open the command palette (Cmd+Shift+P or Ctrl+Shift+P) and search for "Run Bot" or use the explorer/editor context menu.
- **Stop**: Press **Escape**, or open the command palette and run "Stop Bot".

## Development
- Clone this repo
- Run `npm install`
- Make changes and run `npx @vscode/vsce package` to build

## License
[MIT](LICENSE.md)
