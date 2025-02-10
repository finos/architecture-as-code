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
    collectCoverage: true,
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 80,
            lines: 75,
            statements: 75,
        }
    }
};