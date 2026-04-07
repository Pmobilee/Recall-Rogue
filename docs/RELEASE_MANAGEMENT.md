# Release Management

## Versioning Scheme

Recall Rogue uses [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.x.x → 2.x.x): Breaking save compatibility, major system overhauls
- **MINOR** (1.0.x → 1.1.x): New features, content additions, balance changes
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, hotfixes, stability improvements
- **Pre-release**: `-rc.1`, `-rc.2` for release candidates

**Current version**: See `package.json`

## Branch Strategy

| Branch | Purpose | Steam Branch |
|--------|---------|--------------|
| `main` | Always stable, always deployable | `default` (players) |
| `staging` | Pre-release QA builds | `staging` (internal) |
| `feature/*` | In-progress features | — |
| `fix/*` | Bug fix branches | — |

## Release Checklist

Before any tagged release:

### 1. Code Quality
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — clean build, check bundle size
- [ ] `npx vitest run` — all 1900+ tests pass
- [ ] `npm run registry:sync` — registry up to date

### 2. Balance
- [ ] Headless sim: 1000+ runs, all profiles within target win rates
- [ ] No untested card mechanics or relics (check `npm run registry:stale`)

### 3. Content
- [ ] `node scripts/verify-all-decks.mjs` — 0 failures
- [ ] All knowledge decks bridged to trivia DB
- [ ] No missing sprites or audio assets

### 4. Performance
- [ ] Combat FPS ≥50 sustained on target hardware
- [ ] Save/load <500ms
- [ ] Memory <300MB after 1hr session
- [ ] Bundle size <15MB (excluding audio)

### 5. Accessibility
- [ ] Color-blind mode functional
- [ ] Keyboard navigation for all screens
- [ ] Text scaling works at 80%–150%

### 6. Documentation
- [ ] `docs/` up to date with code
- [ ] CHANGELOG.md updated
- [ ] GAME_DESIGN.md synced

### 7. Deployment
- [ ] Version bumped in `package.json`
- [ ] Git tag created: `git tag v1.0.0`
- [ ] Steam build uploaded via `/steam-deploy`
- [ ] Steam branch promoted: `staging` → `default`

## Release Cadence

- **Major releases**: As needed (save-breaking changes)
- **Minor releases**: Every 4-6 weeks (new content, features, balance)
- **Patch releases**: As needed (critical bug fixes within 24-48hrs)

## Hotfix Process

1. Branch from latest tag: `git checkout -b fix/critical-bug v1.0.0`
2. Fix, test, commit
3. Tag: `git tag v1.0.1`
4. Deploy to Steam `default` immediately
5. Merge back to `main`

## Post-Launch Roadmap Template

```
v1.1.0 (6 weeks post-launch)
- Balance pass based on player feedback + headless sim
- 2-3 new relics
- UI improvements from community feedback

v1.2.0 (12 weeks post-launch)
- New content: 5+ curated decks
- Multiplayer improvements
- Accessibility enhancements
```
