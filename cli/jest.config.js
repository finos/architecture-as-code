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
    watchPathIgnorePatterns: ['<rootDir>/../shared/'],
    collectCoverage: true,
    coverageThreshold: {
        global: {
            branches: 95,
            functions: 90,
            lines: 90,
            statements: 90,
        }
    }
};