const vscode = require('vscode');
const { ConfigStore } = require('./config/config-store');
const { MouseBot } = require('./services/mouse-bot');
const { ConfigPanel } = require('./ui/config-panel');

let bot;
let configPanel;

function setBotContext(runningState) {
    vscode.commands.executeCommand('setContext', 'botRunning', runningState);
}

function createLogger(outputChannel) {
    return (message) => {
        outputChannel.appendLine(message);
    };
}

async function activate(context) {
    const outputChannel = vscode.window.createOutputChannel('Code Viewer Bot');
    const configStore = new ConfigStore(context);
    const logger = createLogger(outputChannel);
    const initialConfig = configStore.load();

    bot = new MouseBot({
        initialConfig,
        logger,
        onStateChange: (state) => {
            setBotContext(state.running);
            if (configPanel) {
                configPanel.postState();
            }
        }
    });

    configPanel = new ConfigPanel({
        extensionContext: context,
        onSave: async (config) => {
            const nextConfig = await configStore.save(config);
            await bot.updateConfig(nextConfig);
        },
        getState: () => bot.getState()
    });

    setBotContext(false);
    context.subscriptions.push(outputChannel);
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openConfig', () => configPanel.show()),
        {
            dispose() {
                bot.stop();
            }
        }
    );

    await bot.start();
}

function deactivate() {
    if (bot) {
        bot.stop();
    }
}

module.exports = {
    activate,
    deactivate
};
