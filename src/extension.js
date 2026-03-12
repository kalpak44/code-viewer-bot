const vscode = require('vscode');
const { createConfigStore } = require('./config/config-store');
const { createInstanceCoordinator } = require('./services/instance-coordinator');
const { createMouseBot } = require('./services/mouse-bot');
const { createConfigPanel } = require('./ui/config-panel');

let bot;
let configPanel;
let instanceCoordinator;

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
    instanceCoordinator = createInstanceCoordinator({
        extensionContext: context,
        logger,
        initialConfig,
        onChange: () => {
            if (bot) {
                bot.handleInstanceChange();
            }
        }
    });

    bot = createMouseBot({
        initialConfig,
        logger,
        instanceCoordinator,
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
        vscode.commands.registerCommand('codeViewerBot.openConfiguration', () => configPanel.show()),
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            bot.handleWorkspaceChange();
        }),
        {
            dispose() {
                bot.stop();
                if (instanceCoordinator) {
                    instanceCoordinator.stop().catch((error) => {
                        outputChannel.appendLine(`Instance coordinator stop failed: ${error.message}`);
                    });
                }
            }
        }
    );

    await instanceCoordinator.start();
    await bot.start();
};

const deactivate = () => {
    if (bot) {
        bot.stop();
    }
    if (instanceCoordinator) {
        instanceCoordinator.stop().catch(() => {});
    }
};

module.exports = {
    activate,
    deactivate
};
