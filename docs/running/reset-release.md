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

### See the workflow on GitHub

1. Open [https://github.com/bbuckle1959/SatX/tree/main/.github/workflows](https://github.com/bbuckle1959/SatX/tree/main/.github/workflows) — you should see **`release.yml`** on the **main** branch.
2. Open **Actions** → left sidebar **release** (under “All workflows”). If the list is empty, push the workflow file to `main` first (step 3 below).
3. The workflow **only runs automatically** when you push a tag matching `v*` (e.g. `v0.1.0`). Pushes to `main` alone do not start it.
4. After the workflow includes **workflow_dispatch**, you can also use **Actions → release → Run workflow** to test without pushing a tag.

**Option A — CI (all platforms, tag):**

```bash
git tag v0.1.0
git push origin v0.1.0
```

Watch **Actions → release**. When it finishes, check Releases for up to five named installers and the download table in the description.

**Option A2 — CI (manual run):**

1. Open **Actions** → in the left sidebar under **Workflows**, click **release** (not a past run from the list).
2. Or open: [release workflow](https://github.com/bbuckle1959/SatX/actions/workflows/release.yml)
3. If you see **Run workflow** (top right), choose branch `main`, enter the tag (e.g. `v0.2.0`), and run.

If **Run workflow** is missing: you may lack write access, Actions may be disabled, or you are on a run detail page instead of the workflow page. Use **Option A** (push tag) instead.

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
