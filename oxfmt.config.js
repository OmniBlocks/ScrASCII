export default {
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: true,
  quoteProps: 'as-needed',
  trailingComma: 'all',
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  printWidth: 100,
  overrides: [
    {
      files: ['*.md'],
      options: {
        proseWrap: 'always',
      },
    },
    {
      files: ['*.json'],
      options: {
        tabWidth: 2,
        printWidth: 120,
      },
    },
    {
      files: ['*.html', '*.css', '*.scss'],
      options: {
        tabWidth: 2,
        printWidth: 120,
      },
    },
  ],
  ignorePatterns: ['pnpm-lock.yaml'],
}
