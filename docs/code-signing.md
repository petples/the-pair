# Code Signing & Notarization

This document provides detailed instructions for code signing and notarizing The Pair for macOS distribution.

## Release Flow Overview

The repository uses a GitHub Actions release pipeline:

```
push to main
  → detect package.json version bump
  → run lint, typecheck, and tests
  → build macOS/Windows/Linux release artifacts
  → codesign and notarize the macOS bundle
  → package ZIP on macOS plus Windows/Linux installers
  → create/update GitHub Release with all platform assets
```

The workflow file is: [build-signed-mac.yml](../.github/workflows/build-signed-mac.yml)

## What You Need from Apple

### 1. Apple Developer Program Membership

Apple's Developer ID docs state that software distributed outside the Mac App Store uses a Developer ID certificate plus notarization.

### 2. Developer ID Application Certificate

1. Sign in to `developer.apple.com`
2. Open `Certificates, Identifiers & Profiles`
3. Create a `Developer ID Application` certificate
4. Download the `.cer`
5. Double-click it to install it into Keychain Access

### 3. Export the Certificate as `.p12`

In Keychain Access:

1. Find `Developer ID Application: ...`
2. Export it as `.p12`
3. Set an export password

### 4. Apple ID App-Specific Password

Needed because the workflow uses `xcrun notarytool --apple-id --password --team-id`.

1. Go to `account.apple.com` → `Sign-In and Security` → `App-Specific Passwords`
2. Create a new app-specific password

### 5. Apple Team ID

Found under `Membership details` in your developer account.

## GitHub Actions Secrets

Configure these in `Settings → Secrets and variables → Actions`:

| Secret                         | What it is                                                              | How to get it                                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `MACOS_SIGNING_IDENTITY`       | Exact signing identity string used by Tauri as `APPLE_SIGNING_IDENTITY` | Run `security find-identity -v -p codesigning` after installing the certificate, then copy the `Developer ID Application: ...` line |
| `MACOS_CERTIFICATE_P12_BASE64` | Base64-encoded `.p12` export of your Developer ID Application cert      | `base64 -i /path/to/developer-id.p12 \| pbcopy` on macOS                                                                            |
| `MACOS_CERTIFICATE_PASSWORD`   | Password you chose when exporting the `.p12`                            | You set this during export                                                                                                          |
| `TAURI_SIGNING_PRIVATE_KEY`    | Tauri updater signing private key, stored as file contents or a path    | Generate it with `npm run tauri signer generate -- -w ~/.tauri/the-pair.key` and copy the private key into the secret                 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the updater private key, if you generated one         | Use the same password you passed to `tauri signer generate`                                                                          |
| `APPLE_ID`                     | Apple Account email used for notarization                               | Your Apple Developer account email                                                                                                  |
| `APPLE_APP_SPECIFIC_PASSWORD`  | App-specific password for notarization                                  | Go to `account.apple.com` → `Sign-In and Security` → `App-Specific Passwords`                                                       |
| `APPLE_TEAM_ID`                | 10-character Apple team identifier                                      | `developer.apple.com` → `Membership details`                                                                                        |

**Notes:**

- GitHub's built-in `GITHUB_TOKEN` is already used for creating/updating releases in the main repo. You do **not** need to add that one manually.
- The updater private key is the gatekeeper for shipping new versions to existing users. If you lose it, you can still ship a new app binary, but you must rotate the updater key pair and update `src-tauri/tauri.conf.json` with the new public key before the release can go out.

## Local Signed Build

For local release builds, copy `.env.example` to `.env` and fill in:

```bash
export CSC_NAME="Developer ID Application: Your Name (TEAMID)"
export CSC_KEY_PASSWORD="your-p12-password"
export CSC_LINK="/absolute/path/to/developer-id.p12"
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
export TEAM_ID="YOURTEAMID"

npm run preflight:mac
npm run build:mac
```

The local macOS build flow keeps the DMG-style installer you prefer. If you want to locally reproduce the ZIP-style release asset, run `npm run build:mac:release`. The release workflow still publishes ZIP assets to GitHub Releases for stability. The build flow will install the required Rust targets automatically when `rustup` is available. If you need to do it yourself, run:

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
```

The release workflow now publishes:

- macOS: `the-pair-{version}.zip`
- Windows: `the-pair-{version}-setup.exe`
- Linux: `the-pair-{version}.AppImage`

## Manual Notarization Check

If you want to verify notarization manually:

```bash
APP_PATH=$(find dist -maxdepth 3 -name "*.app" | head -n 1)
ZIP_PATH="dist/the-pair-{version}.zip"

ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_PATH"

xcrun notarytool submit "$ZIP_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$TEAM_ID" \
  --wait

xcrun stapler staple "$APP_PATH"
xcrun stapler validate "$APP_PATH"
```

## Verify Signature

```bash
APP_PATH=$(find dist -maxdepth 3 -name "*.app" | head -n 1)
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
```

## Do I Need App Store Connect Setup?

For the current workflow, **no App Store listing, no TestFlight app, and no App Store submission record are required**.

This is because the app is being distributed outside the Mac App Store via:

- GitHub Releases

### What You **Do** Need

- An active Apple Developer Program membership
- A `Developer ID Application` certificate
- Notarization credentials (`APPLE_ID`, app-specific password, `APPLE_TEAM_ID`)

### What You **Do Not** Need

- App Store app record
- TestFlight setup
- Provisioning profile for App Store distribution

The only App Store Connect-related case you may care about is team management. Apple notes that, for Apple Developer Program organizations, team member access is managed in App Store Connect. If you are a solo developer, you can ignore that.
