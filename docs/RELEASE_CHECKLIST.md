# Release Checklist

## Pre-Release Setup (One-Time)

### 1. Create Homebrew Tap Repository

```bash
# On GitHub, create a new public repository: timwuhaotian/homebrew-the-pair
# Then initialize it locally:
mkdir homebrew-the-pair
cd homebrew-the-pair
git init
mkdir Casks
echo "# Homebrew Tap for The Pair" > README.md
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/timwuhaotian/homebrew-the-pair.git
git push -u origin main
```

### 2. Configure GitHub Secrets

Go to `https://github.com/timwuhaotian/the-pair/settings/secrets/actions` and add:

| Secret                         | Description                               | How to Get                                     |
| ------------------------------ | ----------------------------------------- | ---------------------------------------------- |
| `MACOS_SIGNING_IDENTITY`       | Developer ID Application certificate name | Run `security find-identity -v -p codesigning` |
| `MACOS_CERTIFICATE_P12_BASE64` | Base64-encoded .p12 certificate           | `base64 -i cert.p12 \| pbcopy`                 |
| `MACOS_CERTIFICATE_PASSWORD`   | Certificate password                      | Password you set during export                 |
| `APPLE_ID`                     | Apple Developer email                     | Your Apple ID                                  |
| `APPLE_APP_SPECIFIC_PASSWORD`  | App-specific password                     | Generate at appleid.apple.com                  |
| `APPLE_TEAM_ID`                | 10-character team ID                      | Find in Apple Developer account                |
| `HOMEBREW_TAP_GITHUB_TOKEN`    | GitHub PAT with repo write access         | Create at github.com/settings/tokens           |

**For `HOMEBREW_TAP_GITHUB_TOKEN`:**

1. Go to https://github.com/settings/tokens/new
2. Select "Fine-grained tokens" or "Classic token"
3. Grant `repo` (full control) or `contents: write` access to `timwuhaotian/homebrew-the-pair`
4. Copy the token and add it as a secret

### 3. Verify Repository Settings

- [ ] Main repository (`timwuhaotian/the-pair`) is **public**
- [ ] Homebrew tap (`timwuhaotian/homebrew-the-pair`) is **public**
- [ ] GitHub Actions are enabled on main repository
- [ ] All secrets are configured

## Release Process

### Automatic Release (Recommended)

1. **Update version in `package.json`:**

   ```bash
   npm version patch  # or minor, major
   ```

2. **Commit and push to main:**

   ```bash
   git add package.json package-lock.json
   git commit -m "chore: bump version to x.x.x"
   git push origin main
   ```

3. **GitHub Actions will automatically:**
   - Detect version change
   - Build and sign macOS app
   - Notarize with Apple
   - Create GitHub release with DMG and ZIP
   - Update Homebrew cask formula
   - Push to homebrew-the-pair repository

4. **Monitor the workflow:**
   - Go to https://github.com/timwuhaotian/the-pair/actions
   - Watch "Publish Signed macOS + Homebrew" workflow
   - Check for any errors

### Manual Release (Fallback)

If automatic release fails:

1. **Build locally:**

   ```bash
   npm run build:mac
   ```

2. **Create release manually:**
   - Go to https://github.com/timwuhaotian/the-pair/releases/new
   - Tag: `v1.0.x`
   - Upload `dist/the-pair-1.0.x.dmg` and `dist/the-pair-1.0.x.zip`

3. **Update Homebrew cask manually:**
   - Run the "Sync Homebrew Cask (Manual)" workflow
   - Or manually update `Casks/the-pair.rb` in homebrew-the-pair

## Post-Release Verification

### 1. Verify GitHub Release

```bash
# Check release exists
open https://github.com/timwuhaotian/the-pair/releases/latest

# Verify assets are downloadable (should not require authentication)
curl -I https://github.com/timwuhaotian/the-pair/releases/download/v1.0.1/the-pair-1.0.1.dmg
```

### 2. Verify Homebrew Cask

```bash
# Check cask file exists
open https://github.com/timwuhaotian/homebrew-the-pair/blob/main/Casks/the-pair.rb

# Test installation (on a clean machine or VM)
brew tap timwuhaotian/the-pair
brew install --cask the-pair

# Verify app launches
open -a "The Pair"
```

### 3. Verify Code Signature

```bash
# Download DMG
curl -L -o the-pair.dmg https://github.com/timwuhaotian/the-pair/releases/download/v1.0.1/the-pair-1.0.1.dmg

# Mount and verify
hdiutil attach the-pair.dmg
codesign --verify --deep --strict --verbose=2 "/Volumes/The Pair/The Pair.app"
spctl -a -vv "/Volumes/The Pair/The Pair.app"
hdiutil detach "/Volumes/The Pair"
```

### 4. Test Installation Flow

**New User Experience:**

1. User runs: `brew tap timwuhaotian/the-pair`
2. User runs: `brew install --cask the-pair`
3. User opens app from Applications folder
4. macOS should NOT show "unidentified developer" warning (if properly signed and notarized)
5. App should launch successfully

## Troubleshooting

### Issue: Homebrew install fails with 404

**Cause:** Release assets are not publicly accessible

**Fix:**

- Ensure main repository is public
- Ensure release is published (not draft)
- Verify DMG URL is accessible without authentication

### Issue: "App is damaged and can't be opened"

**Cause:** Code signature or notarization issue

**Fix:**

1. Verify all signing secrets are correct
2. Check notarization logs in GitHub Actions
3. Re-run workflow or manually notarize

### Issue: Workflow doesn't trigger

**Cause:** Version in package.json didn't change

**Fix:**

- Ensure version was actually bumped
- Or manually trigger workflow from Actions tab

### Issue: Homebrew tap push fails

**Cause:** `HOMEBREW_TAP_GITHUB_TOKEN` doesn't have write access

**Fix:**

1. Regenerate token with correct permissions
2. Update secret in repository settings

## Version Bump Guidelines

- **Patch (1.0.x):** Bug fixes, minor improvements
- **Minor (1.x.0):** New features, non-breaking changes
- **Major (x.0.0):** Breaking changes, major rewrites

## Release Cadence

- **Patch releases:** As needed for bug fixes
- **Minor releases:** Every 2-4 weeks for new features
- **Major releases:** When breaking changes are necessary

## Communication

After each release:

1. Update CHANGELOG.md
2. Announce on GitHub Discussions (if enabled)
3. Update README.md if installation process changed
4. Consider tweeting/posting about major releases
