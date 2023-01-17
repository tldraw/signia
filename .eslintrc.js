module.exports = {
	extends: ['prettier', 'eslint:recommended', 'plugin:@typescript-eslint/recommended'],
	ignorePatterns: ['**/*.js', '**/*.test.ts'],
	rules: {
		'no-non-null-assertion': 'off',
		'no-fallthrough': 'off',
		'@typescript-eslint/no-fallthrough': 'off',
		'@typescript-eslint/no-non-null-assertion': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/ban-ts-comment': 'off',
		'@typescript-eslint/no-extra-semi': 'off',
		'no-mixed-spaces-and-tabs': 'off',
		'@typescript-eslint/no-unused-vars': [
			'warn',
			{
				argsIgnorePattern: '^_',
				varsIgnorePattern: '^_',
				caughtErrorsIgnorePattern: '^_',
			},
		],
	},
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint', 'no-only-tests'],
	overrides: [
		{
			// enable the rule specifically for TypeScript files
			files: ['*.ts', '*.tsx'],
			rules: {
				'@typescript-eslint/explicit-module-boundary-types': [0],
				'no-console': ['error', { allow: ['warn', 'error'] }],
				'no-only-tests/no-only-tests': ['error', { fix: true }],
			},
		},
	],
}
