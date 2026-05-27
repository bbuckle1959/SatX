# Reset a GitHub Release and start over

Use this when a release page is crowded, has wrong assets, or you want a clean tag and CI run.

## 1. Delete the release on GitHub (browser)

1. Open [https://github.com/bbuckle1959/SatX/releases](https://github.com/bbuckle1959/SatX/releases).
2. Open the release (e.g. **v0.1.0**).
3. Click **Delete** (confirm).

If there is no Delete button, you may only have a tag — skip to step 2.

## 2. Delete the git tag (local and remote)

Replace `v0.1.0` with your tag name.

```bash
git tag -d v0.1.0
git push origin --delete v0.1.0
```

Deleting the remote tag often removes an attached release automatically.

## 3. Commit the latest workflow and docs

Ensure [`.github/workflows/release.yml`](../../.github/workflows/release.yml) (organized assets) is on `main`:

```bash
git add .
git commit -m "Organize GitHub release assets and docs"
git push origin main
```

## 4. Create a fresh release

**Option A — CI (all platforms):**

```bash
git tag v0.1.0
git push origin v0.1.0
```

Watch **Actions → release**. When it finishes, check Releases for up to five named installers and the download table in the description.

**Option B — Windows only (local build):**

```powershell
npm run tauri:build
```

Upload only renamed files from [github-releases.md](github-releases.md) when creating a **Draft new release** on GitHub.

## 5. Optional: install GitHub CLI

```powershell
winget install GitHub.cli
```

Then:

```bash
gh release delete v0.1.0 --repo bbuckle1959/SatX --yes
git push origin --delete v0.1.0
```

[← GitHub Releases layout](github-releases.md)
