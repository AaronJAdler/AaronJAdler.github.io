# aaronjadler.github.io

Portfolio site for Aaron Adler: data engineering projects, a live ArcGIS map of California
wildfire risk, and the CAL FIRE 2021 dashboard. Plain HTML and CSS, served by GitHub Pages.

- `index.html`: projects and experience
- `wildfire-map.html`: the [wildfire-risk-feed](https://github.com/AaronJAdler/wildfire-risk-feed)
  ArcGIS Online Instant App, embedded
- `wildfire-history.html`: the dashboard from [ca-wildfire-elt](https://github.com/AaronJAdler/ca-wildfire-elt)
- `study-guide.html` (+ `study-guide.css`): the Data Engineering Study Guide, a 26-week plan, in the site's layout
- `study-guide-phone.html`: the same guide as a standalone phone study app (progress and flashcards saved in `localStorage`)
- The K-12 attendance card links to the dashboard and ArcGIS map that
  [K12AttendanceReportingPipeline](https://github.com/AaronJAdler/K12AttendanceReportingPipeline) deploys to its own Pages site

## Accessibility

The site targets WCAG 2.1 AA. See `accessibility.html` for the statement shown to visitors.

- `settings.js` and `settings.css`: the Display settings panel (theme, colorblind-safe chart colors with line
  patterns, higher contrast, larger text, underlined links). Choices are saved in `localStorage` under
  `aja-display` and applied as `data-*` attributes on `<html>`; a one-line script in each page's `<head>`
  applies them before first paint. Without JavaScript the site follows the system light or dark setting.
- Every page has a skip link, visible focus styles and a labelled main navigation. Chart values on
  `wildfire-history.html` are keyboard sliders with value text, and every chart has a table view.
- Checked on 2026-11-07 with axe-core 4.14 (WCAG 2.0/2.1/2.2 A and AA plus best practices): 0 violations on all
  4 pages, in light and dark system mode, at 1280 and 320 px, for 9 settings combinations, with the settings
  panel open and closed. Not yet tested by hand with a screen reader.
