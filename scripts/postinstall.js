const { spawnSync } = require('node:child_process');

if (process.env.SKIP_ROBOTJS_REBUILD === '1') {
    console.log('Skipping robotjs rebuild during postinstall.');
    process.exit(0);
}

console.log('Rebuilding native modules for robotjs...');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCommand, ['rebuild', 'robotjs'], {
    stdio: 'inherit',
    shell: false
});

if (result.status !== 0) {
    console.warn('robotjs rebuild failed during postinstall. Continuing.');
}
