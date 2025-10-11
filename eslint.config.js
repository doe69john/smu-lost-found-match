import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
  {
    ignores: ['dist', 'node_modules'],
  },
  {
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        fetch: 'readonly',
        XMLHttpRequest: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly'
      }
    }
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  eslintConfigPrettier,
]
