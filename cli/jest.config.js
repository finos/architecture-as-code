module.exports =  {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['./**/*.spec.ts'],
    transformIgnorePatterns: [
        "<rootDir>/node_modules/(?!calm-shared)",
        '^.+\\.js$'
    ],
    rootDir: '.',
    watchPathIgnorePatterns: ['<rootDir>/../shared/']
};