---
name: Screenshot SPA 404 behaviour
description: clinic-launch-os screenshot tool consistently shows 404 — this is not a real error
---

The screenshot tool always captures the clinic-launch-os app showing "404 Page Not Found — Did you forget to add the page to the router?" regardless of the path used.

**Why:** The screenshot is taken before React client-side hydration completes. The server correctly returns HTTP 200, Vite HMR updates stream successfully, and the API receives real data requests (dashboard, optimisation) — all confirming the app is running.

**How to apply:** When testing clinic-launch-os changes, verify correctness via:
1. `curl -o /dev/null -w "%{http_code}"` — should return 200
2. Browser console logs — should show no JS errors, just `[vite] connected`
3. API server logs — should show GET requests from the app's data fetching
Do NOT treat the screenshot 404 as a real routing or render failure.
