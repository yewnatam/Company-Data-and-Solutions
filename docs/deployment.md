# Deployment and updates

## Recommended host: GitHub Pages

CDS produces a static website. Python and SQLite run during the build; visitors
use the generated HTML, CSS and JavaScript. GitHub Pages can host this output
from the same repository that contains the source.

### First deployment

1. Create the public repository `Company-Data-and-Solutions` in the intended
   GitHub account and upload the source folders as files, rather than uploading
   only an archive.
2. In the repository settings, open **Pages** and set the publishing source to
   **GitHub Actions**.
3. Push the release to `main`, or run **Actions → Publish website → Run workflow**.
4. Wait for the build and deployment jobs to succeed. Use the URL returned by
   the deployment, and add that real URL to the repository About area and README.
5. Open the site in a signed-out browser. Try search, a company report, Saved
   and a three-company comparison.

The workflow runs the Python data checks and JavaScript interface checks before
building and publishing `dist/`. A failed check stops that deployment.

### Future updates

Make a branch, change the source, and run:

```bash
python3 -m unittest discover -s tests -v
node --test tests/web.test.cjs
python3 -m cds build
```

Review `dist/index.html`, commit the changes and merge the branch into `main`.
The Pages workflow then deploys the tested website. Data updates also require
the source and fiscal-period review described in [data.md](data.md).

For a new release, update `VERSION` and `CHANGELOG.md`, tag the corresponding
commit, and publish release notes. Use `1.0.1` for a small fix, `1.1.0` for an
additional compatible feature, or `2.0.0` for a breaking change.

### Roll back

Revert the problematic source change through a new commit on `main` and let the
workflow build and deploy that reviewed state. Keep the Git history so the
change and reversal remain visible.

## Alternative host: Vercel

The same static output can be hosted on Vercel. The site does not require a
serverless Python function or a live database. For this release, GitHub Pages
is the configured deployment route; Vercel is an alternative rather than a
second automatic deployment.

The included `vercel.json` sets the framework to Other, runs the project checks
and Python build, and uses `dist` as the output directory. Import the repository
in Vercel and verify its build environment supplies Python 3.11 or later and
Node.js 22 or later. Confirm the deployment succeeds before adding its URL.

## Build files and local files

`dist/` and `.build/` are regenerated rather than committed. Local hosting state,
environment files, caches and bytecode remain ignored. No credentials are
needed by the website or the saved-data build.
