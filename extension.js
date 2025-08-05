const vscode = require('vscode');
const path = require('path');
const {mouse, screen, straightTo} = require('@nut-tree/nut-js');

let running = false;
let botExtension;
let files = [];

function setBotContext(runningState, ext) {
    vscode.commands.executeCommand('setContext', 'botRunning', runningState);
    vscode.commands.executeCommand('setContext', 'botFileExtension', ext);
}

async function moveCursorToRandomPosition() {
    try {
        // Get screen dimensions
        const width = await screen.width();
        const height = await screen.height();

        // Pick a random point on screen
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);

        // Move cursor in a smooth straight line
        await mouse.move(straightTo({x, y}));
    } catch (err) {
        vscode.window.showErrorMessage(`Cursor movement failed: ${err.message}`);
    }
}

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
        if (!files.length) {
            vscode.window.showErrorMessage(`No files found with extension ${botExtension}`);
            running = false;
            setBotContext(false);
            return;
        }

        while (running) {
            // Random delay between 15 and 30 seconds
            const delay = 15000 + Math.random() * 15000;
            await new Promise(res => setTimeout(res, delay));
            if (!running) break;

            // Close current editor
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

            // Open a random file
            const randomFile = files[Math.floor(Math.random() * files.length)];
            const doc = await vscode.workspace.openTextDocument(randomFile);
            await vscode.window.showTextDocument(doc, {preview: false});

            // Move the cursor
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

function activate(context) {
    setBotContext(false);

    const runCmd = vscode.commands.registerCommand('extension.runBot', runBotOnFile);
    const stopCmd = vscode.commands.registerCommand('extension.stopBot', () => {
        if (!running) {
            vscode.window.showWarningMessage('Bot isn\'t running.');
        }
        running = false;
    });

    context.subscriptions.push(runCmd, stopCmd);
}

function deactivate() {
    running = false;
    setBotContext(false);
}

module.exports = {activate, deactivate};
