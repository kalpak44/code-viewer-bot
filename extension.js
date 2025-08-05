const vscode = require('vscode');
const path = require('path');
const robot = require('robotjs');

let running = false;
let botExtension = undefined;
let files = [];

function setBotContext(runningState, ext) {
	try {
		vscode.commands.executeCommand('setContext', 'botRunning', runningState);
		vscode.commands.executeCommand('setContext', 'botFileExtension', ext);
	} catch (err) {
		vscode.window.showWarningMessage(`Failed to set bot context: ${err.message}`);
	}
}

async function moveCursorToRandomPosition() {
	try {
		// Get screen size
		const screenSize = robot.getScreenSize();
		
		// Generate random coordinates within screen bounds
		const x = Math.floor(Math.random() * screenSize.width);
		const y = Math.floor(Math.random() * screenSize.height);
		
		// Get current cursor position
		const currentPos = robot.getMousePos();
		
		// Move cursor smoothly with human-like speed
		const steps = 20; // Number of steps for smooth movement
		const stepDelay = 50; // 50ms between steps for realistic speed
		
		for (let i = 0; i <= steps; i++) {
			const progress = i / steps;
			const newX = currentPos.x + (x - currentPos.x) * progress;
			const newY = currentPos.y + (y - currentPos.y) * progress;
			
			robot.moveMouse(Math.round(newX), Math.round(newY));
			await new Promise(resolve => setTimeout(resolve, stepDelay));
		}
	} catch (err) {
		vscode.window.showErrorMessage(`Failed to move cursor: ${err.message}`);
		throw err; // Re-throw to be handled by caller
	}
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
		try {
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		} catch (err) {
			vscode.window.showWarningMessage(`Failed to close active editor: ${err.message}`);
		}

		// Pick a random file and show it
		try {
			const randomFile = files[Math.floor(Math.random() * files.length)];
			const document = await vscode.workspace.openTextDocument(randomFile);
			await vscode.window.showTextDocument(document, { preview: false });
		} catch (err) {
			vscode.window.showErrorMessage(`Failed to open file: ${err.message}`);
			continue; // Skip this iteration and try the next file
		}
		
		// Move cursor to random position with human-like speed
		try {
			await moveCursorToRandomPosition();
		} catch (err) {
			vscode.window.showWarningMessage(`Failed to move cursor: ${err.message}`);
			// Continue running even if cursor movement fails
		}
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
	try {
		console.log('Code Viewer Bot extension is now active!');
		
		setBotContext(false, undefined);

		let runBot = vscode.commands.registerCommand('extension.runBot', async (fileUri) => {
			try {
				console.log('Run Bot command executed with fileUri:', fileUri);
				await runBotOnFile(fileUri);
			} catch (err) {
				vscode.window.showErrorMessage(`Failed to run bot: ${err.message}`);
			}
		});

		let stopBot = vscode.commands.registerCommand('extension.stopBot', () => {
			try {
				console.log('Stop Bot command executed');
				if (!running) {
					vscode.window.showWarningMessage('Bot is not running.');
					return;
				}
				running = false;
				vscode.window.showInformationMessage('Bot stopped by user');
			} catch (err) {
				vscode.window.showErrorMessage(`Failed to stop bot: ${err.message}`);
			}
		});

		context.subscriptions.push(runBot, stopBot);
		
		console.log('Commands registered successfully');
		vscode.window.showInformationMessage('Code Viewer Bot extension activated successfully!');
	} catch (err) {
		vscode.window.showErrorMessage(`Failed to activate extension: ${err.message}`);
	}
}

function deactivate() {
	running = false;
	setBotContext(false, undefined);
}

module.exports = {
	activate,
	deactivate
};
