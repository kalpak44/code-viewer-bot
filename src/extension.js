const vscode = require('vscode');
const { createConfigStore } = require('./config/config-store');
const { createMouseBot } = require('./services/mouse-bot');
const { createConfigPanel } = require('./ui/config-panel');

let bot;
let configPanel;

const setBotContext = (runningState) => {
    vscode.commands.executeCommand('setContext', 'botRunning', runningState);
};

const createLogger = (outputChannel) => (message) => {
    outputChannel.appendLine(message);
};

const activate = async (context) => {
    const outputChannel = vscode.window.createOutputChannel('Code Viewer Bot');
    const configStore = createConfigStore(context);
    const logger = createLogger(outputChannel);
    const initialConfig = configStore.load();

    bot = createMouseBot({
        initialConfig,
        logger,
        onStateChange: (state) => {
            setBotContext(state.running);
            if (configPanel) {
                configPanel.postState();
            }
        }
    });

    configPanel = createConfigPanel({
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
};

const deactivate = () => {
    if (bot) {
        bot.stop();
    }
};

module.exports = {
    activate,
    deactivate
};
