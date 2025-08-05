const vscode = require('vscode');
const path = require('path');

let running = false;
let botExtension = undefined;
let files = [];
const INSERTED_LINE = '\n';

let lastEditedDocumentUri = null;
let lastEditUndo = null;

function setBotContext(runningState, ext) {
	vscode.commands.executeCommand('setContext', 'botRunning', runningState);
	vscode.commands.executeCommand('setContext', 'botFileExtension', ext);
}

async function runBotOnFile(fileUri) {
	if (running) {
		vscode.window.showWarningMessage('Bot is already running!');
		return;
	}

	if (!fileUri || !fileUri.fsPath) {
		vscode.window.showWarningMessage('Please right-click a file to start the Bot.');
		return;
	}

	botExtension = path.extname(fileUri.fsPath);
	setBotContext(true, botExtension);
	running = true;

	vscode.window.showInformationMessage(`Bot started for files with extension ${botExtension}`);

	try {
		files = await vscode.workspace.findFiles(`**/*${botExtension}`);
		if (files.length === 0) {
			vscode.window.showErrorMessage(`No files found with extension ${botExtension}`);
			running = false;
			setBotContext(false, undefined);
			return;
		}

		while (running) {
			// Random delay between 15 and 30 seconds
			const delayMs = Math.floor(Math.random() * (30000 - 15000 + 1)) + 15000;
			await new Promise(resolve => setTimeout(resolve, delayMs));

			if (!running) break;

			// Close the previously opened file
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

			// Pick a random file and show it
			const randomFile = files[Math.floor(Math.random() * files.length)];
			const document = await vscode.workspace.openTextDocument(randomFile);
			const editor = await vscode.window.showTextDocument(document, { preview: false });

			// Insert a single new line at the top (only if not already inserted)
			if (editor && document && document.lineCount > 0 && document.lineAt(0).text !== '') {
				await editor.edit(editBuilder => {
					editBuilder.insert(new vscode.Position(0, 0), INSERTED_LINE);
				});
				await document.save();
				lastEditedDocumentUri = document.uri.toString();
				lastEditUndo = async () => {
					const activeEditor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === lastEditedDocumentUri);
					if (activeEditor && activeEditor.document.lineAt(0).text === '') {
						await activeEditor.edit(editBuilder => {
							const line = activeEditor.document.lineAt(0);
							editBuilder.delete(line.rangeIncludingLineBreak);
						});
						await activeEditor.document.save();
					}
				};
			}
		}
		// Clean up inserted line if present
		if (lastEditUndo) {
			await lastEditUndo();
			lastEditUndo = null;
			lastEditedDocumentUri = null;
		}
	} catch (err) {
		vscode.window.showErrorMessage(`Error running bot: ${err.message}`);
	} finally {
		vscode.window.showInformationMessage('Bot stopped');
		running = false;
		botExtension = undefined;
		setBotContext(false, undefined);
	}
}

function activate(context) {
	setBotContext(false, undefined);

	let runBot = vscode.commands.registerCommand('extension.runBot', async (fileUri) => {
		runBotOnFile(fileUri);
	});

	let stopBot = vscode.commands.registerCommand('extension.stopBot', async () => {
		if (!running) {
			vscode.window.showWarningMessage('Bot is not running.');
			return;
		}
		running = false;
		if (lastEditUndo) {
			await lastEditUndo();
			lastEditUndo = null;
			lastEditedDocumentUri = null;
		}
		vscode.window.showInformationMessage('Bot stopped by user');
	});

	context.subscriptions.push(runBot, stopBot);
}

function deactivate() {
	running = false;
	setBotContext(false, undefined);
}

module.exports = {
	activate,
	deactivate
};
