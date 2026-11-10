# GitHub repository setup

| Setting | Value |
| --- | --- |
| Repository | `Company-Data-and-Solutions` |
| Display title | Company Data and Solutions (CDS) |
| Version | 1.0.0 |
| Visibility | Public source for portfolio review |
| Rights | All rights reserved; not an open-source release |
| Description | Search company financial data, compare performance, and explore business insights. |
| Topics | `python`, `sql`, `sqlite`, `javascript`, `html`, `css`, `analytics`, `portfolio` |

Use the intended account's actual username and verified or GitHub-provided
commit email. The author display name and GitHub username are separate. Do not
invent account details or add credentials to the repository.

The source folders belong at the repository root, with `README.md` and `LICENSE`
visible alongside them. The project archive is a transfer copy, not a substitute
for browsable source files on GitHub.

## Publication

Create the repository, commit the reviewed release, then push `main`. Enable
GitHub Pages with **GitHub Actions** as its source and run **Publish website** if
needed. After successful deployment, use the returned URL for the repository's
Website field and the README's live demo link. See [deployment.md](deployment.md).

Create a Git tag `v1.0.0` at the release commit. The text in [release.md](release.md)
is the prepared GitHub release description. Future updates can use the same
repository and website with a new version and changelog entry.

## Project presentation

Show both the live demo and repository links beside the project title. The demo
lets a visitor use the website; the repository provides the Python pipeline,
SQL calculations, sources, checks and documentation for technical review.

The code is visible but not offered under an open-source license. GitHub's
platform terms still allow viewing and forking a public repository; the rights
notice does not prevent those actions. Third-party data and publications retain
their own terms.
