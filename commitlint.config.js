module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
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
    'scope-enum': [
      2,
      'always',
      [
        'cli',
        'shared',
        'calm-widgets',
        'calm',
        'calm-hub',
        'calm-hub-ui',
        'docs',
        'workspace'
      ]
    ]
  }
};
