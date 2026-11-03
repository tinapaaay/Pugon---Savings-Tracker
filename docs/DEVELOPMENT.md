# Development and maintenance

## Run locally

From the repository root, run `python3 -m http.server 5500`, then open [localhost:5500](http://localhost:5500). Python 3 is only a development-server option; VS Code Live Server also works. Stop the server with Ctrl+C. No package installation or build is required to serve this checkout.

## Implementation and boundaries

`script.js` loads goals from `pugon-goals` in localStorage, renders template cards, and saves after create, contribution, delete, or demo reset. Each goal has id, name, recipe, target, saved, and icon fields. Display currency is PHP. This records manually entered amounts; it does not move money or connect to a bank. Storage access failures and malformed record shapes are not fully handled.

## Make changes

Edit `demoGoals`, milestone thresholds in `getStage`, and currency formatting in `script.js`. Edit dialogs/templates in `index.html` and appearance in `styles.css`.

## Source map

- [`index.html`](../index.html)
- [`script.js`](../script.js)
- [`styles.css`](../styles.css)

## Verification

No automated test command is provided by this repository. The following manual checks are a checklist, not a claim that browser QA has been completed.

1. Create a goal, add a contribution, refresh, and confirm the saved amount and total.
2. Check 25/50/75/100% milestones and contributions above the target; the bar is capped at 100%.
3. On a disposable origin, test cancel/confirm deletion, empty state, and reset to demo goals.
4. Inspect the browser console and Network panel for missing assets or script errors; check keyboard access, phone width, and 200% zoom.

## Deployment

Serve the tracked HTML, CSS, JavaScript, and required assets from a static host, preserving relative paths and filename case. There is no application server or environment-variable configuration in this checkout. Verify the actual deployment URL, external resources, and the checks below after publishing. A repository existing on GitHub does not by itself prove Pages is enabled.

## Keep documentation current

Update the README and this guide when entry points, dependencies, behavior, or deployment steps change. Record commands actually run and distinguish them from pending manual checks.
