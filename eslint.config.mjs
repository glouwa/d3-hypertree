// A few rules that catch real problems; no formatting rules (the code keeps its
// style, no mass reformatting). npm run lint
import tseslint from 'typescript-eslint'

export default tseslint.config(
    { ignores: ['dist/**', 'node_modules/**', 'test/**', 'playground/**', 'build/**', 'docs/**'] },
    {
        files: ['src/**/*.ts'],
        languageOptions: { parser: tseslint.parser },
        plugins: { '@typescript-eslint': tseslint.plugin },
        rules: {
            // debug output: only real problems may be reported (phase 2 step 2)
            'no-console':        ['error', { allow: ['warn', 'error', 'assert'] }],
            'no-debugger':       'error',
            'no-dupe-keys':      'error',
            'no-dupe-class-members': 'off',          // TypeScript overloads
            'no-duplicate-case': 'error',
            'no-unreachable':    'error',
            'no-self-assign':    'error',
            'no-self-compare':   'error',
            'no-unsafe-finally': 'error',
            'no-cond-assign':    ['error', 'except-parens'],
            'use-isnan':         'error',
            'valid-typeof':      'error',
            'no-sparse-arrays':  'error',
            'no-constant-binary-expression': 'error',
            'no-var':            'off',              // old code uses var widely; not worth a mass change
            '@typescript-eslint/no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
        },
    },
)
