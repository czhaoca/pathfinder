# Versioning Strategy

## Overview

Pathfinder follows [Semantic Versioning 2.0.0](https://semver.org/) with modifications for pre-1.0 development phase.

## Current Version

The current version is tracked in the `VERSION` file at the repository root. This is the single source of truth for the project version.

## Version Format

### Pre-1.0 (Beta Development Phase)

During the beta development phase (current), versions follow this pattern:

```
0.MINOR.PATCH[-PRERELEASE]
```

- **0**: Major version remains 0 during beta
- **MINOR**: Incremented for new features and significant changes
- **PATCH**: Incremented for bug fixes and minor improvements
- **PRERELEASE**: Optional prerelease identifier

#### Prerelease Identifiers

- `beta.X`: Beta releases (current phase)
- `rc.X`: Release candidates (approaching stable)
- No suffix: Stable pre-1.0 release

Examples:
- `0.1.0-beta.1` - First beta release
- `0.1.0-beta.2` - Second beta release
- `0.1.0-rc.1` - Release candidate
- `0.1.0` - Stable pre-1.0 release
- `0.2.0-beta.1` - New feature beta

### Post-1.0 (Production Phase)

After reaching 1.0.0, standard semantic versioning applies:

```
MAJOR.MINOR.PATCH[-PRERELEASE]
```

- **MAJOR**: Breaking API changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)
- **PRERELEASE**: Optional prerelease identifier

## Version Management

### Manual Version Management

Use the version management script:

```bash
# Check current version
node scripts/version.js current

# Bump versions
node scripts/version.js patch      # 0.1.0 -> 0.1.1
node scripts/version.js minor      # 0.1.1 -> 0.2.0
node scripts/version.js major      # 0.2.0 -> 1.0.0
node scripts/version.js prerelease # 0.1.0 -> 0.1.0-beta.1

# Set specific version
node scripts/version.js set 0.2.0-beta.1

# Create git tag
node scripts/version.js minor --tag "Feature release"
```

### Automated Release Process

GitHub Actions workflow handles releases:

1. **Manual Release** (Recommended for beta):
   - Go to Actions → Release workflow
   - Select version bump type
   - Workflow automatically:
     - Updates version files
     - Creates git tag
     - Generates changelog
     - Creates GitHub release
     - Deploys to beta environment (if applicable)

2. **Tag-based Release**:
   - Create and push a version tag: `git tag v0.1.0-beta.2`
   - Push tag: `git push origin v0.1.0-beta.2`
   - Workflow creates release from tag

## Version Files

Version is synchronized across:
- `/VERSION` - Single source of truth
- `/package.json` - Root package version
- `/backend/package.json` - Backend package version
- `/frontend/package.json` - Frontend package version

## Release Channels

### Beta Channel (Current)
- Version pattern: `0.x.y-beta.z`
- Frequent releases with new features
- May contain bugs
- API may change
- For testing and feedback

### Release Candidate Channel
- Version pattern: `0.x.y-rc.z`
- Feature complete
- Bug fixes only
- API stabilizing
- For final testing

### Stable Channel
- Version pattern: `x.y.z` (no prerelease)
- Production ready
- Stable API
- Full documentation
- Long-term support

## Environment Variables

Production deployments use GitHub environment variables:

```yaml
# Set in GitHub Secrets/Variables
NODE_ENV=production
API_VERSION=${GITHUB_REF_NAME}
DEPLOY_VERSION=${GITHUB_SHA}
```

## Version Display

The application displays version in:
- API responses: `X-API-Version` header
- Frontend footer: Version badge
- Admin dashboard: Full version info
- Health check endpoint: `/api/health`

## Migration Strategy

### Breaking Changes
- Document in CHANGELOG.md
- Provide migration guide
- Deprecation warnings in prior version
- Support overlap period when possible

### Database Migrations
- Version-tagged migration files
- Rollback procedures documented
- Test migrations in beta first

## Release Checklist

Before releasing:
- [ ] Update VERSION file
- [ ] Run tests
- [ ] Update documentation
- [ ] Review breaking changes
- [ ] Test deployment process
- [ ] Update CHANGELOG.md
- [ ] Create release notes

## Version History

| Version | Date | Type | Notes |
|---------|------|------|-------|
| 0.1.0-beta.1 | 2025-08-11 | Beta | Initial beta release |

## FAQ

### Why start at 0.1.0?
Following semantic versioning, 0.x.y indicates the API is not yet stable. This sets proper expectations during the development phase.

### When will 1.0.0 be released?
Version 1.0.0 will be released when:
- Core features are complete
- API is stable
- Documentation is comprehensive
- Production deployments are successful
- Security audit is complete

### How are hotfixes handled?
- Beta: Release as next beta version
- RC: Create patch RC (e.g., 0.2.0-rc.1 → 0.2.0-rc.2)
- Stable: Create patch release (e.g., 0.2.0 → 0.2.1)

### Can I use beta versions in production?
Not recommended. Beta versions are for testing and may contain bugs or breaking changes. Wait for stable releases for production use.