module.exports = {
	roots: ['<rootDir>/src'],
	transform: {
		'^.+\\.(tsx|jsx|ts|js|mjs)?$': [
			'@swc/jest',
			{
				jsc: {
					parser: {
						syntax: 'typescript',
						dynamicImport: true,
						decorators: true,
					},
					transform: {
						legacyDecorator: true,
						decoratorMetadata: true,
					},
				},
			},
		],
	},
	setupFilesAfterEnv: [__dirname + '/jest-setup.js'],
	testRegex: '.*.test.(ts|tsx)$',
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
	modulePathIgnorePatterns: [
		'<rootDir>/test/__fixtures__',
		'<rootDir>/node_modules',
		'<rootDir>/dist',
	],
	transformIgnorePatterns: ['node_modules/(?!(nanoid)/)'],
	collectCoverageFrom: ['<rootDir>/src/**/*.{ts,tsx}'],
}
