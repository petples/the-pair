# Homebrew Cask Formula for The Pair
# 
# Installation:
# 1. Copy this file to your homebrew tap repository:
#    timwuhaotian/homebrew-the-pair/Casks/the-pair.rb
# 
# 2. Users can then install with:
#    brew tap timwuhaotian/the-pair
#    brew install --cask the-pair
#
# Updating:
# When releasing a new version:
# 1. Update version number below
# 2. Update sha256 hash (download DMG and run: shasum -a 256 the-pair-*.dmg)
# 3. Commit and push to your tap repository

cask "the-pair" do
  version "1.0.0"
  sha256 "CHANGE_ME_TO_ACTUAL_SHA256_HASH"

  url "https://github.com/timwuhaotian/the-pair/releases/download/v#{version}/the-pair-#{version}.dmg",
      verified: "github.com/timwuhaotian/the-pair/"
  name "The Pair"
  desc "Desktop orchestrator for dual AI agents (Mentor + Executor) for autonomous coding tasks"
  homepage "https://github.com/timwuhaotian/the-pair"

  auto_updates true
  depends_on macos: ">= :monterey"

  app "The Pair.app"

  uninstall quit: "com.electron.the-pair"

  zap trash: [
    "~/.config/the-pair",
    "~/Library/Application Support/the-pair",
    "~/Library/Caches/com.electron.the-pair",
    "~/Library/Logs/the-pair",
    "~/Library/Preferences/com.electron.the-pair.plist",
    "~/Library/Saved Application State/com.electron.the-pair.savedState",
  ]
end
