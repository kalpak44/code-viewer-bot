const getConfigPanelHtml = () => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Code Viewer Bot</title>
    <style>
        :root {
            color-scheme: light dark;
        }

        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: linear-gradient(180deg, var(--vscode-editor-background) 0%, color-mix(in srgb, var(--vscode-editor-background) 85%, var(--vscode-focusBorder) 15%) 100%);
        }

        .shell {
            max-width: 880px;
            margin: 0 auto;
            display: grid;
            gap: 16px;
        }

        .card {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 12px;
            padding: 16px;
            background: color-mix(in srgb, var(--vscode-editorWidget-background) 88%, transparent);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
        }

        h1, h2 {
            margin: 0 0 12px;
            font-weight: 700;
        }

        h1 {
            font-size: 24px;
        }

        h2 {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--vscode-descriptionForeground);
        }

        p {
            margin: 0;
            color: var(--vscode-descriptionForeground);
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
        }

        label {
            display: grid;
            gap: 6px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        input, button {
            font: inherit;
        }

        input[type="number"],
        input[type="time"] {
            padding: 8px 10px;
            border-radius: 8px;
            border: 1px solid var(--vscode-input-border, transparent);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }

        .toggle {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .windows {
            display: grid;
            gap: 10px;
            margin-top: 12px;
        }

        .window-row {
            display: grid;
            grid-template-columns: minmax(120px, 1fr) minmax(120px, 1fr) auto;
            gap: 10px;
            align-items: end;
        }

        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        button {
            border: 0;
            border-radius: 999px;
            padding: 9px 14px;
            cursor: pointer;
        }

        button.primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.ghost {
            background: transparent;
            color: var(--vscode-textLink-foreground);
            border: 1px dashed var(--vscode-focusBorder);
        }

        .status {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: center;
            flex-wrap: wrap;
        }

        .pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            border-radius: 999px;
            background: color-mix(in srgb, var(--vscode-badge-background) 82%, transparent);
            color: var(--vscode-badge-foreground);
        }

        ul {
            margin: 12px 0 0;
            padding-left: 18px;
        }

        .muted {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="shell">
        <div class="card">
            <div class="status">
                <div>
                    <h1>Code Viewer Bot</h1>
                    <p>Idle detector and scheduled mouse rotation powered by robotjs.</p>
                </div>
                <div id="status" class="pill">Stopped</div>
            </div>
        </div>

        <div class="card">
            <h2>Motion</h2>
            <div class="grid">
                <label>Idle before start (ms)
                    <input id="idleMs" type="number" min="250" step="50" />
                </label>
                <label>Radius (px)
                    <input id="radius" type="number" min="1" step="1" />
                </label>
                <label>Speed (degrees)
                    <input id="speed" type="number" min="1" step="1" />
                </label>
                <label>Rotate interval (ms)
                    <input id="rotateIntervalMs" type="number" min="1" step="1" />
                </label>
                <label>Poll interval (ms)
                    <input id="pollIntervalMs" type="number" min="10" step="10" />
                </label>
                <label>Tolerance (px)
                    <input id="tolerancePx" type="number" min="0" step="1" />
                </label>
            </div>
        </div>

        <div class="card">
            <h2>Schedule</h2>
            <label class="toggle">
                <input id="scheduleEnabled" type="checkbox" />
                <span>Only run inside scheduled windows</span>
            </label>
            <div class="grid" style="margin-top: 12px;">
                <label>Random offset (minutes)
                    <input id="randomOffsetMinutes" type="number" min="0" step="1" />
                </label>
            </div>
            <div class="windows" id="windows"></div>
            <div class="actions" style="margin-top: 12px;">
                <button id="addWindow" class="ghost" type="button">Add window</button>
            </div>
        </div>

        <div class="card">
            <h2>Today</h2>
            <p class="muted" id="scheduleDate">Schedule not generated yet.</p>
            <ul id="scheduleSummary"></ul>
        </div>

        <div class="card">
            <div class="actions">
                <button id="save" class="primary" type="button">Save</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const windowsRoot = document.getElementById('windows');
        const scheduleSummary = document.getElementById('scheduleSummary');
        const scheduleDate = document.getElementById('scheduleDate');
        const status = document.getElementById('status');

        const fields = {
            idleMs: document.getElementById('idleMs'),
            radius: document.getElementById('radius'),
            speed: document.getElementById('speed'),
            rotateIntervalMs: document.getElementById('rotateIntervalMs'),
            pollIntervalMs: document.getElementById('pollIntervalMs'),
            tolerancePx: document.getElementById('tolerancePx'),
            scheduleEnabled: document.getElementById('scheduleEnabled'),
            randomOffsetMinutes: document.getElementById('randomOffsetMinutes')
        };

        function createWindowRow(windowConfig) {
            const row = document.createElement('div');
            row.className = 'window-row';
            row.innerHTML = \`
                <label>Start
                    <input type="time" data-role="start" />
                </label>
                <label>End
                    <input type="time" data-role="end" />
                </label>
                <button type="button" class="secondary" data-role="remove">Remove</button>
            \`;

            row.querySelector('[data-role="start"]').value = windowConfig.start;
            row.querySelector('[data-role="end"]').value = windowConfig.end;
            row.querySelector('[data-role="remove"]').addEventListener('click', () => {
                row.remove();
            });

            windowsRoot.appendChild(row);
        }

        function renderWindows(windows) {
            windowsRoot.innerHTML = '';
            windows.forEach(createWindowRow);
        }

        function readWindows() {
            return Array.from(windowsRoot.querySelectorAll('.window-row')).map((row) => ({
                start: row.querySelector('[data-role="start"]').value || '09:00',
                end: row.querySelector('[data-role="end"]').value || '17:00'
            }));
        }

        function collectConfig() {
            return {
                idleMs: Number(fields.idleMs.value),
                radius: Number(fields.radius.value),
                speed: Number(fields.speed.value),
                rotateIntervalMs: Number(fields.rotateIntervalMs.value),
                pollIntervalMs: Number(fields.pollIntervalMs.value),
                tolerancePx: Number(fields.tolerancePx.value),
                schedule: {
                    enabled: fields.scheduleEnabled.checked,
                    randomOffsetMinutes: Number(fields.randomOffsetMinutes.value),
                    windows: readWindows()
                }
            };
        }

        function applyState(state) {
            if (state.config) {
                fields.idleMs.value = state.config.idleMs;
                fields.radius.value = state.config.radius;
                fields.speed.value = state.config.speed;
                fields.rotateIntervalMs.value = state.config.rotateIntervalMs;
                fields.pollIntervalMs.value = state.config.pollIntervalMs;
                fields.tolerancePx.value = state.config.tolerancePx;
                fields.scheduleEnabled.checked = state.config.schedule.enabled;
                fields.randomOffsetMinutes.value = state.config.schedule.randomOffsetMinutes;
                renderWindows(state.config.schedule.windows);
            }

            status.textContent = state.running
                ? (state.rotating ? 'Running: rotating' : 'Running: waiting for idle')
                : 'Stopped';

            if (state.scheduleWindows !== undefined) {
                scheduleSummary.innerHTML = '';
                const scheduleWindows = state.scheduleWindows || [];
                if (state.scheduleDate && scheduleWindows.length > 0) {
                    scheduleDate.textContent = \`Schedule for \${state.scheduleDate}\`;
                    scheduleWindows.forEach((windowConfig) => {
                        const item = document.createElement('li');
                        item.textContent = \`\${windowConfig.start} -> \${windowConfig.end}\`;
                        scheduleSummary.appendChild(item);
                    });
                } else {
                    scheduleDate.textContent = 'Schedule not generated yet.';
                }
            }
        }

        document.getElementById('addWindow').addEventListener('click', () => {
            createWindowRow({ start: '09:00', end: '17:00' });
        });

        document.getElementById('save').addEventListener('click', () => {
            vscode.postMessage({ command: 'save', config: collectConfig() });
        });

        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.command === 'state') {
                applyState(message.state);
                vscode.setState(message.state);
            }
        });

        const previousState = vscode.getState();
        if (previousState) {
            applyState(previousState);
        }

        vscode.postMessage({ command: 'ready' });
    </script>
</body>
</html>`;

module.exports = {
    getConfigPanelHtml
};
