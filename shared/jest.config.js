module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/*.spec.ts'],
    modulePaths: ['<rootDir>'],
    transformIgnorePatterns: [
        '^.+\\.js$'
    ],
    transform: {
        '^.+\\.ts?$': 'ts-jest'
    },
    rootDir: '.',
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
};