module.exports = {
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
  ],
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    'import/extensions': ['error', 'ignorePackages', {
      ts: 'never',
    }],
    'import/prefer-default-export': 'off',
    'no-console': 'off',
  },
  env: {
    node: true,
  },
}; 