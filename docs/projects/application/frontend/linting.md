# Linting & Formatting

ESLint, Prettier, and Stylelint configuration for the Angular frontend.

## Tools

| Tool | Purpose | Config file |
|------|---------|-------------|
| **ESLint** | TypeScript + Angular code quality | `eslint.config.js` |
| **Prettier** | Code formatting | `.prettierrc` |
| **Stylelint** | SCSS quality | `.stylelintrc.json` |

## ESLint

Uses `@angular-eslint` with `@typescript-eslint/strict-type-checked`.

### Key rules

| Rule | Setting | Why |
|------|---------|-----|
| `@angular-eslint/prefer-standalone` | error | All components must be standalone |
| `@angular-eslint/prefer-on-push-component-change-detection` | error | OnPush everywhere for performance |
| `@typescript-eslint/no-explicit-any` | error | Ban `any` type |
| `@typescript-eslint/explicit-function-return-type` | warn | Encourage explicit return types on public methods |
| `@typescript-eslint/no-unused-vars` | error | Clean code |
| `@typescript-eslint/strict-boolean-expressions` | error | No truthy/falsy checks on non-booleans |
| `@angular-eslint/no-empty-lifecycle-method` | error | Remove empty lifecycle hooks |
| `@angular-eslint/use-lifecycle-interface` | error | Implement interface when using lifecycle hooks |
| `@angular-eslint/component-selector` | `['app', 'kebab-case']` | Consistent selectors |
| `@angular-eslint/directive-selector` | `['app', 'camelCase']` | Angular directive convention |
| `no-console` | warn | Use logging service instead |
| `import/order` | grouped | Enforce import ordering (Angular, Material, third-party, project, relative) |

### Running

```bash
task frontend:local:lint           # Run ESLint
cd app && npx ng lint --fix        # Auto-fix
```

## Prettier

Handles all formatting. ESLint formatting rules are disabled via `eslint-config-prettier`.

### Configuration (`.prettierrc`)

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf",
  "overrides": [
    {
      "files": "*.html",
      "options": {
        "parser": "angular"
      }
    }
  ]
}
```

### Running

```bash
cd app && npx prettier --write "src/**/*.{ts,html,scss}"
```

## Stylelint

Lints SCSS files for consistency and quality.

### Configuration (`.stylelintrc.json`)

```json
{
  "extends": "stylelint-config-standard-scss",
  "rules": {
    "selector-class-pattern": null,
    "scss/at-rule-no-unknown": [
      true,
      {
        "ignoreAtRules": ["use", "forward", "include", "mixin", "if", "else", "each", "for"]
      }
    ],
    "no-empty-source": null,
    "declaration-block-no-redundant-longhand-properties": null
  }
}
```

### Running

```bash
cd app && npx stylelint "src/**/*.scss"
```

## Pre-commit enforcement

Husky + lint-staged run ESLint, Prettier, and Stylelint on staged files before every commit:

```json
{
  "lint-staged": {
    "*.{ts}": ["eslint --fix", "prettier --write"],
    "*.{html}": ["prettier --write"],
    "*.{scss}": ["stylelint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```
