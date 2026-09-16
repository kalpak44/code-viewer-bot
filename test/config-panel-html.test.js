const { getConfigPanelHtml } = require('../src/ui/config-panel-html');

const html = getConfigPanelHtml();

describe('the config panel document', () => {
    test('is a complete HTML document', () => {
        expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
        expect(html.trimEnd().endsWith('</html>')).toBe(true);
    });

    test('opens and closes the same number of the tags it nests', () => {
        const counts = ['html', 'head', 'body', 'script', 'style'].map((tag) => {
            const open = (html.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length;
            const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
            return [tag, open, close];
        });
        expect(counts.filter(([, open, close]) => open !== close)).toEqual([]);
    });

    test('is deterministic', () => {
        expect(getConfigPanelHtml()).toBe(html);
    });
});

describe('controls the panel script addresses', () => {
    // The inline script reads each of these by id. A control renamed in the markup but
    // not in the script fails silently in a webview, with no console anyone will read.
    const ids = [...html.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);

    test('the script queries at least the main controls', () => {
        expect(ids.length).toBeGreaterThan(5);
    });

    test('every id the script reads exists in the markup', () => {
        const missing = [...new Set(ids)].filter((id) => !html.includes(`id="${id}"`));
        expect(missing).toEqual([]);
    });
});

describe('webview messaging contract', () => {
    test('acquires the vscode api and announces itself', () => {
        expect(html).toContain('acquireVsCodeApi()');
        expect(html).toContain("command: 'ready'");
    });

    test('posts the commands the extension handles', () => {
        for (const command of ['ready', 'save']) {
            expect(html).toContain(`command: '${command}'`);
        }
    });
});
