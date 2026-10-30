# GoodWorld Joy-First Asia Pipeline

Updated 2026-10-30.

## Production flow
1. Supabase cron `goodworld-joy-discovery-hourly` at UTC minute 40 calls `goodworld-joy-discovery`.
2. This reads Taipei Zoo's official full-text Chinese JSON feed at `https://www.zoo.gov.taipei/OpenData.aspx?SN=022A4E6F1C7F323A`.
3. Conservatively eligible stories are saved to private `public.goodworld_joy_discovery_queue`. No photos are copied or stories published.
4. Supabase cron `goodworld-joy-ai-review-hourly` at UTC minute 45 calls `goodworld-joy-ai-review` with a randomly generated private worker token stored in Supabase Vault, not in code or Git.
5. Once an API key is configured, the AI function translates the full original text to English, scores stories (warmth, surprise, universal appeal, concrete happy outcome, sharing), and rejects non-joyful ones. Passing requires >=21/25, warmth and concrete outcome >=4, and a verified positive outcome. Results still remain PRIVATE, pending review of individual text rights, images and editorial facts.

## Required one-time setup
- Obtain an OpenAI API key with separate API billing at https://platform.openai.com/api-keys.
- In Supabase Dashboard for project `jdmpmrhyjitmjyjuhtds`, navigate to Edge Functions > Secrets.
- Add secret **GOODWORLD_OPENAI_API_KEY** containing the API key value. Do not paste it into chat, GitHub or frontend.
- The secret becomes available without redeploying. The next cron invocation will process up to three queued stories, provided the daily run cap has not been reached.
- The function's protected GET status reports whether an AI key is configured; this does not reveal its value.

## Cost and safety controls
- Model: `gpt-4o-mini`. Each request uses OpenAI Structured Outputs, `store:false`, capped output tokens and a timeout.
- At most three news stories per invocation and 12 invocation runs in a rolling 24 hours.
- AI POST requires a service-role credential or a private, hashed worker token; normal public app keys cannot trigger it.
- No AI draft is published automatically. All image rights and each original article's licensing exceptions require a final human review.
- `public.goodworld_joy_discovery_queue` and audit tables deny SELECT access to anon/authenticated users. RLS is enabled.

## Forestry API status
- Discovered government open dataset: `https://www.forest.gov.tw/Data/Json/0004547`, license `https://data.gov.tw/license`.
- On 2026-10-30 it returned HTTP 200 with content-length 0. Source remains `review_only`, not in cron. Resume only after receiving actual records and validating schema and content rights.

## Existing queue
Four Taipei Zoo discoveries passed a conservative local-language keyword/outcome prefilter. These are not yet AI-scored or published. A past set of ten uninteresting government press releases was rejected and its cron disabled.

## Development
Deployed Edge Function: `goodworld-joy-ai-review` (Supabase). This source file lives at `supabase/functions/goodworld-joy-ai-review/index.ts` in the `goodworld-preview` Git branch.
