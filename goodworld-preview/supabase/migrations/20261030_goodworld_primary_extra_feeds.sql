-- Expand the vetted primary-government source registry with tested official feeds.
-- All four URLs returned HTTP 200 and valid RSS or Atom on 2026-10-30.
insert into public.goodworld_primary_sources(source_key,name,feed_url,host,path_re,category,license_id,license_url,credit,enabled)
values
('nasa-station','NASA','https://www.nasa.gov/blogs/spacestation/feed/','www.nasa.gov',
 '^/blogs/spacestation/','Innovation','US-GOV-PD','https://www.nasa.gov/nasa-brand-center/images-and-media/',
 'NASA official mission information. No affiliation with or endorsement by NASA.',true),
('nasa-voyager','NASA','https://science.nasa.gov/blogs/voyager/feed/','science.nasa.gov',
 '^/blogs/voyager/','Innovation','US-GOV-PD','https://www.nasa.gov/nasa-brand-center/images-and-media/',
 'NASA official mission information. No affiliation with or endorsement by NASA.',true),
('uk-natural-england','Natural England','https://www.gov.uk/government/organisations/natural-england.atom','www.gov.uk',
 '^/government/news/','Nature & Planet','OGL-3.0',
 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
 'Contains public sector information licensed under Open Government Licence v3.0; adapted by GoodWorld.',true),
('uk-science','UK Department for Science, Innovation and Technology','https://www.gov.uk/government/organisations/department-for-science-innovation-and-technology.atom','www.gov.uk',
 '^/government/news/','Innovation','OGL-3.0',
 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
 'Contains public sector information licensed under Open Government Licence v3.0; adapted by GoodWorld.',true)
on conflict(source_key) do update set enabled=excluded.enabled,checked_at=now(),feed_url=excluded.feed_url,host=excluded.host,path_re=excluded.path_re;
