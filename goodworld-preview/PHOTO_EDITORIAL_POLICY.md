# GoodWorld photo selection, licensing and daily editorial QA

Policy effective: 20 November 2026. Applies to every public news card, SEO story page, shared preview and localized page.

## 1. The image must tell the same story
Before an image is published, compare the actual visible contents with the verified English story, not just search keywords or a file name. Reject photos if the visible age, number or relationship of subjects, animal species, country implied by the photo, stage of an event, setting or action contradicts the headline. A photo of a teenager is unacceptable for an article about a 15-month-old baby. A mother with a toddler is unacceptable for a reunion with an adult son after 26 years. Do not use a city, hospital façade, road, landscape or random landmark as a substitute for people and actions unless that actual place is integral to the story. The reader should understand the subject within one second. Look for candid emotion, clear subject, crop compatibility, adequate resolution, and mobile legibility.

## 2. Authenticity and consent
Priority A: the actual event or subject, legally supplied with a documented license or permission by the copyright holder or an authorised agency. Check the exact grant (worldwide internet, editorial publication, article previews and social media, transformations/crops, duration, advertising implications) and attribution required. A press release or linked original article is **not** permission by itself. Never copy original reporting photos on an assumption of fair use or news reporting.

Priority B: a semantically appropriate licensed editorial image of the exact subject/species/device, with honest *representative* caption when it is not the event.

Priority C: CC BY, CC BY-SA, CC0 or legitimate stock photo depicting the same relevant scene, age, species and emotional meaning. Check provenance and exact license, and preserve author credit and license link. CC BY-SA adaptations may bring ShareAlike obligations. Avoid incompatible CC-NC, CC-ND and unknown/no-rights claims without case-specific legal approval. For stock libraries use only the exact permitted service and licensing agreement (e.g. official Pexels/Unsplash pages), not third-party copies.

The *right to use a photograph* does not override third-party portrait, privacy, publicity, medical confidentiality or publicity rights. For specific illnesses, disability, trauma, sexual violence, children and humanitarian recipients, use only authorised authentic photos or carefully vetted non-identifying/abstract photos that do not label identifiable uninvolved models as patients or victims. Photograph and caption must not imply that a stock model actually experienced the reported illness or crisis.

## 3. Mandatory rights metadata
Each article's goodworld_stories.image_url must match its goodworld_story_images.image_url. Keep story_id, image URL, original artist/creator, original source page, license name, license URL or signed permission reference, accurate alt text, rights_basis, image_kind ('source' if actual event with verified permission, 'representative' if not), and image_rights_status. Clearly disclose 'Representative photo' on the image and in article captions, with alt text specifying what the photo *actually* shows and what it does not show. If resized/cropped, say so. No uncited image generation, fabricated news-photo composites, or fake attribution.

Before accepting, fetch the actual URL without private credentials and verify HTTP 200 and Content-Type image/*. Check rendering on the public site (desktop + mobile when available), including the feed card and full story page. Preserve licenses and captions in generated HTML and alt text. A generic working URL or database row does not prove that the photo loads in users' browsers. Where feasible verify visual appearance and crop, not just image titles and HTTP codes.

## 4. Fail-closed process and daily operating cycle
1. Research article and verify events, dates and factual uncertainties.
2. Seek originals directly from source, press media centre or photographer; where not licensed, request permission instead of copying. Record any fee/conditions and seek explicit owner approval before purchasing.
3. Search CC/Wikimedia or correctly licensed stock for age/scene/species-appropriate alternatives; review actual images, not text metadata alone.
4. Check privacy and moral/identity risks. Do not associate identifiable unrelated persons with specific illness, misfortune or vulnerable status.
5. Verify each final URL (HTTP 200, image/*), and save attribution, license evidence, rationale, alt_text and representative/source label alongside story.
6. Publish, build, and verify full public pages/feed. If any check fails, **do not publish the story** or replace/hide the photo as editorially appropriate; report the blocker accurately.
7. Every day, audit the past 48 hours of live stories first, then work through the backlog of older editorial stories. Record which photos were approved, replaced, rejected, need rights permission, or require visual/manual review. Do not quietly claim an entire archive is perfect without examining each actual image.
8. Only scale site promotion after a stable multi-day run with accurate reporting, natural translated text and relevant, legally cleared images.

## 5. Quality score (human judgment)
Score subject-event match, age/relationships/species, emotional/visual relevance, rights/privacy, technical loading and crop readability. An image that fails any factual or legal criterion must be replaced or rejected regardless of total score. Avoid unrelated generic landmarks. Daily review must seek exact-event photos before using representative images.

This document is a GoodWorld editorial operating policy, not a legal opinion. For an agency licensing contract or difficult editorial/privacy usage, ask a qualified lawyer or the rights holder before publishing.
