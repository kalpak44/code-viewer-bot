const vscode = require('vscode');
const { distance } = require('../utils/math');
const { createScheduleService } = require('./schedule-service');
const { createWorkspaceNavigator } = require('./workspace-navigator');

const createMouseBot = ({ initialConfig, logger, instanceCoordinator, onStateChange }) => {
    const scheduleService = createScheduleService({ logger });
    const workspaceNavigator = createWorkspaceNavigator({ logger });

    let robotModule = null;
    let config = initialConfig;
    let running = false;
    let rotating = false;
    let rotateTimer = null;
    let pollTimer = null;
    let browseTimer = null;
    let browsing = false;
    let browseStarting = false;
    let lastWorkspaceOpenAt = 0;
    let lastWorkspaceAnnouncement = null;
    let robotUnavailableNotified = false;

    let angle = 0;
    let centerX = 0;
    let centerY = 0;
    let lastUserMoveAt = Date.now();
    let lastObservedPos = null;
    let lastProgrammaticPos = null;
    let lastProgrammaticMoveAt = 0;

    scheduleService.setConfig(initialConfig);
    workspaceNavigator.setConfig(initialConfig);

    const formatRemainingSeconds = (milliseconds) => `${Math.ceil(Math.max(0, milliseconds) / 1000)}s`;

    const getState = () => {
        const now = Date.now();
        const schedule = scheduleService.getSummary();
        const workspace = workspaceNavigator.getState();
        const allowedNow = scheduleService.isWithinAllowedTime(new Date(now));
        const motionIdleRemainingMs = Math.max(0, config.idleMs - (now - lastUserMoveAt));
        const workspaceIdleRemainingMs = Math.max(0, config.workspace.idleMs - (now - lastUserMoveAt));
        const browseActive = browsing || browseStarting || Boolean(browseTimer);
        const ownership = instanceCoordinator.getState();

        let statusText = 'Stopped';
        if (running) {
            if (!ownership.isOwner) {
                statusText = ownership.singleInstance
                    ? `Standby (${ownership.owner?.label || 'another window'} active)`
                    : 'Active in this window';
            } else if (!allowedNow) {
                statusText = 'Outside schedule';
            } else if (browseActive) {
                statusText = 'Browsing workspace';
            } else if (rotating) {
                statusText = 'Rotating';
            } else if (motionIdleRemainingMs > 0) {
                statusText = `Waiting ${formatRemainingSeconds(motionIdleRemainingMs)} for motion`;
            } else {
                statusText = 'Ready';
            }
        }

        let workspaceStatusText = workspace.status;
        if (config.workspace.enabled) {
            if (!ownership.isOwner && ownership.singleInstance) {
                workspaceStatusText = `Workspace browsing paused: active window is ${ownership.owner?.label || 'another window'}.`;
            } else if (!allowedNow) {
                workspaceStatusText = 'Workspace browsing paused: outside schedule.';
            } else if (workspaceIdleRemainingMs > 0) {
                workspaceStatusText = `Workspace browsing starts after ${formatRemainingSeconds(workspaceIdleRemainingMs)} of idle time.`;
            } else if (browseActive) {
                workspaceStatusText = `${workspace.status} Next file opens after the configured delay.`;
            }
        }

        return {
            config,
            running,
            rotating,
            statusText,
            instance: ownership,
            scheduleDate: schedule.dateKey,
            scheduleWindows: schedule.windows,
            workspace,
            workspaceStatusText
        };
    };

    const emitState = () => {
        onStateChange(getState());
    };

    const getRobot = () => {
        if (!robotModule) {
            robotModule = require('robotjs');
        }

        return robotModule;
    };

    const ensureRobotAvailable = () => {
        try {
            getRobot();
            robotUnavailableNotified = false;
            return true;
        } catch (error) {
            if (!robotUnavailableNotified) {
                robotUnavailableNotified = true;
                vscode.window.showWarningMessage(`robotjs is not available: ${error.message}`);
                logger(`robotjs load failed: ${error.message}`);
            }
            return false;
        }
    };

    const stopRotation = (emit = true) => {
        if (rotateTimer) {
            clearInterval(rotateTimer);
            rotateTimer = null;
        }

        rotating = false;
        lastProgrammaticPos = null;
        lastProgrammaticMoveAt = 0;

        if (emit) {
            emitState();
        }
    };

    const stopBrowsing = (emit = true) => {
        if (browseTimer) {
            clearTimeout(browseTimer);
            browseTimer = null;
        }

        browsing = false;
        browseStarting = false;
        lastWorkspaceAnnouncement = null;

        if (emit) {
            emitState();
        }
    };

    const scheduleNextBrowseStep = (delayMs) => {
        if (browseTimer) {
            clearTimeout(browseTimer);
        }

        browseTimer = setTimeout(() => {
            browseTimer = null;

            if (!running || !config.workspace.enabled || !scheduleService.isWithinAllowedTime() || !isWorkspaceIdleLongEnough()) {
                stopBrowsing();
                return;
            }
            if (!instanceCoordinator.isOwner()) {
                stopBrowsing();
                return;
            }

            workspaceNavigator.openNextFile()
                .then((opened) => {
                    if (!opened) {
                        stopBrowsing();
                        return;
                    }

                    lastWorkspaceOpenAt = Date.now();
                    scheduleNextBrowseStep(config.workspace.advanceIntervalMs);
                })
                .catch((error) => {
                    logger(`Workspace open failed: ${error.message}`);
                    stopBrowsing();
                });
        }, delayMs);
    };

    const announceWorkspaceLoop = (scanState) => {
        if (!scanState.fileCount || !scanState.targetExtension) {
            return;
        }

        const selectionMode = config.workspace.scanMode === 'extension'
            ? 'manually selected'
            : 'automatically selected';
        const announcementKey = `${scanState.targetExtension}:${selectionMode}:${scanState.fileCount}`;

        if (lastWorkspaceAnnouncement === announcementKey) {
            return;
        }

        lastWorkspaceAnnouncement = announcementKey;
        vscode.window.showInformationMessage(
            `Code Viewer Bot started looping ${scanState.targetExtension} files (${selectionMode}).`
        );
    };

    const startBrowsing = async () => {
        if (browsing || browseStarting || !running || !config.workspace.enabled) {
            return;
        }

        browsing = true;
        browseStarting = true;

        try {
            const scanned = await workspaceNavigator.scan();
            if (!scanned.fileCount || !running || !config.workspace.enabled) {
                browsing = false;
                emitState();
                return;
            }

            announceWorkspaceLoop(scanned);
            const now = Date.now();
            const primedFromActiveEditor = workspaceNavigator.primeFromActiveEditor();
            if (primedFromActiveEditor) {
                lastWorkspaceOpenAt = now;
                scheduleNextBrowseStep(config.workspace.advanceIntervalMs);
                emitState();
                return;
            }

            const elapsedSinceLastOpen = now - lastWorkspaceOpenAt;

            if (lastWorkspaceOpenAt && elapsedSinceLastOpen < config.workspace.advanceIntervalMs) {
                scheduleNextBrowseStep(config.workspace.advanceIntervalMs - elapsedSinceLastOpen);
                emitState();
                return;
            }

            const opened = await workspaceNavigator.openNextFile();
            if (!opened) {
                browsing = false;
                emitState();
                return;
            }

            lastWorkspaceOpenAt = Date.now();

            if (!running || !config.workspace.enabled) {
                emitState();
                return;
            }

            scheduleNextBrowseStep(config.workspace.advanceIntervalMs);
            emitState();
        } catch (error) {
            browsing = false;
            throw error;
        } finally {
            browseStarting = false;
        }
    };

    const refreshWorkspace = async () => {
        if (!running || !config.workspace.enabled) {
            emitState();
            return;
        }

        stopBrowsing(false);
        await workspaceNavigator.scan();

        if (
            scheduleService.isWithinAllowedTime() &&
            isWorkspaceIdleLongEnough()
        ) {
            await startBrowsing();
            return;
        }

        emitState();
    };

    const isIdleLongEnough = () => (Date.now() - lastUserMoveAt) >= config.idleMs;
    const isWorkspaceIdleLongEnough = () => (Date.now() - lastUserMoveAt) >= config.workspace.idleMs;

    const startRotation = () => {
        if (rotating || !running || !instanceCoordinator.isOwner() || !ensureRobotAvailable()) {
            return;
        }

        const robot = getRobot();
        const current = robot.getMousePos();

        rotating = true;
        angle = 0;
        centerX = current.x;
        centerY = current.y;
        rotateTimer = setInterval(() => {
            if (!running || !scheduleService.isWithinAllowedTime()) {
                stopRotation();
                return;
            }

            const x = Math.round(centerX + (config.radius * Math.cos((angle * Math.PI) / 180)));
            const y = Math.round(centerY + (config.radius * Math.sin((angle * Math.PI) / 180)));

            lastProgrammaticPos = { x, y };
            lastProgrammaticMoveAt = Date.now();
            robot.moveMouse(x, y);
            angle = (angle + config.speed) % 360;
        }, config.rotateIntervalMs);

        logger('Rotation started');
        emitState();
    };

    const tick = () => {
        if (!running) {
            return;
        }

        if (!instanceCoordinator.isOwner()) {
            if (rotating) {
                stopRotation(false);
            }
            if (browseTimer || browsing || browseStarting) {
                stopBrowsing(false);
            }
            return;
        }

        const scheduleChanged = scheduleService.ensureDailySchedule();
        const allowedNow = scheduleService.isWithinAllowedTime();

        if (!allowedNow && browseTimer) {
            stopBrowsing(false);
        }

        if (!ensureRobotAvailable()) {
            if (scheduleChanged) {
                emitState();
            }
            return;
        }

        const robot = getRobot();
        const currentPos = robot.getMousePos();

        if (!lastObservedPos) {
            lastObservedPos = currentPos;
        }

        const moved = distance(currentPos, lastObservedPos) > config.tolerancePx;

        if (!allowedNow && rotating) {
            stopRotation(false);
        }

        if (moved) {
            const previousDistanceToProgrammatic = lastProgrammaticPos
                ? distance(lastObservedPos, lastProgrammaticPos)
                : Number.POSITIVE_INFINITY;
            const currentDistanceToProgrammatic = lastProgrammaticPos
                ? distance(currentPos, lastProgrammaticPos)
                : Number.POSITIVE_INFINITY;
            const isRecentProgrammaticMove = (Date.now() - lastProgrammaticMoveAt) <= Math.max(config.pollIntervalMs * 2, 100);
            const isOwnMove = rotating && lastProgrammaticPos && (
                currentDistanceToProgrammatic <= config.tolerancePx ||
                (isRecentProgrammaticMove && currentDistanceToProgrammatic < previousDistanceToProgrammatic)
            );

            if (browseTimer && !isOwnMove) {
                stopBrowsing(false);
            }
            if (rotating) {
                if (!isOwnMove) {
                    stopRotation(false);
                    lastUserMoveAt = Date.now();
                }
            } else {
                lastUserMoveAt = Date.now();
            }

            lastObservedPos = currentPos;
        }

        if (allowedNow && isIdleLongEnough()) {
            if (config.workspace.enabled && !browsing) {
                if (isWorkspaceIdleLongEnough()) {
                    startBrowsing().catch((error) => {
                        logger(`Workspace browsing failed: ${error.message}`);
                    });
                }
            }

            if (!rotating) {
                startRotation();
                return;
            }
        }

        if (scheduleChanged) {
            emitState();
        }
    };

    const stopPolling = () => {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    };

    const startPolling = () => {
        stopPolling();
        pollTimer = setInterval(() => {
            tick();
        }, config.pollIntervalMs);
    };

    const updateConfig = async (nextConfig) => {
        config = nextConfig;
        scheduleService.setConfig(nextConfig);
        workspaceNavigator.setConfig(nextConfig);
        await instanceCoordinator.updateConfig(nextConfig);

        if (!running) {
            emitState();
            return;
        }

        startPolling();
        stopBrowsing(false);
        if (rotating) {
            stopRotation(false);
            if (scheduleService.isWithinAllowedTime()) {
                startRotation();
            }
        }

        emitState();
    };

    const start = async () => {
        if (running) {
            emitState();
            return;
        }

        running = true;
        lastUserMoveAt = Date.now();
        lastObservedPos = ensureRobotAvailable() ? getRobot().getMousePos() : null;
        lastProgrammaticPos = null;
        scheduleService.setConfig(config);
        scheduleService.ensureDailySchedule();
        workspaceNavigator.setConfig(config);
        await instanceCoordinator.refreshOwnership();

        startPolling();
        if (instanceCoordinator.isOwner() && scheduleService.isWithinAllowedTime() && config.workspace.enabled && isWorkspaceIdleLongEnough()) {
            startBrowsing().catch((error) => {
                logger(`Workspace browsing failed: ${error.message}`);
            });
        }
        emitState();
        logger('Bot started');
    };

    const stop = ({ notify = false } = {}) => {
        stopPolling();
        stopRotation(false);
        stopBrowsing(false);

        const wasRunning = running;
        running = false;
        emitState();

        if (wasRunning) {
            logger('Bot stopped');
        }

        if (notify && wasRunning) {
            vscode.window.showInformationMessage('Code Viewer Bot stopped.');
        }
    };

    const handleInstanceChange = () => {
        if (running && !instanceCoordinator.isOwner()) {
            stopRotation(false);
            stopBrowsing(false);
        }
        emitState();
    };

    const handleWorkspaceChange = async () => {
        try {
            await refreshWorkspace();
        } catch (error) {
            logger(`Workspace refresh failed: ${error.message}`);
            emitState();
        }
    };

    return {
        getState,
        updateConfig,
        start,
        stop,
        handleInstanceChange,
        handleWorkspaceChange
    };
};

module.exports = {
    createMouseBot
};
