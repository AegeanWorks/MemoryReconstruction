# Contributing

## Setup

```bash
npm install
npm run dev
```

Node.js 20 or newer is required (`engines` in `package.json`).

## Workflow

1. Make the change in the layer it belongs to (see [ARCHITECTURE.md](ARCHITECTURE.md)).
2. For a behaviour change in `src/sim`, write or update a test in `tests/sim/`
   that fails before the change and passes after it.
3. Play it: `npm run dev`, and check the affected screen or fight.
4. Run the same checks CI runs:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Conventions

- TypeScript strict mode. Prettier formatting is enforced by ESLint.
- Files are named after their main export (`World` → `world.ts`, classes in
  view/UI use PascalCase files such as `Renderer.ts`).
- Comments explain *why*; names explain *what*.
- Unit tests stay fast (well under 10 ms each) and spawn no processes.
- User-visible changes update `README.md` in the same commit.

## Commits

Conventional commits: `type(scope): subject`, where type is one of
`feat, fix, refactor, docs, chore, test, perf, build, ci`.
