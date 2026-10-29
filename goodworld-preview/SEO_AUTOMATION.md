# GoodWorld: automated search-indexable editorial pages

Last prepared: 2026-10-29. Branch `goodworld-preview`, no modifications to `main`.

## How it works

`build-seo.mjs` runs with Node.js from the *repository root* as part of Render's **static-site Build Command**.

It calls the **public, read-only** Supabase PostgREST endpoint using the same publishable key already used by the public GoodWorld frontend and the existing published-only RLS policy. No secret keys or server-role credentials are required.

It generates into `goodworld-preview/` (the existing Render static publish path):
- One real HTML page per eligible editorially approved story, `stories/<slug>.html`
- The crawlable `stories/index.html` archive with links to all eligible editorial pages
- `sitemap.xml` with homepage + archive + all eligible pages
- `seo-manifest.json` to track which pages were generated previously

The existing `archive.js` can refresh the archive in visitor browsers before the next deploy. The static HTML remains useful to crawlers if JavaScript doesn't execute.

**Publication rules:** Only `status='published'` articles with a legitimate HTTPS reporting URL, valid slug, a real original body (at least 200 characters), a meaningful summary/title, and a source name are indexed. Slugs beginning `auto-` are deliberately omitted: short automatically assembled RSS descriptions are not independently verified, original news articles. They remain visible in the live GoodWorld feed. This distinction is intentional for editorial trust and Google people-first content guidelines.

If a previously generated story becomes ineligible or is unpublished, the build removes **only previously managed files** listed in the manifest. It never deletes unrelated article files. It fails safely if the source API is unavailable or there are zero qualified stories, so Render keeps the last successful deployment.

## Prepared and tested

- The code and initial manifest for **23 editorial articles** are committed to `goodworld-preview`.
- The build was tested with an export of real Supabase database rows: 24 published records (23 eligible original briefs + one `auto-` RSS brief) produced **23 HTML files, a 23-story archive, and a 25-URL sitemap**.
- Additional synthetic tests verify HTML escaping, correct canonical pages, exclusion of automatic summaries, and removal of only previously managed/unpublished pages.
- No non-GoodWorld repo files or default branch files were touched.

## Activation: one Render setting

Go to the existing GoodWorld static site:

https://dashboard.render.com/static/srv-dbbtbitpkucs73eel9u0/settings

In **Build & Deploy → Build Command**, replace the existing `echo 'GoodWorld static deployment'` with:

```bash
node goodworld-preview/build-seo.mjs
```

Keep **Root Directory** as the repository root (currently blank) and **Publish Directory** as `goodworld-preview`. Save and click **Manual Deploy → Deploy latest commit**.

After a successful deploy, check:
- https://www.goodworld.news/stories/
- https://www.goodworld.news/sitemap.xml (currently should list 25 URLs)
- A representative editorial story, e.g. https://www.goodworld.news/stories/news-90769d14c89442d89bff842069b79c80.html
- Direct new editor-approved stories will be linked by the frontend without needing hardcoded slug lists.

## Nightly SEO refresh: schedule installed, hook not yet configured

**Verified 2026-10-29:** the Render static site has Build Command `node goodworld-preview/build-seo.mjs`. Render build logs show **23 editorial articles, an archive and 25 sitemap URLs**, and the service has deployed successfully. Public HTTP checks against `https://www.goodworld.news` confirm:
- `/sitemap.xml`: HTTP 200, `application/xml`
- `/stories/`: HTTP 200, `text/html`
- `/stories/news-90769d14c89442d89bff842069b79c80.html`: HTTP 200, `text/html`

A Supabase Cron job named `goodworld-seo-refresh-daily` is **already created** and active, with schedule `30 3 * * *` UTC (03:30 UTC, 04:30 Slovakia winter / 05:30 summer). The job is a guarded no-op until the owner supplies a secret Deploy Hook URL. The job refuses an endpoint that does not match the exact Render service ID and excludes hooks with a `ref=` override.

**One remaining owner step:** Copy the unmodified **Deploy Hook URL** from the GoodWorld service's Render Settings and save it, **directly in Supabase Vault**, using the exact secret name `goodworld_render_deploy_hook` in project `jdmpmrhyjitmjyjuhtds`. No extra SQL setup is required. Never paste the hook into chat, source code, issue comments or public commits.

With the Vault secret present, the existing daily Cron triggers Render's Deploy Hook and the Render build pulls currently approved editor-written Supabase stories to regenerate `stories/*.html`, the archive and `sitemap.xml` automatically. A full production test of this cross-platform trigger cannot be run until the secret has been supplied.

**Operations:** Track cron job state using SQL, and confirm actual scheduled Render deployments and generated sitemap. A scheduled Cron record marked `succeeded` proves only that the SQL ran, not that Render successfully built the site. It is normal for no new URL to be added when no new qualifying editorial article has been approved. Existing hourly RSS discovery and feed updates continue independently.

The exact safe Cron SQL, with **no keys in source**, is stored in:
`supabase/migrations/20261029_goodworld_daily_seo_refresh.sql`.

## Discarded approach

A Supabase Edge Function named `goodworld-pages` was tested but the Supabase gateway forcibly changes HTML/XML GET responses to `text/plain` and applies a restrictive sandbox CSP. This is unsuitable for Google's real HTML/XML indexing. Its public endpoint was retired with a 410 JSON response and `X-Robots-Tag: noindex`. **No Render rewrites should point at Supabase Edge Functions.** The only supported plan is the Render static build described here.
