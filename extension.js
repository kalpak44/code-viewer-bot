const vscode = require('vscode');
const path = require('path');
const { mouse, screen, straightTo } = require('@nut-tree-fork/nut-js');

let running = false;
let botExtension;
let files = [];

/**
 * Update VS Code context keys for menu/keyboard toggles
 */
function setBotContext(runningState, ext) {
    vscode.commands.executeCommand('setContext', 'botRunning', runningState);
    vscode.commands.executeCommand('setContext', 'botFileExtension', ext);
}

/**
 * Move the cursor to a random point on screen.
 */
async function moveCursorToRandomPosition() {
    try {
        const width = await screen.width();
        const height = await screen.height();

        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);

        await mouse.move(straightTo({ x, y }));
    } catch (err) {
        vscode.window.showErrorMessage(`Cursor movement failed: ${err.message}`);
    }
}

/**
 * Main loop: close editor, open random file, move cursor.
 */
async function runBotOnFile(fileUri) {
    if (running) {
        vscode.window.showWarningMessage('Bot is already running!');
        return;
    }

    if (!fileUri?.fsPath) {
        vscode.window.showWarningMessage('Right-click a file to start the Bot.');
        return;
    }

    botExtension = path.extname(fileUri.fsPath);
    setBotContext(true, botExtension);
    running = true;

    vscode.window.showInformationMessage(`Bot started for *${botExtension}* files`);

    try {
        files = await vscode.workspace.findFiles(`**/*${botExtension}`);
        if (files.length === 0) {
            vscode.window.showErrorMessage(`No files found with extension ${botExtension}`);
            running = false;
            setBotContext(false);
            return;
        }

        while (running) {
            // Wait 15–30 seconds
            const delay = 15000 + Math.random() * 15000;
            await new Promise(res => setTimeout(res, delay));
            if (!running) break;

            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

            const randomFile = files[Math.floor(Math.random() * files.length)];
            const doc = await vscode.workspace.openTextDocument(randomFile);
            await vscode.window.showTextDocument(doc, { preview: false });

            await moveCursorToRandomPosition();
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Bot error: ${err.message}`);
    } finally {
        vscode.window.showInformationMessage('Bot stopped');
        running = false;
        setBotContext(false);
    }
}

/**
 * Extension activation: register commands.
 */
function activate(context) {
    setBotContext(false);

    const runCmd = vscode.commands.registerCommand('extension.runBot', runBotOnFile);
    const stopCmd = vscode.commands.registerCommand('extension.stopBot', () => {
        if (!running) {
            vscode.window.showWarningMessage('Bot isn’t running.');
        }
        running = false;
    });

    context.subscriptions.push(runCmd, stopCmd);
}

function deactivate() {
    running = false;
    setBotContext(false);
}

module.exports = { activate, deactivate };
