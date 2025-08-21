module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow empty scope - we'll auto-detect it from changed files
    'scope-empty': [0, 'never'],
    'scope-enum': [
      1, // Warning level instead of error
      'always',
      [
        'cli',
        'shared',
        'calm-widgets',
        'calm-hub',
        'calm-hub-ui',
        'docs',
        'vscode',
        'deps',
        'ci',
        'release'
      ]
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'style',
        'test'
      ]
    ],
    // Disable body line length enforcement - we only care about type and description
    'body-max-line-length': [0, 'always']
  }
};
