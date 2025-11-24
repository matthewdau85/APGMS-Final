module.exports = {
    root: true,
    env: {
        es2022: true,
        node: true,
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint'],
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': [
            'warn',
            { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/no-empty-object-type': 'warn',
        '@typescript-eslint/ban-ts-comment': 'warn',
        'no-empty': 'warn',
        'no-inner-declarations': 'warn',
    },
    ignorePatterns: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.next/**', 'artifacts/**'],
    overrides: [
        {
            files: ['**/*.{ts,tsx}'],
            parserOptions: {
                project: null,
            },
        },
        {
            files: ['webapp/**/*.{ts,tsx}', 'apps/**/*.{ts,tsx}'],
            env: {
                browser: true,
            },
            extends: [
                'plugin:react/recommended',
                'plugin:react-hooks/recommended',
                'plugin:jsx-a11y/recommended',
            ],
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            settings: {
                react: {
                    version: 'detect',
                },
            },
            rules: {
                'react/react-in-jsx-scope': 'off',
                'react/prop-types': 'off',
                'react-hooks/exhaustive-deps': 'warn',
                'react-hooks/rules-of-hooks': 'warn',
            },
        },
        {
            files: ['**/*.test.{ts,tsx,js}'],
            env: {
                jest: true,
            },
        },
    ],
};
