const fs = require('node:fs/promises');
const path = require('node:path');
const vscode = require('vscode');

const TEXT_SAMPLE_BYTES = 4096;
const BINARY_CONTROL_THRESHOLD = 0.1;

const createWorkspaceNavigator = ({ logger }) => {
    let config = null;
    let files = [];
    let fileIndex = 0;
    let targetExtension = null;
    let lastScanStatus = 'Workspace browsing disabled.';
    let openingFile = false;
    let lastOpenedFilePath = null;

    const hasWorkspace = () => Array.isArray(vscode.workspace.workspaceFolders) && vscode.workspace.workspaceFolders.length > 0;

    const getState = () => ({
        hasWorkspace: hasWorkspace(),
        targetExtension,
        fileCount: files.length,
        status: lastScanStatus
    });

    const setConfig = (nextConfig) => {
        config = nextConfig;
        files = [];
        fileIndex = 0;
        targetExtension = null;
        lastOpenedFilePath = null;
        lastScanStatus = nextConfig.workspace.enabled
            ? 'Workspace browsing waiting for scan.'
            : 'Workspace browsing disabled.';
    };

    const getActiveFilePath = () => vscode.window.activeTextEditor?.document?.uri?.fsPath ?? null;

    const isProbablyTextFile = async (uri) => {
        try {
            const handle = await fs.open(uri.fsPath, 'r');

            try {
                const sample = Buffer.alloc(TEXT_SAMPLE_BYTES);
                const { bytesRead } = await handle.read(sample, 0, TEXT_SAMPLE_BYTES, 0);

                if (bytesRead === 0) {
                    return true;
                }

                let binaryControlCount = 0;
                for (let index = 0; index < bytesRead; index += 1) {
                    const byte = sample[index];

                    if (byte === 0) {
                        return false;
                    }

                    const isTextControl = byte === 9 || byte === 10 || byte === 13;
                    const isVisibleAscii = byte >= 32 && byte <= 126;
                    const isExtendedByte = byte >= 128;

                    if (!isTextControl && !isVisibleAscii && !isExtendedByte) {
                        binaryControlCount += 1;
                    }
                }

                return (binaryControlCount / bytesRead) < BINARY_CONTROL_THRESHOLD;
            } finally {
                await handle.close();
            }
        } catch (error) {
            logger(`Skipping unreadable file ${path.basename(uri.fsPath)}: ${error.message}`);
            return false;
        }
    };

    const filterTextFiles = async (candidateFiles) => {
        const textFiles = [];

        for (const uri of candidateFiles) {
            if (await isProbablyTextFile(uri)) {
                textFiles.push(uri);
            }
        }

        return textFiles;
    };

    const groupFilesByExtension = (allFiles) => {
        const groups = new Map();

        for (const uri of allFiles) {
            const extension = path.extname(uri.fsPath).toLowerCase();
            if (!extension) {
                continue;
            }

            if (!groups.has(extension)) {
                groups.set(extension, []);
            }

            groups.get(extension).push(uri);
        }

        return Array.from(groups.entries())
            .sort((left, right) => right[1].length - left[1].length);
    };

    const resolveFilesForScanMode = async (allFiles) => {
        const groupedFiles = groupFilesByExtension(allFiles);

        if (config.workspace.scanMode === 'extension') {
            const matchingEntry = groupedFiles.find(([extension]) => extension === config.workspace.preferredExtension);
            if (!matchingEntry) {
                return {
                    targetExtension: config.workspace.preferredExtension,
                    files: []
                };
            }

            return {
                targetExtension: config.workspace.preferredExtension,
                files: await filterTextFiles(matchingEntry[1])
            };
        }

        for (const [extension, candidateFiles] of groupedFiles) {
            const textFiles = await filterTextFiles(candidateFiles);
            if (textFiles.length > 0) {
                return {
                    targetExtension: extension,
                    files: textFiles
                };
            }
        }

        return {
            targetExtension: null,
            files: []
        };
    };

    const scan = async () => {
        if (!config.workspace.enabled) {
            files = [];
            targetExtension = null;
            lastScanStatus = 'Workspace browsing disabled.';
            return getState();
        }

        if (!hasWorkspace()) {
            files = [];
            targetExtension = null;
            lastScanStatus = 'No workspace folder is open.';
            return getState();
        }

        const allFiles = await vscode.workspace.findFiles('**/*', config.workspace.excludeGlob, 5000);
        const resolvedFiles = await resolveFilesForScanMode(allFiles);
        const nextTargetExtension = resolvedFiles.targetExtension;

        if (!nextTargetExtension) {
            files = [];
            targetExtension = null;
            lastScanStatus = 'No text files matched the workspace settings.';
            return getState();
        }

        targetExtension = nextTargetExtension;
        const nextFiles = resolvedFiles.files
            .sort((left, right) => left.fsPath.localeCompare(right.fsPath));
        const resumeAfterPath = lastOpenedFilePath || getActiveFilePath();

        files = nextFiles;
        fileIndex = 0;

        if (resumeAfterPath && files.length > 0) {
            const resumeIndex = files.findIndex((uri) => uri.fsPath === resumeAfterPath);
            if (resumeIndex >= 0) {
                fileIndex = (resumeIndex + 1) % files.length;
            }
        }

        if (files.length === 0) {
            lastScanStatus = `No text files found for ${targetExtension}.`;
            return getState();
        }

        lastScanStatus = `Browsing ${files.length} ${targetExtension} files.`;
        logger(lastScanStatus);
        return getState();
    };

    const ensureFiles = async () => {
        if (!config.workspace.enabled) {
            return false;
        }

        if (files.length > 0) {
            return true;
        }

        await scan();
        return files.length > 0;
    };

    const primeFromActiveEditor = () => {
        if (files.length === 0) {
            return false;
        }

        const activeFilePath = getActiveFilePath();
        if (!activeFilePath) {
            return false;
        }

        const activeIndex = files.findIndex((uri) => uri.fsPath === activeFilePath);
        if (activeIndex < 0) {
            return false;
        }

        lastOpenedFilePath = activeFilePath;
        fileIndex = (activeIndex + 1) % files.length;
        return true;
    };

    const openNextFile = async () => {
        if (openingFile) {
            return false;
        }

        openingFile = true;

        try {
            if (!await ensureFiles()) {
                return false;
            }

            const nextUri = files[fileIndex % files.length];
            fileIndex = (fileIndex + 1) % files.length;
            lastOpenedFilePath = nextUri.fsPath;

            if (config.workspace.openMode === 'same-tab' && vscode.window.activeTextEditor) {
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            }

            const document = await vscode.workspace.openTextDocument(nextUri);
            await vscode.window.showTextDocument(document, {
                preview: config.workspace.openMode === 'same-tab',
                preserveFocus: false
            });

            logger(`Opened ${path.basename(nextUri.fsPath)}`);
            return true;
        } finally {
            openingFile = false;
        }
    };

    return {
        setConfig,
        scan,
        openNextFile,
        primeFromActiveEditor,
        getState
    };
};

module.exports = {
    createWorkspaceNavigator
};
