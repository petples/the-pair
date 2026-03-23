# Homebrew Cask Setup Guide

This guide walks you through publishing The Pair to Homebrew Cask.

## Prerequisites

1. **GitHub Account** - You need a GitHub account (you have one: `timwuhaotian`)
2. **Apple Developer Account** - For code signing and notarization (optional but recommended)

---

## Step 1: Create Homebrew Tap Repository

1. Go to GitHub and create a new repository named: `homebrew-the-pair`
   - Or use the standard format: `homebrew-tap`

2. Initialize with a README:
   ```markdown
   # Homebrew Tap for The Pair
   
   This repository contains Homebrew Cask formulas for The Pair application.
   
   ## Installation
   
   ```bash
   brew tap timwuhaotian/the-pair
   brew install --cask the-pair
   ```
   
   ## Uninstall
   
   ```bash
   brew uninstall --cask the-pair
   brew untap timwuhaotian/the-pair
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

## Step 6: Automate Updates (Optional)

The repository includes a GitHub Actions workflow (`.github/workflows/update-cask.yml`) that automatically updates the cask when you publish a new release.

### Setup:

1. **Create a GitHub Personal Access Token**:
   - Go to: https://github.com/settings/tokens
   - Create token with `repo` scope
   - Name it `HOMEBREW_GITHUB_TOKEN`

2. **Add secret to main repository**:
   - Go to: https://github.com/timwuhaotian/the-pair/settings/secrets/actions
   - Add new secret: `HOMEBREW_GITHUB_TOKEN` = your token

3. **The workflow will**:
   - Trigger when you publish a new release
   - Download the DMG
   - Calculate SHA256
   - Update the cask file
   - Commit and push to your tap repository

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
