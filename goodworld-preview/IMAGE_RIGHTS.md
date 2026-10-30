# GoodWorld: verified photography register

Last checked: 2026-10-30.

For each photo displayed in GoodWorld, record image ownership, original official source, credit, and a rights basis. **Do not copy image assets automatically from RSS feeds.** The database table `public.goodworld_story_images` is the publication allowlist; the client loads this via a public read-only policy restricted to published stories. The Render build also looks up these records to generate photos on individual HTML pages, archive thumbnails, OpenGraph previews and Article JSON-LD.

## Three approved photos

| GoodWorld story | Official image | Source-specific credit | Terms |
|---|---|---|---|
| `nasa-station-new-solar-array-2026` | https://www.nasa.gov/wp-content/uploads/2026/10/blog-useva100-102926e.jpg | NASA | https://www.nasa.gov/nasa-brand-center/images-and-media/ |
| `nasa-voyager-power-saved-2026` | https://science.nasa.gov/wp-content/uploads/2024/04/pia21737.jpg | NASA/JPL-Caltech | https://www.nasa.gov/nasa-brand-center/images-and-media/ |
| `noaa-chesapeake-oyster-reef-2026` | https://www.fisheries.noaa.gov/s3/2026-10/2000x1333-mdnroysterrestorationhoopersstrait-mollyfeltner-noaa-3.jpg | Molly Feltner/NOAA | https://www.fisheries.noaa.gov/national/about-us/website-policies-and-disclaimers |

Photos are used within factual, non-promotional editorial news. The exact photo appears on its original official announcement, where the photographer/agency credit was individually checked. Other agency and third-party images remain excluded. The presence of a NASA/NOAA domain alone does **not** establish universal image rights.

## Rules

1. Never import hotlinked photos, media:content, enclosures, or embedded images from RSS automatically.
2. Require a checked agency-owned source image. Verify credit on the *specific image*, not just the page. NASA and NOAA occasionally publish licensed third-party images that **cannot** be reused through blanket public-domain assumptions.
3. Store `story_id`, exact image URL, `credit`, `credit_url`, `alt_text`, `rights_basis`, `rights_url` and review timestamp in the DB register. Only then set `goodworld_stories.image_url`.
4. The frontend checks that public story image URL exactly matches the registered record; otherwise it shows the original GoodWorld decorative fallback rather than a potentially unlicensed image. Photo credit links point back to the original agency announcement.
5. The static HTML builder validates the same register before emitting image elements, `og:image` or JSON-LD Article `image` tags.
6. Government agency/photographer credit is informational; GoodWorld is independent, and no agency endorses it.
7. If an image becomes unavailable or a rights concern is raised, revoke the registered entry and clear `goodworld_stories.image_url`, then redeploy to remove the cached static HTML image.

## Future automated news

Our `gov-` short source briefs are published without photographs by default. Attach a photo only after the specific image passes this register's rights verification. We favor accurate licensed imagery over arbitrary web-search thumbnails or copied photographs from commercial news sites.
