module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/*.spec.ts'],
    transformIgnorePatterns: [
        '<rootDir>/node_modules/(?!@finos/calm-shared)',
        '^.+\\.js$'
    ],
    transform: {
        '^.+\\.ts?$': 'ts-jest', 
    },
    rootDir: '.',
    watchPathIgnorePatterns: ['<rootDir>/../shared/']
};