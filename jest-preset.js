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
	// Resolve issue where imports contain ".js" extension for Node compatible resolution
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},
	modulePathIgnorePatterns: [
		'<rootDir>/test/__fixtures__',
		'<rootDir>/node_modules',
		'<rootDir>/dist',
	],
	transformIgnorePatterns: ['node_modules/(?!(nanoid)/)'],
	collectCoverageFrom: ['<rootDir>/src/**/*.{ts,tsx}'],
}
