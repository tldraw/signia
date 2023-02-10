module.exports = {
	roots: ['<rootDir>/lib'],
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
	moduleNameMapper: {
		'^~(.*)': '<rootDir>/lib/$1',
	},
	testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
	modulePathIgnorePatterns: [
		'<rootDir>/test/__fixtures__',
		'<rootDir>/node_modules',
		'<rootDir>/dist',
	],
	transformIgnorePatterns: ['node_modules/(?!(nanoid)/)'],
	collectCoverageFrom: ['<rootDir>/lib/**/*.{ts,tsx}'],
}
