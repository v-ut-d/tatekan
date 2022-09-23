# template

Template Repository for TypeScript & Node.js Application - with strictest possible code quality

## features

- `pnpm` package manager
- TypeScript
  - extends `@tsconfig/strictest`
  - top-level await enabled
- ESLint
  - many plugins & rules from `@typescript-eslint` enabled
- Prettier
  - default setting except for `singleQuote`
- Husky & lint-staged
  - automatically type-check & lint & format before commits
- Webpack
  - enables top-level await
  - creates single self-contained `main.cjs` - free from `node_modules`
- Docker

## scripts

- `pnpm dev` - start testing without build
- `pnpm build` - creates `dist/main.cjs` (commonjs)
- `pnpm start` - executes `dist/main.cjs`

## deploy

### non-Docker

```sh
git clone <repository>
pnpm install [--frozen-lockfile]
pnpm build

scp dist/main.mjs your-server:main.js
ssh your-server "node main.js"
```

### Docker

```sh
git clone <repository>
docker build -t <name> .
docker tag <name> <location/repository:tag>
docker push <location/repository:tag>
```
