const vscode = require('vscode');
const path = require('path');
const robot = require('robotjs');

let running = false;
let botExtension = undefined;
let files = [];

function setBotContext(runningState, ext) {
	vscode.commands.executeCommand('setContext', 'botRunning', runningState);
	vscode.commands.executeCommand('setContext', 'botFileExtension', ext);
}

async function moveCursorToRandomPosition() {
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
			await vscode.window.showTextDocument(document, { preview: false });
			
			// Move cursor to random position with human-like speed
			await moveCursorToRandomPosition();
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

	let stopBot = vscode.commands.registerCommand('extension.stopBot', () => {
		if (!running) {
			vscode.window.showWarningMessage('Bot is not running.');
			return;
		}
		running = false;
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
