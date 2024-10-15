// eslint-disable-next-line no-undef
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    modulePaths: [ '<rootDir>' ],
    rootDir: '.',
    transform: {
        '^.+\\.ts?$': 'ts-jest',  // Tells Jest to use ts-jest for TypeScript files
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    testPathIgnorePatterns: ['dist/'],
    verbose: true
};
