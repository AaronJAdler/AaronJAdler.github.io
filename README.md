# aaronjadler.github.io

Portfolio site for Aaron Adler: data engineering projects, a live ArcGIS map of California
wildfire risk, and the CAL FIRE 2021 dashboard. Plain HTML and CSS, served by GitHub Pages.

- `index.html`: projects and experience
- `wildfire-map.html`: the [wildfire-risk-feed](https://github.com/AaronJAdler/wildfire-risk-feed)
  ArcGIS Online Instant App, embedded
- `wildfire-history.html`: the dashboard from [ca-wildfire-elt](https://github.com/AaronJAdler/ca-wildfire-elt)
- The K-12 attendance card links to the dashboard and ArcGIS map that
  [K12AttendanceReportingPipeline](https://github.com/AaronJAdler/K12AttendanceReportingPipeline) deploys to its own Pages site
- `ctf/`: a static page for the purple-team training game from the private `cyberguard` repo. Players
  download `ctf/docker-compose.yml` (images on GHCR) and play at `http://127.0.0.1:8071` on their own
  machine; this page never talks to it. Keep `ctf/docker-compose.yml` in sync with cyberguard's
  `play/docker-compose.yml`.
- `.github/workflows/compose-policy.yml` blocks any change to `ctf/docker-compose.yml` that weakens the
  sandbox (privileged, host mounts, non-loopback ports, foreign images…). The checker in `scripts/` is a
  copy of cyberguard's. On release, replace `ctf/docker-compose.yml` with the digest-pinned
  `pinned-compose` artifact from cyberguard's images workflow.
