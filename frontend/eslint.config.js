import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const jsxFiles = ['**/*.{js,jsx}']
const testFiles = ['**/*.{test,spec}.{js,jsx}']
const rootConfigs = ['vite.config.js', 'eslint.config.js']

const reactRecommended = [
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs['recommended-latest'],
  reactRefresh.configs.vite,
]

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: rootConfigs,
    languageOptions: { globals: globals.node },
  },
  {
    files: jsxFiles,
    ignores: [...testFiles, ...rootConfigs],
    extends: reactRecommended,
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/prop-types': 'off',
    },
  },
  {
    files: testFiles,
    extends: reactRecommended,
    languageOptions: {
      globals: { ...globals.browser, ...globals.vitest },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/prop-types': 'off',
    },
  },
])
