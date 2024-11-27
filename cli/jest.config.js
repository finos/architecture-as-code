module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/*.spec.ts'],
    transformIgnorePatterns: [
        "<rootDir>/node_modules/(?!@finos/calm-shared)",
        '^.+\\.js$'
    ],
    rootDir: '.',
    watchPathIgnorePatterns: ['<rootDir>/../shared/']
};