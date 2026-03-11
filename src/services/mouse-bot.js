const vscode = require('vscode');
const { distance } = require('../utils/math');
const { createScheduleService } = require('./schedule-service');

const createMouseBot = ({ initialConfig, logger, onStateChange }) => {
    const scheduleService = createScheduleService({ logger });

    let robotModule = null;
    let config = initialConfig;
    let running = false;
    let rotating = false;
    let rotateTimer = null;
    let pollTimer = null;

    let angle = 0;
    let centerX = 0;
    let centerY = 0;
    let lastUserMoveAt = Date.now();
    let lastObservedPos = null;
    let lastProgrammaticPos = null;

    scheduleService.setConfig(initialConfig);

    const getState = () => {
        const schedule = scheduleService.getSummary();
        return {
            config,
            running,
            rotating,
            scheduleDate: schedule.dateKey,
            scheduleWindows: schedule.windows
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
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`robotjs is not available: ${error.message}`);
            logger(`robotjs load failed: ${error.message}`);
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

        if (emit) {
            emitState();
        }
    };

    const startRotation = () => {
        if (rotating || !running || !ensureRobotAvailable()) {
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
            robot.moveMouse(x, y);
            angle = (angle + config.speed) % 360;
        }, config.rotateIntervalMs);

        logger('Rotation started');
        emitState();
    };

    const tick = () => {
        if (!running || !ensureRobotAvailable()) {
            return;
        }

        const scheduleChanged = scheduleService.ensureDailySchedule();
        const robot = getRobot();
        const currentPos = robot.getMousePos();

        if (!lastObservedPos) {
            lastObservedPos = currentPos;
        }

        const moved = distance(currentPos, lastObservedPos) > config.tolerancePx;
        const allowedNow = scheduleService.isWithinAllowedTime();

        if (!allowedNow && rotating) {
            stopRotation(false);
        }

        if (moved) {
            if (rotating) {
                const isOwnMove = lastProgrammaticPos &&
                    distance(currentPos, lastProgrammaticPos) <= config.tolerancePx;

                if (!isOwnMove) {
                    stopRotation(false);
                    lastUserMoveAt = Date.now();
                }
            } else {
                lastUserMoveAt = Date.now();
            }

            lastObservedPos = currentPos;
        }

        if (allowedNow && !rotating && (Date.now() - lastUserMoveAt) >= config.idleMs) {
            startRotation();
            return;
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

        if (!running) {
            emitState();
            return;
        }

        startPolling();
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

        if (!ensureRobotAvailable()) {
            return;
        }

        running = true;
        lastUserMoveAt = Date.now();
        lastObservedPos = getRobot().getMousePos();
        lastProgrammaticPos = null;
        scheduleService.setConfig(config);
        scheduleService.ensureDailySchedule();

        startPolling();
        emitState();
        logger('Bot started');
        vscode.window.showInformationMessage('Code Viewer Bot started.');
    };

    const stop = ({ notify = false } = {}) => {
        stopPolling();
        stopRotation(false);

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

    return {
        getState,
        updateConfig,
        start,
        stop
    };
};

module.exports = {
    createMouseBot
};
