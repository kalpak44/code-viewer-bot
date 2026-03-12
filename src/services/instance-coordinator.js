const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const vscode = require('vscode');
const { INSTANCE_LOCK_FILENAME } = require('../constants');

const HEARTBEAT_INTERVAL_MS = 4000;
const LEASE_TIMEOUT_MS = 12000;

const createInstanceCoordinator = ({ extensionContext, logger, initialConfig, onChange }) => {
    const workspaceName = vscode.workspace.name
        || path.basename(vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || 'No Workspace');
    const instanceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const label = `${workspaceName} (${instanceId.slice(-4)})`;
    const lockFilePath = path.join(extensionContext.globalStorageUri.fsPath, INSTANCE_LOCK_FILENAME);

    let config = initialConfig;
    let heartbeatTimer = null;
    let owner = null;
    let isOwner = false;

    const emitChange = () => {
        if (typeof onChange === 'function') {
            onChange(getState());
        }
    };

    const getLeasePayload = () => ({
        instanceId,
        label,
        host: os.hostname(),
        pid: process.pid,
        updatedAt: Date.now()
    });

    const readOwner = async () => {
        try {
            const raw = await fs.readFile(lockFilePath, 'utf8');
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || !parsed.instanceId) {
                return null;
            }

            return parsed;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }

            logger(`Instance lock read failed: ${error.message}`);
            return null;
        }
    };

    const setOwnerState = (nextOwner, nextIsOwner) => {
        const ownerChanged = JSON.stringify(owner) !== JSON.stringify(nextOwner);
        const ownershipChanged = isOwner !== nextIsOwner;
        owner = nextOwner;
        isOwner = nextIsOwner;

        if (ownerChanged || ownershipChanged) {
            logger(nextIsOwner
                ? `Instance acquired active role: ${label}`
                : `Instance in standby. Active owner: ${nextOwner?.label || 'none'}`);
            emitChange();
        }
    };

    const writeLease = async () => {
        const nextOwner = getLeasePayload();
        await fs.mkdir(extensionContext.globalStorageUri.fsPath, { recursive: true });
        await fs.writeFile(lockFilePath, JSON.stringify(nextOwner, null, 2), 'utf8');
        setOwnerState(nextOwner, true);
    };

    const ensureOwnership = async () => {
        if (!config.instanceControl.singleInstance) {
            setOwnerState({
                instanceId,
                label,
                host: os.hostname(),
                pid: process.pid,
                updatedAt: Date.now(),
                singleInstanceDisabled: true
            }, true);
            return true;
        }

        const currentOwner = await readOwner();
        const ownerExpired = currentOwner && (Date.now() - currentOwner.updatedAt) > LEASE_TIMEOUT_MS;

        if (!currentOwner || ownerExpired || currentOwner.instanceId === instanceId) {
            await writeLease();
            return true;
        }

        setOwnerState(currentOwner, false);
        return false;
    };

    const releaseOwnership = async () => {
        if (!config.instanceControl.singleInstance) {
            setOwnerState(null, false);
            return;
        }

        const currentOwner = await readOwner();
        if (currentOwner?.instanceId !== instanceId) {
            setOwnerState(currentOwner, false);
            return;
        }

        try {
            await fs.unlink(lockFilePath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger(`Instance lock release failed: ${error.message}`);
            }
        }

        setOwnerState(null, false);
    };

    const refreshOwnership = async () => {
        try {
            await ensureOwnership();
        } catch (error) {
            logger(`Instance coordination failed: ${error.message}`);
        }
    };

    const start = async () => {
        await refreshOwnership();
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
        }

        heartbeatTimer = setInterval(() => {
            refreshOwnership();
        }, HEARTBEAT_INTERVAL_MS);
    };

    const stop = async () => {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }

        await releaseOwnership();
    };

    const updateConfig = async (nextConfig) => {
        const previousSingleInstance = config.instanceControl.singleInstance;
        config = nextConfig;

        if (previousSingleInstance !== nextConfig.instanceControl.singleInstance) {
            if (nextConfig.instanceControl.singleInstance) {
                await refreshOwnership();
            } else {
                await releaseOwnership();
                setOwnerState({
                    instanceId,
                    label,
                    host: os.hostname(),
                    pid: process.pid,
                    updatedAt: Date.now(),
                    singleInstanceDisabled: true
                }, true);
            }
        }
    };

    const getState = () => ({
        current: {
            instanceId,
            label
        },
        owner,
        isOwner,
        singleInstance: config.instanceControl.singleInstance
    });

    return {
        getState,
        isOwner: () => isOwner,
        start,
        stop,
        updateConfig,
        refreshOwnership
    };
};

module.exports = {
    createInstanceCoordinator
};
