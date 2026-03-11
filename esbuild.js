const esbuild = require('esbuild');

const production = process.argv.includes('--production');

const main = async () => {
    await esbuild.build({
        entryPoints: ['src/extension.js'],
        bundle: true,
        outfile: 'dist/extension.js',
        format: 'cjs',
        platform: 'node',
        target: 'node16',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        external: ['vscode', 'robotjs'],
        logLevel: 'info'
    });
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
