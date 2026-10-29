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

## Scheduling subsequent SEO refreshes independently of ChatGPT

Render rebuilds the static pages automatically on every Git commit to the deployed branch, but adding a row to Supabase **does not itself cause a Git commit**.

For full automation, use Render's existing **Deploy Hook** and Supabase's existing `pg_cron` + `pg_net` setup:

1. In Render Settings locate the secret **Deploy Hook URL**. **Do not paste this URL in a public GitHub repository, source file, or chat.**
2. Store the URL as a Supabase Vault secret named `goodworld_render_deploy_hook` in project `jdmpmrhyjitmjyjuhtds` using the Supabase dashboard. Check that its exact secret name exists; do not disclose the decrypted value.
3. In Supabase SQL Editor (or via authenticated backend management tool) run:

```sql
select cron.schedule(
 'goodworld-seo-refresh-daily',
 '30 3 * * *',
 $cron$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets
          where name='goodworld_render_deploy_hook'),
  headers := '{"Content-Type":"application/json"}'::jsonb,
  body := '{}'::jsonb,
  timeout_milliseconds := 10000
 )
 where exists (
  select 1 from vault.decrypted_secrets
  where name='goodworld_render_deploy_hook'
    and decrypted_secret like 'https://%'
 );
 $cron$
);
```

4. Confirm the job is active with `select jobname,schedule,active from cron.job where jobname='goodworld-seo-refresh-daily';`, check Render deploy logs, verify actual new sitemap results. Adjust to twice daily if editorial volume warrants it. This is an ordinary recurring daily deploy and consumes Render build minutes; watch the site's pipeline quota.

**Important:** The cron task is **not activated until the hook secret is configured and the user agrees to the refresh schedule**. Don't claim the entire end-to-end automation is active before then. Existing RSS collection and hourly feed publication are separate and continue as configured.

## Discarded approach

A Supabase Edge Function named `goodworld-pages` was tested but the Supabase gateway forcibly changes HTML/XML GET responses to `text/plain` and applies a restrictive sandbox CSP. This is unsuitable for Google's real HTML/XML indexing. Its public endpoint was retired with a 410 JSON response and `X-Robots-Tag: noindex`. **No Render rewrites should point at Supabase Edge Functions.** The only supported plan is the Render static build described here.
