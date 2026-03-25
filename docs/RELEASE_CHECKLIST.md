# Release Checklist

Use this checklist before cutting a public release of The Pair.

## 1. Repo Hygiene

- [ ] Working tree is clean except for the intended release commit
- [ ] Version in `package.json` is bumped
- [ ] `CHANGELOG.md` includes the release notes
- [ ] `README.md` still matches the current install and test flow
- [ ] `LICENSE`, `README.md`, `CONTRIBUTING.md`, and `SECURITY.md` are present

## 2. Quality Gates

Run these commands locally before tagging:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## 3. Release Metadata

- [ ] `package.json` still points to the correct repository and bugs URLs
- [ ] `src-tauri/Cargo.toml` has the correct package metadata
- [ ] `docs/RELEASE_CHECKLIST.md` was reviewed for any stale release process notes
- [ ] Release notes mention any breaking changes or migration steps
- [ ] `TAURI_SIGNING_PRIVATE_KEY` and optional password secrets are configured in GitHub Actions
- [ ] The updater signing key validates in CI before the build stage
- [ ] `src-tauri/tauri.conf.json` `plugins.updater.pubkey` matches the current updater private key

## 4. Binary Checks

- [ ] App launches locally after the build
- [ ] Icons render correctly on macOS, Windows, and Linux bundles
- [ ] Release artifacts are generated for macOS, Windows, and Linux
- [ ] `npm run preflight`, `npm run build:mac`, `npm run build:win`, or `npm run build:linux` work for the target platform

## 5. GitHub Release

- [ ] Tag the release with a `v` prefix, for example `v1.1.4`
- [ ] Publish the GitHub release after assets are attached
- [ ] Verify the release page downloads without authentication
- [ ] Verify the release notes are readable and complete

## 6. Post-Release Verification

- [ ] Download the published artifact from GitHub Releases
- [ ] Install and launch the app from the packaged artifact
- [ ] Confirm `npm test` still passes on the release commit
- [ ] Confirm the new version is visible in the app and release page

## Notes

- Keep the checklist updated whenever the release workflow changes.
- If signing or notarization is enabled, add the signing validation steps here before release day.
