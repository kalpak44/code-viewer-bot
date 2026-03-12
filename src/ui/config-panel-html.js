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

        .workspace-grid {
            display: grid;
            gap: 10px;
            margin-top: 12px;
        }

        .workspace-field {
            display: grid;
            grid-template-columns: minmax(150px, 180px) minmax(0, 1fr);
            gap: 10px 14px;
            align-items: center;
        }

        .workspace-field-title {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        label {
            display: grid;
            gap: 6px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            min-width: 0;
        }

        input, button {
            font: inherit;
        }

        input[type="number"],
        input[type="time"],
        input[type="text"] {
            padding: 8px 10px;
            border-radius: 8px;
            border: 1px solid var(--vscode-input-border, transparent);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            width: 100%;
            box-sizing: border-box;
        }

        input[type="range"] {
            width: 100%;
        }

        .slider-row {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
            align-items: center;
        }

        .slider-value {
            min-width: 72px;
            text-align: right;
            font-variant-numeric: tabular-nums;
            color: var(--vscode-foreground);
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

        .status-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
            margin-top: 12px;
        }

        .meta-box {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 10px;
            padding: 12px;
            background: color-mix(in srgb, var(--vscode-editor-background) 82%, transparent);
        }

        .meta-label {
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 6px;
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

        .is-disabled {
            opacity: 0.55;
        }

        select {
            padding: 8px 10px;
            border-radius: 8px;
            border: 1px solid var(--vscode-input-border, transparent);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
        }

        @media (max-width: 640px) {
            .workspace-field {
                grid-template-columns: 1fr;
            }
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
                <div class="status-actions">
                    <div id="status" class="pill">Stopped</div>
                </div>
            </div>
            <div class="meta-grid">
                <div class="meta-box">
                    <span class="meta-label">This window</span>
                    <div id="currentInstance">Waiting for runtime state...</div>
                </div>
                <div class="meta-box">
                    <span class="meta-label">Active window</span>
                    <div id="activeInstance">Waiting for runtime state...</div>
                </div>
            </div>
        </div>

        <div class="card">
            <h2>Motion</h2>
            <div class="grid">
                <label>Idle before motion (sec)
                    <div class="slider-row">
                        <input id="idleMs" type="range" min="5" max="320" step="1" />
                        <span id="idleMsValue" class="slider-value"></span>
                    </div>
                </label>
                <label>Radius (px)
                    <div class="slider-row">
                        <input id="radius" type="range" min="1" max="2000" step="1" />
                        <span id="radiusValue" class="slider-value"></span>
                    </div>
                </label>
                <label>Speed (degrees)
                    <div class="slider-row">
                        <input id="speed" type="range" min="1" max="360" step="1" />
                        <span id="speedValue" class="slider-value"></span>
                    </div>
                </label>
                <label>Rotate interval (ms)
                    <div class="slider-row">
                        <input id="rotateIntervalMs" type="range" min="1" max="1000" step="1" />
                        <span id="rotateIntervalMsValue" class="slider-value"></span>
                    </div>
                </label>
                <label>Poll interval (ms)
                    <div class="slider-row">
                        <input id="pollIntervalMs" type="range" min="10" max="5000" step="10" />
                        <span id="pollIntervalMsValue" class="slider-value"></span>
                    </div>
                </label>
                <label>Tolerance (px)
                    <div class="slider-row">
                        <input id="tolerancePx" type="range" min="0" max="100" step="1" />
                        <span id="tolerancePxValue" class="slider-value"></span>
                    </div>
                </label>
            </div>
        </div>

        <div class="card">
            <h2>Instance Control</h2>
            <label class="toggle">
                <input id="singleInstance" type="checkbox" />
                <span>Allow only one VS Code window to run the bot</span>
            </label>
            <p class="muted" style="margin-top: 12px;">When enabled, other windows stay in standby and show which window currently owns execution.</p>
        </div>

        <div class="card">
            <h2>Workspace</h2>
            <label class="toggle">
                <input id="workspaceEnabled" type="checkbox" />
                <span>Open workspace files automatically while the bot is active</span>
            </label>
            <div class="workspace-grid">
                <div class="workspace-field">
                    <div class="workspace-field-title">File source</div>
                    <select id="workspaceScanMode">
                        <option value="popular">Use the most common extension</option>
                        <option value="extension">Use a specific extension</option>
                    </select>
                </div>
                <div id="workspacePreferredExtensionField" class="workspace-field">
                    <div class="workspace-field-title">Specific extension</div>
                    <input id="workspacePreferredExtension" type="text" placeholder=".js" />
                </div>
                <div class="workspace-field">
                    <div class="workspace-field-title">Open behavior</div>
                    <select id="workspaceOpenMode">
                        <option value="same-tab">Reuse same tab</option>
                        <option value="new-tab">Open new tab</option>
                    </select>
                </div>
                <div class="workspace-field">
                    <div class="workspace-field-title">Idle before file browsing</div>
                    <div class="slider-row">
                        <input id="workspaceIdleMs" type="range" min="10000" max="60000" step="1000" />
                        <span id="workspaceIdleMsValue" class="slider-value"></span>
                    </div>
                </div>
                <div class="workspace-field">
                    <div class="workspace-field-title">Delay between file opens</div>
                    <div class="slider-row">
                        <input id="workspaceAdvanceIntervalMs" type="range" min="10000" max="60000" step="1000" />
                        <span id="workspaceAdvanceIntervalMsValue" class="slider-value"></span>
                    </div>
                </div>
                <div class="workspace-field">
                    <div class="workspace-field-title">Exclude glob</div>
                    <input id="workspaceExcludeGlob" type="text" />
                </div>
            </div>
            <p id="workspaceStatus" class="muted" style="margin-top: 12px;">Workspace browsing disabled.</p>
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
            <div style="margin-top: 12px;">
                <button id="addWindow" class="ghost" type="button">Add window</button>
            </div>
        </div>

        <div class="card">
            <h2>Today</h2>
            <p class="muted" id="scheduleDate">Schedule not generated yet.</p>
            <ul id="scheduleSummary"></ul>
        </div>

    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const windowsRoot = document.getElementById('windows');
        const scheduleSummary = document.getElementById('scheduleSummary');
        const scheduleDate = document.getElementById('scheduleDate');
        const status = document.getElementById('status');
        const currentInstance = document.getElementById('currentInstance');
        const activeInstance = document.getElementById('activeInstance');
        const workspaceStatus = document.getElementById('workspaceStatus');
        const workspacePreferredExtensionField = document.getElementById('workspacePreferredExtensionField');
        let saveTimer = null;
        let configHydrated = false;
        let awaitingConfigSync = false;

        const fields = {
            idleMs: document.getElementById('idleMs'),
            radius: document.getElementById('radius'),
            speed: document.getElementById('speed'),
            rotateIntervalMs: document.getElementById('rotateIntervalMs'),
            pollIntervalMs: document.getElementById('pollIntervalMs'),
            tolerancePx: document.getElementById('tolerancePx'),
            singleInstance: document.getElementById('singleInstance'),
            workspaceEnabled: document.getElementById('workspaceEnabled'),
            workspaceScanMode: document.getElementById('workspaceScanMode'),
            workspacePreferredExtension: document.getElementById('workspacePreferredExtension'),
            workspaceOpenMode: document.getElementById('workspaceOpenMode'),
            workspaceIdleMs: document.getElementById('workspaceIdleMs'),
            workspaceAdvanceIntervalMs: document.getElementById('workspaceAdvanceIntervalMs'),
            workspaceExcludeGlob: document.getElementById('workspaceExcludeGlob'),
            scheduleEnabled: document.getElementById('scheduleEnabled'),
            randomOffsetMinutes: document.getElementById('randomOffsetMinutes')
        };

        const sliderUnits = {
            idleMs: 'sec',
            radius: 'px',
            speed: 'deg',
            rotateIntervalMs: 'ms',
            pollIntervalMs: 'ms',
            tolerancePx: 'px',
            workspaceIdleMs: 'sec',
            workspaceAdvanceIntervalMs: 'sec'
        };

        function scheduleSave() {
            if (saveTimer) {
                clearTimeout(saveTimer);
            }

            saveTimer = setTimeout(() => {
                awaitingConfigSync = true;
                vscode.postMessage({ command: 'save', config: collectConfig() });
            }, 250);
        }

        function updateSliderValue(id) {
            const valueNode = document.getElementById(id + 'Value');
            if (!valueNode) {
                return;
            }

            const numericValue = Number(fields[id].value);
            if (id === 'idleMs') {
                const roundedValue = Math.round(numericValue * 1000) / 1000;
                valueNode.textContent = roundedValue.toString() + ' ' + sliderUnits[id];
                return;
            }

            if (id === 'workspaceIdleMs' || id === 'workspaceAdvanceIntervalMs') {
                valueNode.textContent = (numericValue / 1000) + ' ' + sliderUnits[id];
                return;
            }

            valueNode.textContent = numericValue + ' ' + sliderUnits[id];
        }

        function updateWorkspaceControls() {
            const workspaceEnabled = fields.workspaceEnabled.checked;
            const extensionMode = fields.workspaceScanMode.value === 'extension';

            fields.workspaceScanMode.disabled = !workspaceEnabled;
            fields.workspacePreferredExtension.disabled = !workspaceEnabled || !extensionMode;
            fields.workspaceOpenMode.disabled = !workspaceEnabled;
            fields.workspaceIdleMs.disabled = !workspaceEnabled;
            fields.workspaceAdvanceIntervalMs.disabled = !workspaceEnabled;
            fields.workspaceExcludeGlob.disabled = !workspaceEnabled;

            workspacePreferredExtensionField.classList.toggle('is-disabled', !workspaceEnabled || !extensionMode);
        }

        Object.keys(sliderUnits).forEach((id) => {
            fields[id].addEventListener('input', () => {
                updateSliderValue(id);
                scheduleSave();
            });
        });

        fields.workspaceEnabled.addEventListener('change', () => {
            updateWorkspaceControls();
            scheduleSave();
        });
        fields.singleInstance.addEventListener('change', scheduleSave);
        fields.workspaceScanMode.addEventListener('change', () => {
            updateWorkspaceControls();
            scheduleSave();
        });
        fields.workspacePreferredExtension.addEventListener('input', scheduleSave);
        fields.workspaceOpenMode.addEventListener('change', scheduleSave);
        fields.workspaceExcludeGlob.addEventListener('input', scheduleSave);
        fields.scheduleEnabled.addEventListener('change', scheduleSave);
        fields.randomOffsetMinutes.addEventListener('input', scheduleSave);

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
            row.querySelector('[data-role="start"]').addEventListener('change', scheduleSave);
            row.querySelector('[data-role="end"]').addEventListener('change', scheduleSave);
            row.querySelector('[data-role="remove"]').addEventListener('click', () => {
                row.remove();
                scheduleSave();
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
                idleMs: Math.round(Number(fields.idleMs.value) * 1000),
                radius: Number(fields.radius.value),
                speed: Number(fields.speed.value),
                rotateIntervalMs: Number(fields.rotateIntervalMs.value),
                pollIntervalMs: Number(fields.pollIntervalMs.value),
                tolerancePx: Number(fields.tolerancePx.value),
                instanceControl: {
                    singleInstance: fields.singleInstance.checked
                },
                workspace: {
                    enabled: fields.workspaceEnabled.checked,
                    scanMode: fields.workspaceScanMode.value,
                    preferredExtension: fields.workspacePreferredExtension.value,
                    openMode: fields.workspaceOpenMode.value,
                    idleMs: Number(fields.workspaceIdleMs.value),
                    advanceIntervalMs: Number(fields.workspaceAdvanceIntervalMs.value),
                    excludeGlob: fields.workspaceExcludeGlob.value
                },
                schedule: {
                    enabled: fields.scheduleEnabled.checked,
                    randomOffsetMinutes: Number(fields.randomOffsetMinutes.value),
                    windows: readWindows()
                }
            };
        }

        function applyConfig(config) {
            fields.idleMs.value = String(config.idleMs / 1000);
            fields.radius.value = config.radius;
            fields.speed.value = config.speed;
            fields.rotateIntervalMs.value = config.rotateIntervalMs;
            fields.pollIntervalMs.value = config.pollIntervalMs;
            fields.tolerancePx.value = config.tolerancePx;
            fields.singleInstance.checked = config.instanceControl.singleInstance;
            Object.keys(sliderUnits).forEach(updateSliderValue);
            fields.workspaceEnabled.checked = config.workspace.enabled;
            fields.workspaceScanMode.value = config.workspace.scanMode;
            fields.workspacePreferredExtension.value = config.workspace.preferredExtension;
            fields.workspaceOpenMode.value = config.workspace.openMode;
            fields.workspaceIdleMs.value = config.workspace.idleMs;
            fields.workspaceAdvanceIntervalMs.value = config.workspace.advanceIntervalMs;
            fields.workspaceExcludeGlob.value = config.workspace.excludeGlob;
            updateSliderValue('workspaceIdleMs');
            updateSliderValue('workspaceAdvanceIntervalMs');
            updateWorkspaceControls();
            fields.scheduleEnabled.checked = config.schedule.enabled;
            fields.randomOffsetMinutes.value = config.schedule.randomOffsetMinutes;
            renderWindows(config.schedule.windows);
        }

        function applyState(state) {
            if (state.config && (!configHydrated || awaitingConfigSync)) {
                applyConfig(state.config);
                configHydrated = true;
                awaitingConfigSync = false;
            }

            status.textContent = state.statusText || (state.running
                ? (state.rotating ? 'Rotating' : 'Waiting for idle')
                : 'Stopped');

            if (state.instance) {
                currentInstance.textContent = state.instance.current?.label || 'Unknown window';
                if (!state.instance.singleInstance) {
                    activeInstance.textContent = 'Single-window coordination disabled';
                } else if (state.instance.owner?.label) {
                    activeInstance.textContent = state.instance.owner.label + (state.instance.isOwner ? ' (this window)' : '');
                } else {
                    activeInstance.textContent = 'No active owner yet';
                }
            }

            if (state.workspaceStatusText) {
                workspaceStatus.textContent = state.workspaceStatusText;
            } else if (state.workspace) {
                workspaceStatus.textContent = state.workspace.status;
            }

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
            scheduleSave();
        });

        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.command === 'state') {
                applyState(message.state);
            }
        });

        vscode.postMessage({ command: 'ready' });
    </script>
</body>
</html>`;

module.exports = {
    getConfigPanelHtml
};
