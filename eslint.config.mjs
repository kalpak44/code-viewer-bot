import globals from 'globals';

// Rules are errors, not warnings. The PR agent merges with no human review and gates on
// this workflow, so a warning is indistinguishable from a pass and would never block.
const rules = {
    'no-const-assign': 'error',
    'no-this-before-super': 'error',
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-unused-vars': 'error',
    'constructor-super': 'error',
    'valid-typeof': 'error'
};

export default [
    {
        ignores: ['dist/**', 'out/**', 'coverage/**', 'node_modules/**']
    },
    {
        // src/ and scripts/ are CommonJS; declaring them as modules makes `require` and
        // `module` undefined and every file fails no-undef.
        files: ['src/**/*.js', 'scripts/**/*.js', 'esbuild.js'],
        languageOptions: {
            globals: { ...globals.node, ...globals.commonjs },
            ecmaVersion: 2022,
            sourceType: 'commonjs'
        },
        rules
    },
    {
        files: ['test/**/*.js'],
        languageOptions: {
            globals: { ...globals.node, ...globals.commonjs, ...globals.jest },
            ecmaVersion: 2022,
            sourceType: 'commonjs'
        },
        rules
    }
];
