const crypto = require('node:crypto');
const vscode = require('vscode');
const { PANEL_TYPE } = require('../constants');
const { getConfigPanelHtml } = require('./config-panel-html');

// CSP script-src nonce. Freshly generated per panel so a leaked or guessed value from one
// webview session can't authorize a script tag in another.
const getNonce = () => crypto.randomBytes(16).toString('base64');

const createConfigPanel = ({ extensionContext, onSave, getState }) => {
    let panel = null;

    const postState = () => {
        if (!panel) {
            return;
        }

        panel.webview.postMessage({
            command: 'state',
            state: getState()
        });
    };

    const show = () => {
        if (panel) {
            panel.reveal(vscode.ViewColumn.One);
            postState();
            return;
        }

        panel = vscode.window.createWebviewPanel(
            PANEL_TYPE,
            'Code Viewer Bot',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        panel.webview.html = getConfigPanelHtml(getNonce());
        panel.onDidDispose(
            () => {
                panel = null;
            },
            null,
            extensionContext.subscriptions
        );

        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'ready':
                        postState();
                        return;
                    case 'save':
                        await onSave(message.config);
                        return;
                    default:
                        return;
                }
            },
            undefined,
            extensionContext.subscriptions
        );

        postState();
    };

    return {
        show,
        postState
    };
};

module.exports = {
    createConfigPanel
};
