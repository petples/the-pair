# Homebrew Cask Setup Guide

This guide covers the release flow now used in this repository:

`push to main` -> detect `package.json` version bump -> build signed/notarized macOS release -> publish GitHub release -> update Homebrew tap cask.

## Prerequisites

1. **GitHub Account** - You need a GitHub account (you have one: `timwuhaotian`)
2. **Apple Developer Account** - Required for Developer ID signing and notarization

---

## Required GitHub Secrets

Add these repository secrets in `Settings -> Secrets and variables -> Actions`:

1. `MACOS_CERTIFICATE_P12_BASE64`
   - Your exported Developer ID Application certificate as a `.p12`, base64-encoded
   - You can generate it with:
     ```bash
     base64 -i developer-id.p12 | pbcopy
     ```

2. `MACOS_CERTIFICATE_PASSWORD`
   - The password you set when exporting that `.p12`

3. `MACOS_SIGNING_IDENTITY`
   - The exact certificate identity string
   - Usually looks like:
     ```text
     Developer ID Application: Your Name or Company (TEAMID)
     ```
   - You can inspect it with:
     ```bash
     security find-identity -v -p codesigning
     ```

4. `APPLE_ID`
   - The Apple ID email used for notarization

5. `APPLE_APP_SPECIFIC_PASSWORD`
   - An app-specific password from https://appleid.apple.com/

6. `APPLE_TEAM_ID`
   - Your Apple Developer Team ID

7. `HOMEBREW_TAP_GITHUB_TOKEN`
   - A GitHub personal access token that can push to `timwuhaotian/homebrew-the-pair`
   - Minimal practical scope: repository contents write access to that tap repo

---

## Step 1: Create Homebrew Tap Repository

1. Go to GitHub and create a new repository named: `homebrew-the-pair`
   - Or use the standard format: `homebrew-tap`

2. Initialize with a README:

   ````markdown
   # Homebrew Tap for The Pair

   This repository contains Homebrew Cask formulas for The Pair application.

   ## Installation

   ```bash
   brew tap timwuhaotian/the-pair
   brew install --cask the-pair
   ```
   ````

   ## Uninstall

   ```bash
   brew uninstall --cask the-pair
   brew untap timwuhaotian/the-pair
   ```

   ```

   ```

---

## Step 2: Create Cask File

1. In your new repository, create the directory structure:

   ```
   homebrew-the-pair/
   └── Casks/
       └── the-pair.rb
   ```

2. Copy the content from `homebrew-cask/the-pair.rb` (in this repo) to your tap repository.

3. **Update the version and SHA256**:
   ```ruby
   version "1.0.0"  # Match your release version
   sha256 "abc123..."  # See Step 3
   ```

---

## Step 3: Calculate SHA256 Hash

After publishing a release on GitHub:

```bash
# Download the DMG
curl -L -o the-pair.dmg "https://github.com/timwuhaotian/the-pair/releases/download/v1.0.0/the-pair-1.0.0.dmg"

# Calculate SHA256
shasum -a 256 the-pair.dmg

# Output will be like: abc123...  the-pair.dmg
# Copy the hash to your cask file
```

---

## Step 4: Commit and Push

```bash
# Clone your tap repository
git clone https://github.com/timwuhaotian/homebrew-the-pair.git
cd homebrew-the-pair

# Create Casks directory
mkdir -p Casks

# Add the cask file
# (Copy the-pair.rb here and edit version/SHA256)

# Commit
git add Casks/the-pair.rb
git commit -m "Add the-pair cask v1.0.0"
git push origin main
```

---

## Step 5: Test Installation

On a clean macOS system (or VM):

```bash
# Add your tap
brew tap timwuhaotian/the-pair

# Install
brew install --cask the-pair

# Verify
brew list --cask | grep the-pair

# Run
open -a "The Pair"
```

---

## Step 6: Automate Updates

The repository now uses `.github/workflows/build-signed-mac.yml` as the primary release pipeline.

### What happens automatically

1. Push to `main`
2. Workflow checks whether `package.json` version changed
3. If the version changed, it:
   - builds the signed macOS app
   - notarizes and staples the DMG
   - creates or updates the GitHub release for `v<version>`
   - recalculates the Homebrew SHA256
   - commits the updated cask to `timwuhaotian/homebrew-the-pair`

### Manual fallback

If you ever need to repair the cask without rebuilding the app, use:

- `.github/workflows/update-cask.yml`
- Trigger it manually with the released version number

---

## Step 7: Submit to Homebrew/homebrew-cask (Optional)

To make The Pair available to all Homebrew users:

1. **Fork** [`Homebrew/homebrew-cask`](https://github.com/Homebrew/homebrew-cask)

2. **Add your cask**:

   ```bash
   git clone https://github.com/YOUR_USERNAME/homebrew-cask.git
   cd homebrew-cask
   mkdir -p Casks/t
   cp ../the-pair.rb Casks/t/
   ```

3. **Run audit**:

   ```bash
   brew install brew-test-bot
   brew audit --cask the-pair --strict
   ```

4. **Fix any issues** reported by the audit

5. **Submit PR**:

   ```bash
   git add Casks/t/the-pair.rb
   git commit -m "Add the-pair v1.0.0"
   git push origin HEAD
   # Create pull request on GitHub
   ```

6. **Wait for review** - Homebrew maintainers will review your submission

**Requirements for homebrew-cask**:

- App must be signed and notarized
- SHA256 must be correct
- Cask must follow [homebrew-cask guidelines](https://github.com/Homebrew/homebrew-cask/blob/master/CONTRIBUTING.md)
- No duplicate casks

---

## Troubleshooting

### "SHA256 mismatch"

```bash
# Re-calculate SHA256
shasum -a 256 /path/to/the-pair-*.dmg

# Update cask file with correct hash
```

### "App is damaged" (Gatekeeper)

Ensure your app is signed and notarized:

```bash
# Check signature
codesign --verify --verbose /Applications/the-pair.app

# Check notarization
spctl --assess --type exec --verbose /Applications/the-pair.app
```

### "Cannot open because developer cannot be verified"

User needs to manually approve in System Preferences:

1. Go to System Preferences → Security & Privacy
2. Click "Open Anyway"
3. Or disable Gatekeeper temporarily (not recommended)

### Brew audit fails

Common issues:

- **Missing description**: Add clear `desc` field
- **Bad URL**: Ensure download URL is correct
- **Version mismatch**: Version in cask must match release tag

---

## Quick Reference

### Install from your tap

```bash
brew tap timwuhaotian/the-pair
brew install --cask the-pair
```

### Uninstall

```bash
brew uninstall --cask the-pair
brew untap timwuhaotian/the-pair
```

### Check installed version

```bash
brew info --cask the-pair
```

### Update cask

```bash
brew update
brew upgrade --cask the-pair
```

---

## Resources

- [Homebrew Cask Documentation](https://docs.brew.sh/Cask-Cookbook)
- [Cask Token Reference](https://docs.brew.sh/Cask-Token-Reference)
- [Homebrew/homebrew-cask](https://github.com/Homebrew/homebrew-cask)
- [The Pair README](../README.md)
