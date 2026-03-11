const vscode = require('vscode');
const { PANEL_TYPE } = require('../constants');
const { getConfigPanelHtml } = require('./config-panel-html');

class ConfigPanel {
    constructor({ extensionContext, onSave, getState }) {
        this.extensionContext = extensionContext;
        this.onSave = onSave;
        this.getState = getState;
        this.panel = null;
    }

    show() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            this.postState();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            PANEL_TYPE,
            'Code Viewer Bot',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = getConfigPanelHtml();
        this.panel.onDidDispose(() => {
            this.panel = null;
        }, null, this.extensionContext.subscriptions);

        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'ready':
                    this.postState();
                    return;
                case 'save':
                    await this.onSave(message.config);
                    vscode.window.showInformationMessage('Bot configuration saved.');
                    return;
                default:
                    return;
            }
        }, undefined, this.extensionContext.subscriptions);

        this.postState();
    }

    postState() {
        if (!this.panel) {
            return;
        }

        this.panel.webview.postMessage({
            command: 'state',
            state: this.getState()
        });
    }
}

module.exports = {
    ConfigPanel
};
