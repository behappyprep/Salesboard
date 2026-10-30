# GoodWorld source-rights review and precautionary removal
**Reviewed:** 2026-10-30. **Scope:** 22 configured feeds from 14 publishers, plus Nature and WWF, which already had published GoodWorld briefs.

## Standard used for the audit
The former GoodWorld automation stored RSS headline, publication date, excerpt and original link; it altered headlines and displayed up to 220 source excerpt characters to visitors. That is **more than simply linking to an external article**. The test here is whether the source has affirmative, identifiable permission to systematically collect, keep in a public editorial database, change and redistribute headlines/excerpts on a free site that may accept donations and eventually sell advertising.

**Conservative policy:** A source with no verified permission, no article-specific Creative Commons metadata, attribution restrictions, commercial-only restrictions, or ND (no-derivatives) constraints incompatible with the existing workflow is **not approved for the current system**. "Not approved" does not mean that independent factual news reporting, short lawful quotation, or ordinary outbound linking is prohibited by copyright. Nor is this an adjudication of actual infringement. A site can have CC-licensed stories in particular, while its general RSS is not blanket-licensed for adaptations.

## The 14 feed publishers, reviewed individually

| Publisher | Assessment for former auto-publisher | Official relevant source |
|---|---|---|
| Good News Network | **Exclude.** Requires express permission for republication, copying, derived works, or inclusion in a database beyond personal use or permitted share functions | https://www.goodnewsnetwork.org/more/legal/ |
| Good Good Good | **Exclude until permission.** Publishes its own and partner reporting, describes partnership-based syndication, but no general grant for adapting third-party RSS text was found | https://www.goodgoodgood.co/editorial-standards |
| Upworthy | **Exclude until permission.** The publisher lists a dedicated address for copyright and permission requests; no blanket reuse licence for RSS-based republication was confirmed | https://www.upworthy.com/contact-us/ |
| Reasons to be Cheerful | **Exclude from blanket feed.** Says most content uses Creative Commons, not all; specific story's license and applicable conditions must be checked, with photos sometimes separately restricted | https://reasonstobecheerful.world/about/ |
| Positive News | **Exclude.** Website material is provided for personal non-commercial use and prohibits reproduction, derivatives and commercial exploitation without written permission | https://www.positive.news/terms-and-conditions/ |
| The Optimist Daily | **Exclude pending rights grant.** Copyright notice reserves rights; the located membership terms do not provide a general republication license for altered RSS summaries | https://www.optimistdaily.com/contact-us/ |
| ScienceDaily | **Exclude from this workflow.** Specifically allows certain *unchanged* RSS headlines and summaries with attribution and source link, but prohibits altering RSS text and storing it in a database without written consent | https://www.sciencedaily.com/terms.htm and https://www.sciencedaily.com/copyright.htm |
| Phys.org | **Exclude.** Published articles include notice disallowing reproduction beyond applicable exceptions without written permission | https://phys.org/news/2013-09-yahoo-singapore-lawsuit.html |
| YES! Magazine | **Exclude from this workflow.** Creative Commons applies only to designated text after 48h, forbids commercial use and alteration; images and third-party reprints may have separate rights | https://www.yesmagazine.org/about-reprints |
| The Guardian | **Exclude.** RSS expressly described for personal non-commercial uses; commercial content syndication is a separately licensed service | https://www.theguardian.com/help/feeds |
| NPR | **Exclude pending direct permission.** No verified grant for commercial automated republication was found. NPR-affiliated StateImpact Oklahoma feeds have explicit personal/non-commercial rights; this is supporting context, not proof of the exact npr.org feed's licence | https://stateimpact.npr.org/oklahoma/terms-of-use/ |
| Mongabay | **Exclude from former rewrite flow, but potentially usable via compliant syndication.** Mongabay invites republication under CC BY-ND 4.0, but requires article author, exact source link and essentially unchanged text. Our transformed RSS excerpts/current metadata were not verified against this license | https://news.mongabay.com/copyright/creative-commons/ |
| Smithsonian Magazine | **Exclude.** Smithsonian Magazine has a formal licensing process for reuse and even requires a contractual canonical tag for licensed online republication | https://www.smithsonianmag.com/licensing/ and https://www.smithsonianmag.com/licensing/corporate/create/ |
| Fix The News | **Exclude pending explicit permission.** Independent publication/newsletter hosted via Substack, where rights remain with content creators; no blanket license to transform and republish the newsletter in a competing RSS database found | https://www.fixthenews.com/help and https://substack.com/tos |

## Two additional publishers already represented in GoodWorld

| Publisher | Assessment | Official terms |
|---|---|---|
| Nature / Springer Nature | **Exclude.** General terms restrict syndication, systematic copying, data feeds, commercial publication and creation of databases absent explicit permissions; licences vary by article | https://www.nature.com/info/terms-and-conditions |
| WWF | **Exclude.** Site materials allow only personal noncommercial use and prohibit commercial distribution, derivative uses and systematic harvesting without authorisation | https://www.worldwildlife.org/legal-notices/site-terms/ |

## Actions carried out

- Paused the two hourly Supabase Cron jobs `goodworld-rss-discovery-hourly` and `goodworld-hourly-positive-news`. The SEO sitemap-only rebuild is independent and remains scheduled.
- Deployed Edge Function `goodworld-news-collector` v5 as an inert, zero-sources collector. All 22 third-party RSS URLs have been removed from its deployed source.
- Disabled `goodworld_private.publish_hourly()` itself as an additional server-side protection.
- Deleted **26 published GoodWorld story records** derived from GNN (18), ScienceDaily (4), Nature (2), The Optimist Daily (1), and WWF (1). These had not been shown to carry reuse permissions compatible with our old workflow. Deletion cascades to related likes; the publisher and collector operational run logs remain, without linked story records.
- Cleared **417 saved RSS candidate records**, including from 13 feed publishers actually recorded in the candidate table. The fourteenth publisher had not necessarily generated a row at audit time.
- Removed the 23 committed article HTML pages from the GoodWorld GitHub branch, cleared the static sitemap and archive, and modified `build-seo.mjs` to support an intentionally empty copyright-cleared archive.
- No automatic RSS republication will occur while these protections remain.

**Note:** Some of the old 23 curated briefs were original summaries of facts rather than copied paragraphs. We removed them out of caution in accordance with the owner's request to eliminate anything sourced from publishers whose current distribution permissions are unverified. This does **not** mean their independent factual content was necessarily infringing.

## Restart requirements

Do **not** turn the hourly jobs back on or reinstate the prior legacy collector/migration.

Start with one of:
1. Individually confirmed article-level licenses that expressly permit the intended automated use, commercial site inclusion, storage and any adaptation; retain verifiable license metadata, author credit and required links.
2. Licensed syndication partnerships with the publishers.
3. Independently reported stories based on facts and primary sources, written from scratch with fact-checking and original images or specifically licensed photos, not using restricted feeds in ways that violate terms.

Once verified: build a new rights-aware pipeline, add per-article legal provenance metadata and block any content lacking clearance. A RSS URL by itself does not grant reuse rights. Consult qualified counsel before scaling international commercial publication.

## Search cleanup
Article URLs deleted from the deployed site should return HTTP 404/410, and their entries should be removed from https://www.goodworld.news/sitemap.xml. Google may retain cached search listings temporarily; optionally use Search Console removals for faster hiding.
