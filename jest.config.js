// src/ is CommonJS and is never transpiled, so no transform and no ESM flags are needed.
module.exports = {
    testEnvironment: 'node',
    collectCoverage: true,
    // lcov is what the Sonar analysis step uploads; text is for the run log.
    coverageReporters: ['text', 'lcov'],
    // Every source file is listed, including the ones no test can load yet: a module
    // reporting 0% is honest, and excluding it is the same move as lowering a threshold.
    collectCoverageFrom: ['src/**/*.js'],
    // Per-path only, no `global` block: Jest takes every path-matched file out of the
    // global pool, so a global threshold would measure just extension.js, mouse-bot.js,
    // config-panel.js, workspace-navigator.js and instance-coordinator.js — the modules
    // that require `vscode` or the native `robotjs` and cannot load outside a VS Code
    // host. These per-path floors are the real gate.
    coverageThreshold: {
        './src/utils/': {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100
        },
        './src/config/config-store.js': {
            statements: 95,
            branches: 90,
            functions: 90,
            lines: 95
        },
        './src/services/schedule-service.js': {
            statements: 90,
            branches: 85,
            functions: 85,
            lines: 90
        },
        './src/ui/config-panel-html.js': {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100
        }
    }
};
