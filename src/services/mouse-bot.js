const vscode = require('vscode');
const { distance } = require('../utils/math');
const { ScheduleService } = require('./schedule-service');

class MouseBot {
    constructor({ initialConfig, logger, onStateChange }) {
        this.logger = logger;
        this.onStateChange = onStateChange;
        this.scheduleService = new ScheduleService({ logger });
        this.robotModule = null;

        this.config = initialConfig;
        this.running = false;
        this.rotating = false;
        this.rotateTimer = null;
        this.pollTimer = null;

        this.angle = 0;
        this.centerX = 0;
        this.centerY = 0;
        this.lastUserMoveAt = Date.now();
        this.lastObservedPos = null;
        this.lastProgrammaticPos = null;

        this.scheduleService.setConfig(initialConfig);
    }

    getState() {
        const schedule = this.scheduleService.getSummary();
        return {
            config: this.config,
            running: this.running,
            rotating: this.rotating,
            scheduleDate: schedule.dateKey,
            scheduleWindows: schedule.windows
        };
    }

    async updateConfig(config) {
        this.config = config;
        this.scheduleService.setConfig(config);

        if (!this.running) {
            this.emitState();
            return;
        }

        this.startPolling();
        if (this.rotating) {
            this.stopRotation(false);
            if (this.scheduleService.isWithinAllowedTime()) {
                this.startRotation();
            }
        }

        this.emitState();
    }

    async start() {
        if (this.running) {
            this.emitState();
            return;
        }

        if (!this.ensureRobotAvailable()) {
            return;
        }

        this.running = true;
        this.lastUserMoveAt = Date.now();
        this.lastObservedPos = this.getRobot().getMousePos();
        this.lastProgrammaticPos = null;
        this.scheduleService.setConfig(this.config);
        this.scheduleService.ensureDailySchedule();

        this.startPolling();
        this.emitState();
        this.logger('Bot started');
        vscode.window.showInformationMessage('Code Viewer Bot started.');
    }

    stop({ notify = false } = {}) {
        this.stopPolling();
        this.stopRotation(false);

        const wasRunning = this.running;
        this.running = false;
        this.emitState();

        if (wasRunning) {
            this.logger('Bot stopped');
        }

        if (notify && wasRunning) {
            vscode.window.showInformationMessage('Code Viewer Bot stopped.');
        }
    }

    ensureRobotAvailable() {
        try {
            this.getRobot();
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`robotjs is not available: ${error.message}`);
            this.logger(`robotjs load failed: ${error.message}`);
            return false;
        }
    }

    getRobot() {
        if (!this.robotModule) {
            this.robotModule = require('robotjs');
        }

        return this.robotModule;
    }

    startPolling() {
        this.stopPolling();
        this.pollTimer = setInterval(() => {
            this.tick();
        }, this.config.pollIntervalMs);
    }

    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    tick() {
        if (!this.running || !this.ensureRobotAvailable()) {
            return;
        }

        const scheduleChanged = this.scheduleService.ensureDailySchedule();
        const robot = this.getRobot();
        const currentPos = robot.getMousePos();

        if (!this.lastObservedPos) {
            this.lastObservedPos = currentPos;
        }

        const moved = distance(currentPos, this.lastObservedPos) > this.config.tolerancePx;
        const allowedNow = this.scheduleService.isWithinAllowedTime();

        if (!allowedNow && this.rotating) {
            this.stopRotation(false);
        }

        if (moved) {
            if (this.rotating) {
                const isOwnMove = this.lastProgrammaticPos &&
                    distance(currentPos, this.lastProgrammaticPos) <= this.config.tolerancePx;

                if (!isOwnMove) {
                    this.stopRotation(false);
                    this.lastUserMoveAt = Date.now();
                }
            } else {
                this.lastUserMoveAt = Date.now();
            }

            this.lastObservedPos = currentPos;
        }

        if (allowedNow && !this.rotating && (Date.now() - this.lastUserMoveAt) >= this.config.idleMs) {
            this.startRotation();
            return;
        }

        if (scheduleChanged) {
            this.emitState();
        }
    }

    startRotation() {
        if (this.rotating || !this.running || !this.ensureRobotAvailable()) {
            return;
        }

        const robot = this.getRobot();
        const current = robot.getMousePos();

        this.rotating = true;
        this.angle = 0;
        this.centerX = current.x;
        this.centerY = current.y;
        this.rotateTimer = setInterval(() => {
            if (!this.running || !this.scheduleService.isWithinAllowedTime()) {
                this.stopRotation();
                return;
            }

            const x = Math.round(this.centerX + (this.config.radius * Math.cos((this.angle * Math.PI) / 180)));
            const y = Math.round(this.centerY + (this.config.radius * Math.sin((this.angle * Math.PI) / 180)));

            this.lastProgrammaticPos = { x, y };
            robot.moveMouse(x, y);
            this.angle = (this.angle + this.config.speed) % 360;
        }, this.config.rotateIntervalMs);

        this.logger('Rotation started');
        this.emitState();
    }

    stopRotation(emit = true) {
        if (this.rotateTimer) {
            clearInterval(this.rotateTimer);
            this.rotateTimer = null;
        }

        this.rotating = false;
        this.lastProgrammaticPos = null;

        if (emit) {
            this.emitState();
        }
    }

    emitState() {
        this.onStateChange(this.getState());
    }
}

module.exports = {
    MouseBot
};
