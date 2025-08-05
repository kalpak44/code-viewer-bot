# Code Viewer Bot

A Visual Studio Code joke extension that cannot be used at the work ;)

## Features
- Run and stop the bot from the command palette or context menus.

## Installation
You can install the latest release from the [GitHub Releases page](https://github.com/kalpak44/code-viewer-bot/releases).

Or build from source:
```sh
npm install
npx vsce package
```
This will generate a `.vsix` file you can install in VS Code.

## Usage
- Open the command palette (Cmd+Shift+P or Ctrl+Shift+P) and search for "Run Bot" or "Stop Bot".
- Right-click in the explorer or editor for context menu options.

## Development
- Clone this repo
- Run `npm install`
- Make changes and run `npx vsce package` to build

## License
[MIT](LICENSE.md)