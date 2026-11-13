// GoodWorld SEO build: public, editorially verified pages only.
// Run from the repository root with: node goodworld-preview/build-seo.mjs
// Output writes only into goodworld-preview (the existing Render publish directory).
// The hourly automatic RSS feed stays separate: short auto-briefs are not SEO articles.
import fs from "node:fs/promises";
import path from "node:path";

const OUT=path.resolve(process.env.GOODWORLD_OUTPUT_DIR||"goodworld-preview");
const STORIES_DIR=path.join(OUT,"stories");
const SHARE_DIR=path.join(OUT,"news");
const SITE="https://www.goodworld.news";
const API="https://jdmpmrhyjitmjyjuhtds.supabase.co/rest/v1/goodworld_stories";
const PHOTO_API="https://jdmpmrhyjitmjyjuhtds.supabase.co/rest/v1/goodworld_story_images";
const PUBLIC_KEY=process.env.GOODWORLD_SUPABASE_PUBLIC_KEY||"sb_publishable_Mi4xc0jwt_MFKhjKWZ1Vpw_bG6VPp3_";
const PAGE_SIZE=500;
const LOCALIZED={
 zh:{title:"好消息与积极新闻 | GoodWorld",description:"每日积极新闻：科学进步、动物救援、自然保护和真实的善意故事。",heading:"世界各地的好消息",label:"最新新闻"},
 hi:{title:"अच्छी खबरें और सकारात्मक समाचार | GoodWorld",description:"विज्ञान, प्रकृति, जानवरों और दया से जुड़ी प्रमाणित सकारात्मक खबरें।",heading:"दुनिया भर की अच्छी खबरें",label:"ताज़ा खबरें"},
 es:{title:"Buenas noticias de hoy | GoodWorld",description:"Buenas noticias verificadas sobre ciencia, animales, naturaleza y solidaridad.",heading:"Buenas noticias del mundo",label:"Últimas noticias"},
 ar:{title:"أخبار إيجابية من العالم | GoodWorld",description:"أخبار إيجابية موثوقة عن العلوم والطبيعة والحيوانات وأعمال الخير.",heading:"أخبار جيدة من أنحاء العالم",label:"آخر الأخبار"},
 fr:{title:"Bonnes nouvelles du monde | GoodWorld",description:"Des actualités positives et vérifiées sur la science, les animaux, la nature et la solidarité.",heading:"De bonnes nouvelles du monde",label:"Dernières actualités"},
 bn:{title:"বিশ্বের ভালো খবর | GoodWorld",description:"বিজ্ঞান, প্রাণী, প্রকৃতি ও মানবিকতার যাচাইকৃত ইতিবাচক সংবাদ।",heading:"সারা বিশ্বের ভালো খবর",label:"সর্বশেষ সংবাদ"},
 pt:{title:"Boas notícias do mundo | GoodWorld",description:"Notícias positivas e verificadas sobre ciência, natureza, animais e solidariedade.",heading:"Boas notícias do mundo",label:"Últimas notícias"},
 id:{title:"Berita baik dari dunia | GoodWorld",description:"Berita positif dan terverifikasi tentang sains, satwa, alam, dan kebaikan manusia.",heading:"Kabar baik dari seluruh dunia",label:"Berita terbaru"},
 ur:{title:"دنیا بھر کی اچھی خبریں | GoodWorld",description:"سائنس، فطرت، جانوروں اور انسانی مہربانی سے متعلق مصدقہ مثبت خبریں۔",heading:"دنیا بھر سے اچھی خبریں",label:"تازہ ترین خبریں"},
 ru:{title:"Хорошие новости со всего мира | GoodWorld",description:"Проверенные позитивные новости о науке, животных, природе и добрых поступках.",heading:"Хорошие новости со всего мира",label:"Последние новости"}
};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const iso=s=>new Date(s).toISOString();
const formatDate=s=>new Date(s).toLocaleDateString("en-US",{timeZone:"UTC",year:"numeric",month:"long",day:"numeric"});
const dateOnly=s=>iso(s).slice(0,10);
const slugOkay=s=>typeof s==="string" && /^[a-z0-9-]{5,120}$/.test(s);
function eligible(s){
  if(!s||s.status!=="published"||!slugOkay(s.slug)||s.slug.startsWith("auto-")||s.slug.startsWith("gov-"))return false;
  if(!s.title||s.title.trim().length<15||!s.summary||s.summary.trim().length<30)return false;
  if(!s.body||s.body.trim().length<200||!s.published_at||!Number.isFinite(Date.parse(s.published_at)))return false;
  if(!s.source_name||s.source_name.trim().length<3)return false;
  try{return new URL(s.source_url).protocol==="https:"}catch{return false}
}
function seoUrl(s){return SITE+"/stories/"+encodeURIComponent(s.slug)+".html"}
function articleHtml(s,other){
  const url=seoUrl(s),pub=iso(s.published_at);
  const photo=!!(s.image_url&&s.image_credit&&s.image_credit_url&&s.image_alt_text);
  const ld={
   "@context":"https://schema.org","@type":"NewsArticle",
   headline:s.title,description:s.summary,datePublished:pub,dateModified:pub,
   inLanguage:"en",isAccessibleForFree:true,isBasedOn:s.source_url,
   mainEntityOfPage:{"@type":"WebPage","@id":url},
   author:{"@type":"Organization",name:"GoodWorld Editorial",url:SITE},
   publisher:{"@type":"Organization",name:"GoodWorld",url:SITE},
   citation:s.source_url,articleSection:s.category,
   isPartOf:{"@type":"WebSite",name:"GoodWorld",url:SITE},
   ...(photo?{image:[s.image_url]}:{})
  };
  const safeLd=JSON.stringify(ld).replace(/</g,"\\u003c");
  const paragraphs=s.body.trim().split(/\n\s*\n/g).map(p=>"<p>"+esc(p)+"</p>").join("\n");
  const related=other.filter(x=>x.slug!==s.slug).slice(0,2).map(x=>
    '<a class="related-card" href="/stories/'+encodeURIComponent(x.slug)+'.html">'+
    esc(x.title)+'<span>Read brief ↗</span></a>').join("");
  return '<!doctype html><html lang="en"><head>'+
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="theme-color" content="#FFFFFF"><meta name="robots" content="index,follow,max-image-preview:large">'+
    '<title>'+esc(s.title)+' | GoodWorld</title>'+
    '<meta name="description" content="'+esc(s.summary)+'">'+
    '<link rel="canonical" href="'+esc(url)+'">'+
    '<meta property="og:type" content="article">'+
    '<meta property="og:site_name" content="GoodWorld">'+
    '<meta property="og:title" content="'+esc(s.title)+'">'+
    '<meta property="og:description" content="'+esc(s.summary)+'">'+
    '<meta property="og:url" content="'+esc(url)+'">'+
    '<meta property="article:published_time" content="'+esc(pub)+'">'+
    (photo?'<meta property="og:image" content="'+esc(s.image_url)+'">'+
      '<meta property="og:image:alt" content="'+esc(s.image_alt_text)+'">':'')+
    '<meta name="twitter:card" content="'+(photo?'summary_large_image':'summary')+'">'+
    '<link rel="icon" type="image/svg+xml" href="/favicon-globe.svg">'+
    '<link rel="stylesheet" href="/article.css">'+
    '<link rel="stylesheet" href="/analytics.css">'+
    '<script src="/analytics.js" defer></script>'+
    '<script type="application/ld+json">'+safeLd+'</script></head><body>'+
    '<header class="site-head"><a class="brand" href="/"><span>goodworld</span></a>'+
    '<a class="head-link" href="/stories/">All stories ↗</a></header>'+
    '<main class="article-wrap"><p class="eyebrow">'+esc(s.category)+
    ' <span class="dot">·</span><time datetime="'+esc(pub)+'">'+esc(formatDate(s.published_at))+'</time></p>'+
    '<article class="article"><h1>'+esc(s.title)+'</h1>'+
    '<p class="intro">'+esc(s.summary)+'</p>'+
    (photo?'<figure class="article-hero"><img src="'+esc(s.image_url)+
     '" alt="'+esc(s.image_alt_text)+'" loading="eager" decoding="async" referrerpolicy="no-referrer">'+
     '<figcaption>'+(s.image_kind==="representative"?
      'Representative photo, not a photograph of the reported event. ':'Official source photo. ')+
     '<a href="'+esc(s.image_credit_url)+
     '" target="_blank" rel="noopener noreferrer">Photo: '+esc(s.image_credit)+'</a>'+
     (s.image_rights_url? ' · <a href="'+esc(s.image_rights_url)+
     '" target="_blank" rel="noopener noreferrer">'+esc(s.image_license||"Image license")+'</a>':'')+
     ' · Cropped to fit layout</figcaption></figure>':'')+
    '<div class="article-body">'+paragraphs+'</div>'+
    '<div class="source-block"><p class="source-label">Original reporting</p>'+
    '<p>This is a GoodWorld editorial summary based on reporting by <strong>'+esc(s.source_name)+
    '</strong>. Follow the original reporting for additional details and context.</p>'+
    '<a href="'+esc(s.source_url)+'" target="_blank" rel="noopener noreferrer">Read original reporting ↗</a>'+
    '</div></article><nav class="story-navigation" aria-label="More positive news">'+
    '<h2>More good news</h2><div class="related">'+related+'</div></nav>'+
    '<p class="bottom-home"><a href="/stories/">← Browse more positive stories</a></p></main>'+
    '<footer class="site-footer">GoodWorld · Real positive news, free for everyone. · <a href="/">Live news</a> · <a href="/privacy.html">Privacy &amp; analytics</a></footer>'+
    '</body></html>\n';
}
function archiveHtml(stories){
  const cards=stories.map(s=>'<a class="archive-card" href="/stories/'+encodeURIComponent(s.slug)+'.html">'+
    (s.image_url&&s.image_credit?'<img class="archive-thumb" src="'+esc(s.image_url)+
     '" alt="'+esc(s.image_alt_text)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer">'+
     (s.image_kind==="representative"?'<span class="archive-photo-note">Representative photo</span>':''):'')+
    '<span class="category">'+esc(s.category)+'</span><strong>'+esc(s.title)+'</strong>'+
    '<time datetime="'+esc(iso(s.published_at))+'">'+esc(formatDate(s.published_at))+'</time></a>').join("\n");
  return '<!doctype html><html lang="en"><head>'+
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="theme-color" content="#FFFFFF">'+
    '<meta name="robots" content="index,follow,max-image-preview:large">'+
    '<title>Good news stories | GoodWorld</title>'+
    '<meta name="description" content="Browse original, source-linked GoodWorld positive news briefs about nature, animals, community kindness and real progress.">'+
    '<link rel="canonical" href="'+SITE+'/stories/">'+
    '<meta property="og:type" content="website"><meta property="og:site_name" content="GoodWorld">'+
    '<meta property="og:title" content="Good news stories | GoodWorld">'+
    '<meta property="og:url" content="'+SITE+'/stories/">'+
    '<link rel="icon" type="image/svg+xml" href="/favicon-globe.svg">'+
    '<link rel="stylesheet" href="/article.css">'+
    '<link rel="stylesheet" href="/analytics.css">'+
    '<script src="/analytics.js" defer></script></head><body>'+
    '<header class="site-head"><a class="brand" href="/"><span>goodworld</span></a>'+
    '<a class="head-link" href="/">Live news feed ↗</a></header>'+
    '<main class="article-wrap"><p class="eyebrow">GOODWORLD LIBRARY</p>'+
    '<h1 class="archive-title">Good news worth sharing.</h1>'+
    '<p class="archive-intro">'+(stories.length
      ? 'Original, source-linked positive news briefs from around the world. For the latest hourly updates, visit our <a href="/">live news feed</a>.'
      : 'Our editorial library is being reviewed for source permissions and publishing rights. We will add independently reported or properly licensed positive stories when they are ready.')+'</p>'+
    '<section class="archive-grid" aria-label="Browse GoodWorld news stories">'+cards+'</section>'+
    '<p class="bottom-home"><a href="/">← Back to the live GoodWorld feed</a></p></main>'+
    '<footer class="site-footer">GoodWorld · Free positive news for everyone. · <a href="/privacy.html">Privacy &amp; analytics</a></footer>'+
    '<script src="/archive.js" defer></script></body></html>\n';
}

function pageAlternates(available){
 const languages=["en",...available];
 return '<link rel="alternate" hreflang="x-default" href="'+SITE+'/">'+
 languages.map(language=>'<link rel="alternate" hreflang="'+language+
 '" href="'+SITE+(language==="en"?"/":"/"+language+"/")+'">').join("");
}
function relativeStaticPathToRoot(html){
 return html.replace(/(\b(?:href|src)=["'])\.\//g,"$1/");
}
function preRenderedFeed(allRows,photos,lang,translations){
 const meta=LOCALIZED[lang];
 const title=meta?.heading||"Real positive news, from verified sources";
 const summary=meta?.label||"Latest news";
 const readable=(allRows||[]).filter(x=>{
   if(!(x.status==="published"&&x.title&&x.summary&&x.source_url))return false;
   if(lang==="en")return true;
   const t=translations?.stories?.[x.id];
   return !!(t&&t.original_title===x.title&&t.original_summary===x.summary&&t.original_body===x.body);
  }).sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at)).slice(0,24);
 const cards=readable.map((s,i)=>{
  const translation=translations?.stories?.[s.id];
  const matched=translation&&translation.original_title===s.title&&
   translation.original_summary===s.summary;
  const heading=matched?translation.title:s.title;
  const body=matched?translation.summary:s.summary;
  const imageMeta=photos.get(s.id);
  const image=imageMeta&&imageMeta.image_url===s.image_url&&imageMeta.credit&&
   /^https:\/\//.test(imageMeta.credit_url)?s.image_url:null;
  const representative=!!(image&&imageMeta.image_kind==="representative");
  // Send Google and English readers directly to the crawlable, canonical article.
  // Short automatically sourced briefs keep the noindex reader page.
  const readerPath=(lang==="en"&&eligible(s))
    ? "/stories/"+encodeURIComponent(s.slug)+".html"
    : "/read.html?story="+encodeURIComponent(s.slug)+"&lang="+encodeURIComponent(lang);
  const newsTime=Number.isFinite(Date.parse(s.published_at))?
    '<time class="story-date" datetime="'+esc(iso(s.published_at))+'">'+esc(dateOnly(s.published_at))+'</time>':"";
  return '<article class="story'+(i===0?' is-featured':'')+(image?' has-photo':' is-text')+'">'+
   (image?'<div class="story-media"><img class="photo" src="'+esc(image)+
    '" alt="'+esc(imageMeta.alt_text||heading)+'" loading="'+(i===0?'eager':'lazy')+
    '" decoding="async" referrerpolicy="no-referrer"'+(i===0?' fetchpriority="high"':'')+'>'+
    (representative?'<span class="representative-label">Representative photo</span>':"")+
    '</div>':"")+
   '<div class="story-content"><div class="story-kicker"><span class="story-category">'+esc(s.category)+
   '</span>'+newsTime+'</div><h2 class="story-title"><a href="'+esc(readerPath)+'">'+esc(heading)+
   '</a></h2><p class="story-desc">'+esc(body)+'</p>'+
   '<div class="story-bottom"><a class="reader-link story-read-link" href="'+esc(readerPath)+'">Read story ↗</a></div>'+
   '<div class="story-microcredits">'+
   '<a href="'+esc(s.source_url)+'" title="'+esc(s.source_name||"Original publisher")+
   '" target="_blank" rel="noopener noreferrer">Source ↗</a>'+
   (image?'<a class="photo-credit" href="'+esc(imageMeta.credit_url)+
   '" target="_blank" rel="noopener noreferrer">© '+esc(imageMeta.credit)+'</a>'+
   (imageMeta.rights_url?'<a class="photo-license" href="'+esc(imageMeta.rights_url)+
   '" target="_blank" rel="noopener noreferrer">'+esc(imageMeta.image_license||"Image rights")+'</a>':""):"")+
   '</div></div></article>';
 }).join("\n");
 return '<div class="feed-shell" data-goodworld-server-rendered="1">'+
  '<div class="feed-heading"><h1>'+esc(title)+'</h1><p>'+esc(summary)+'</p></div>'+
  '<div class="stories-grid">'+cards+'</div></div>';
}
function replaceFeedContent(html,rendered){
 const exact='<section class="feed" id="feed" aria-label="Good news feed"></section>';
 if(!html.includes(exact))throw new Error("GoodWorld feed placeholder changed; refusing SEO build");
 return html.replace(exact,'<section class="feed" id="feed" aria-label="Good news feed">'+rendered+'</section>');
}
async function writeSearchLandingPages(rows,photos){
 const primary=path.join(OUT,"index.html");
 let base=await fs.readFile(primary,"utf8");
 const translations=new Map();
 for(const [language] of Object.entries(LOCALIZED)){
  try{
   const raw=JSON.parse(await fs.readFile(path.join(OUT,"translations",language+".json"),"utf8"));
   if(raw?.language===language&&raw?.stories&&Object.keys(raw.stories).length>0)
    translations.set(language,raw);
  }catch(err){if(err?.code!=="ENOENT")console.warn("Translation file invalid for",language)}
 }
 const langs=[...translations.keys()];
 const alternates=pageAlternates(langs);
 const mainFeed=preRenderedFeed(rows,photos,"en",null);
 const hero=rows.filter(s=>s.status==="published"&&s.image_url&&
   photos.get(s.id)?.image_url===s.image_url)
  .sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at))[0];
 const heroPreload=hero?'<link rel="preload" as="image" href="'+esc(hero.image_url)+
   '" referrerpolicy="no-referrer" fetchpriority="high">':"";
 base=replaceFeedContent(base,mainFeed);
 base=base.replace("</head>",heroPreload+alternates+
  '<meta name="robots" content="index,follow,max-image-preview:large">'+
  '<link rel="alternate" type="application/rss+xml" title="GoodWorld positive news RSS" href="/feed.xml">'+
  "</head>");
 await fs.writeFile(primary,base,"utf8");
 for(const language of langs){
  const meta=LOCALIZED[language];
  let html=relativeStaticPathToRoot(base);
  html=html.replace('<html lang="en">','<html lang="'+language+'"'+
    (language==="ar"||language==="ur"?' dir="rtl"':'')+'>');
  html=html.replace(/<title>[^<]+<\/title>/,'<title>'+esc(meta.title)+'</title>');
  html=html.replace(/<meta name="description" content="[^"]*"\/>/,
    '<meta name="description" content="'+esc(meta.description)+'"/>');
  html=html.replace(/<link rel="canonical" href="[^"]*"\/>/,
    '<link rel="canonical" href="'+SITE+'/'+language+'/"/>');
  html=html.replace(/<meta property="og:title" content="[^"]*"\/>/,
    '<meta property="og:title" content="'+esc(meta.title)+'"/>');
  html=html.replace(/<meta property="og:description" content="[^"]*"\/>/,
    '<meta property="og:description" content="'+esc(meta.description)+'"/>');
  html=html.replace(/<meta property="og:url" content="[^"]*"\/>/,
    '<meta property="og:url" content="'+SITE+'/'+language+'/"/>');
  html=html.replace('"inLanguage":"en"','"inLanguage":"'+language+'"');
  const preRendered=preRenderedFeed(rows,photos,language,translations.get(language));
  html=html.replace(mainFeed,preRendered);
  await fs.mkdir(path.join(OUT,language),{recursive:true});
  await fs.writeFile(path.join(OUT,language,"index.html"),html,"utf8");
 }
 return langs;
}

function sitemapXml(stories,locales,latestPublication){
  const lastmod=latestPublication?dateOnly(latestPublication):null;
  const urls=[{url:SITE+"/",lastmod},{url:SITE+"/stories/",lastmod},
    {url:SITE+"/about.html",lastmod:null},
    {url:SITE+"/editorial-policy.html",lastmod:null},
    {url:SITE+"/contact.html",lastmod:null}].concat(
    locales.map(lang=>({url:SITE+"/"+lang+"/",lastmod})),
    stories.map(s=>({url:seoUrl(s),lastmod:dateOnly(s.published_at)})));
  return '<?xml version="1.0" encoding="UTF-8"?>\n'+
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
    urls.map(x=>'  <url><loc>'+esc(x.url)+'</loc>'+
      (x.lastmod?'<lastmod>'+x.lastmod+'</lastmod>':'')+
      (x.url===SITE+"/"||locales.some(language=>x.url===SITE+"/"+language+"/")?
       '<changefreq>hourly</changefreq>':'')+
      '</url>').join("\n")+
    '\n</urlset>\n';
}



// Only editor-reviewed, indexable articles can enter the Google News sitemap.
// Google's News sitemap window is two days; short auto RSS briefs are noindex.
function googleNewsSitemapXml(editorialStories){
  const now=Date.now();
  const fresh=editorialStories.filter(s=>
    Number.isFinite(Date.parse(s.published_at))&&
    now-Date.parse(s.published_at)>=0&&
    now-Date.parse(s.published_at)<=48*60*60*1000);
  const ns='http://www.sitemaps.org/schemas/sitemap/0.9';
  const news='http://www.google.com/schemas/sitemap-news/0.9';
  const items=fresh.map(s=>
   '  <url><loc>'+esc(seoUrl(s))+'</loc><news:news>'+
   '<news:publication><news:name>GoodWorld</news:name><news:language>en</news:language></news:publication>'+
   '<news:publication_date>'+esc(iso(s.published_at))+'</news:publication_date>'+
   '<news:title>'+esc(s.title)+'</news:title>'+
   '</news:news></url>').join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n'+
   '<urlset xmlns="'+ns+'" xmlns:news="'+news+'">\n'+items+'\n</urlset>\n';
}

async function writeSocialPreviews(rows,photos){
 await fs.mkdir(SHARE_DIR,{recursive:true});
 const original=await fs.readFile(path.join(OUT,"read.html"),"utf8");
 const base=relativeStaticPathToRoot(original);
 const available=(rows||[]).filter(s=>s.status==="published"&&slugOkay(s.slug)&&
   s.title&&s.summary&&s.published_at&&Number.isFinite(Date.parse(s.published_at)));
 const used=new Set();
 let oldSlugs=[];
 try{
  oldSlugs=JSON.parse(await fs.readFile(path.join(OUT,"share-manifest.json"),"utf8"));
  if(!Array.isArray(oldSlugs))oldSlugs=[];
 }catch(err){if(err?.code!=="ENOENT")throw err}
 for(const s of available){
  if(used.has(s.slug))throw new Error("Duplicate public share slug: "+s.slug);
  used.add(s.slug);
  const shareUrl=SITE+"/news/"+encodeURIComponent(s.slug)+".html";
  const checked=photos.get(s.id);
  const verified=checked&&checked.image_url===s.image_url&&
   checked.credit&&/^https:\/\//.test(checked.credit_url);
  const date=dateOnly(s.published_at);
  const body=s.slug.startsWith("gov-")?"":String(s.body||"").split(/\n\s*\n/g).filter(Boolean)
   .map(p=>"<p>"+esc(p)+"</p>").join("");
  const media=verified?
   '<figure class="article-hero"><img class="reader-photo" src="'+esc(s.image_url)+
   '" alt="'+esc(checked.alt_text||s.title)+'" loading="eager" referrerpolicy="no-referrer">'+
   '<figcaption class="reader-image-credit">'+
   (checked.image_kind==="representative"?"Representative photo · ":"")+
   '<a href="'+esc(checked.credit_url)+'" rel="noopener noreferrer" target="_blank">'+esc(checked.credit)+'</a> · '+
   '<a href="'+esc(checked.rights_url||checked.credit_url)+'" rel="noopener noreferrer" target="_blank">'+
   esc(checked.image_license||"Image rights")+'</a></figcaption></figure>':"";
  const originalPage='<main id="articleRegion" class="reader-page" role="main" aria-live="polite"></main>';
  const article='<main id="articleRegion" class="reader-page" role="main" aria-live="polite">'+
   '<p class="reader-meta">'+esc(s.category)+' · '+date+' · '+esc(s.source_name)+'</p>'+
   '<h1>'+esc(s.title)+'</h1>'+media+
   '<p class="reader-summary">'+esc(s.summary)+(s.slug.startsWith("gov-")&&!/[.!?…]$/.test(s.summary)?"…":"")+'</p>'+
   (body?'<div class="read-news-body">'+body+'</div>':"")+
   '<div class="reader-citation"><a class="reader-link" href="'+esc(s.source_url)+
   '" target="_blank" rel="noopener noreferrer">Original source ↗</a></div></main>';
  if(!base.includes(originalPage))throw new Error("GoodWorld reader template changed");
  let html=base.replace(originalPage,article);
  html=html.replace(/<title>[^<]*<\/title>/,'<title>'+esc(s.title)+' | GoodWorld</title>');
  html=html.replace(/<meta name="description" content="[^"]*">/,
    '<meta name="description" content="'+esc(s.summary)+'">');
  // Noindex: shorter curated briefs and their machine translations are not
  // independent reporting. These pages exist for accurate link previews.
  const socialHead=
   '<link rel="canonical" href="'+shareUrl+'">'+
   '<meta property="og:type" content="article">'+
   '<meta property="og:site_name" content="GoodWorld">'+
   '<meta property="og:title" content="'+esc(s.title)+'">'+
   '<meta property="og:description" content="'+esc(s.summary)+'">'+
   '<meta property="og:url" content="'+shareUrl+'">'+
   '<meta property="article:published_time" content="'+esc(iso(s.published_at))+'">'+
   (verified?'<meta property="og:image" content="'+esc(s.image_url)+'">'+
   '<meta property="og:image:alt" content="'+esc(checked.alt_text||s.title)+'">':"")+
   '<meta name="twitter:card" content="'+(verified?"summary_large_image":"summary")+'">';
  html=html.replace("</head>",socialHead+"</head>");
  await fs.writeFile(path.join(SHARE_DIR,s.slug+".html"),html,"utf8");
 }
 for(const slug of oldSlugs){
  if(!slugOkay(slug)||used.has(slug))continue;
  try{await fs.unlink(path.join(SHARE_DIR,slug+".html"))}
  catch(err){if(err?.code!=="ENOENT")throw err}
 }
 await fs.writeFile(path.join(OUT,"share-manifest.json"),
  JSON.stringify([...used],null,2)+"\n","utf8");
 return used.size;
}

function buildRssFeed(rows){
 const recent=(rows||[]).filter(s=>s.status==="published"&&s.title&&s.summary&&
   s.published_at&&Number.isFinite(Date.parse(s.published_at)))
  .sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at)).slice(0,40);
 const xmlItems=recent.map(s=>{
  const url=SITE+"/read.html?story="+encodeURIComponent(s.slug)+"&amp;lang=en";
  return '  <item>\n'+
  '    <title>'+esc(s.title)+'</title>\n'+
  '    <link>'+url+'</link>\n'+
  '    <guid isPermaLink="false">goodworld:'+esc(s.id)+'</guid>\n'+
  '    <pubDate>'+new Date(s.published_at).toUTCString()+'</pubDate>\n'+
  '    <description>'+esc(s.summary)+" Source: "+esc(s.source_name||"Original publisher")+
    " ("+esc(s.source_url)+")</description>\n"+
  '    <category>'+esc(s.category||"Good news")+'</category>\n'+
  '  </item>';
 }).join("\n");
 return '<?xml version="1.0" encoding="UTF-8"?>\n'+
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>\n'+
  '  <title>GoodWorld · Real Positive News</title>\n'+
  '  <link>'+SITE+'/</link>\n'+
  '  <atom:link href="'+SITE+'/feed.xml" rel="self" type="application/rss+xml"/>\n'+
  '  <description>Verified positive news about science, animals, nature, medicine and human kindness. Linked to original sources.</description>\n'+
  '  <language>en</language>\n'+
  '  <lastBuildDate>'+(recent[0]?new Date(recent[0].published_at).toUTCString():new Date().toUTCString())+'</lastBuildDate>\n'+
  xmlItems+'\n</channel></rss>\n';
}

async function fetchPublished(){
  if(process.env.GOODWORLD_SEO_FIXTURE){
    const txt=await fs.readFile(path.resolve(process.env.GOODWORLD_SEO_FIXTURE),"utf8");
    const rows=JSON.parse(txt);
    if(!Array.isArray(rows))throw new Error("Fixture must be a JSON array");
    return rows;
  }
  const result=[];
  for(let offset=0;offset<10000;offset+=PAGE_SIZE){
    const url=new URL(API);
    url.searchParams.set("select","id,slug,title,summary,body,category,image_url,source_name,source_url,published_at,created_at,status");
    url.searchParams.set("status","eq.published");
    url.searchParams.set("published_at","not.is.null");
    url.searchParams.set("order","published_at.desc");
    url.searchParams.set("limit",String(PAGE_SIZE));
    url.searchParams.set("offset",String(offset));
    let response;
    for(let attempt=0;attempt<3;attempt++){
      try{
        response=await fetch(url,{headers:{"apikey":PUBLIC_KEY,"Accept":"application/json"},signal:AbortSignal.timeout(12000)});
        if(response.ok)break;
        if(response.status<500)throw new Error("Public editorial API returned HTTP "+response.status);
      }catch(err){
        if(attempt===2)throw err;
      }
      if(attempt<2)await new Promise(r=>setTimeout(r,350*(attempt+1)));
    }
    if(!response?.ok)throw new Error("Public editorial API unavailable. Build stopped to preserve the previous live deployment.");
    const rows=await response.json();
    if(!Array.isArray(rows))throw new Error("Unexpected editorial API response");
    result.push(...rows);
    if(rows.length<PAGE_SIZE)break;
  }
  return result;
}
async function fetchPhotoRights(){
  if(process.env.GOODWORLD_SEO_FIXTURE)return new Map();
  const url=new URL(PHOTO_API);
  url.searchParams.set("select","story_id,image_url,credit,credit_url,alt_text,rights_url,image_license,image_kind");
  url.searchParams.set("limit","2000");
  const res=await fetch(url,{
   headers:{"apikey":PUBLIC_KEY,"Accept":"application/json"},
   signal:AbortSignal.timeout(12000)
  });
  if(!res.ok)throw new Error("Verified photo provenance query failed. Aborting build to avoid uncredited photos.");
  const rows=await res.json();
  if(!Array.isArray(rows))throw new Error("Unexpected photo provenance response");
  return new Map(rows.map(x=>[x.story_id,x]));
}
async function fetchCuratedIds(){
  if(process.env.GOODWORLD_SEO_FIXTURE)return null;
  const endpoint=new URL(API.replace(/\/goodworld_stories(?:\?.*)?$/,"/rpc/get_goodworld_feed"));
  endpoint.searchParams.set("p_order","new");
  const response=await fetch(endpoint,{
    headers:{"apikey":PUBLIC_KEY,"Accept":"application/json"},
    signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)throw new Error("GoodWorld editorial feed unavailable; SEO build refused.");
  const data=await response.json();
  if(!Array.isArray(data))throw new Error("Unexpected editorial feed response");
  return new Set(data.map(item=>item.id));
}
async function main(){
  const rows=await fetchPublished();
  const curatedIds=await fetchCuratedIds();
  const visibleRows=curatedIds?rows.filter(row=>curatedIds.has(row.id)):rows;
  const photos=await fetchPhotoRights();
  const stories=rows.filter(eligible).map(story=>{
   const checked=photos.get(story.id);
   const verified=checked && checked.image_url===story.image_url &&
      /^https:\/\//.test(checked.credit_url) &&
      String(checked.credit||"").length>=3 &&
      String(checked.alt_text||"").length>=20;
   return {...story,
     image_url:verified?story.image_url:null,
     image_credit:verified?checked.credit:"",
     image_credit_url:verified?checked.credit_url:"",
     image_alt_text:verified?checked.alt_text:"",
     image_kind:verified?checked.image_kind:"source",
     image_license:verified?checked.image_license:"",
     image_rights_url:verified?checked.rights_url:""
   };
  }).sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at));
  // Copyright safety: zero approved stories is an intentional state.
  // Publish a clean, non-misleading archive and a 2-URL sitemap rather than
  // accidentally retaining potentially unlicensed previously built pages.
  const seen=new Set();
  for(const s of stories){
    if(seen.has(s.slug))throw new Error("Duplicate public story slug: "+s.slug);
    seen.add(s.slug);
  }
  const manifestPath=path.join(OUT,"seo-manifest.json");
  let oldSlugs=[];
  try{
    const old=JSON.parse(await fs.readFile(manifestPath,"utf8"));
    if(Array.isArray(old))oldSlugs=old.filter(slugOkay);
  }catch(error){
    if(error?.code!=="ENOENT")throw new Error("Cannot read existing SEO manifest safely");
  }
  await fs.mkdir(STORIES_DIR,{recursive:true});
  for(const s of stories){
    const related=stories.filter(x=>x.slug!==s.slug);
    await fs.writeFile(path.join(STORIES_DIR,s.slug+".html"),articleHtml(s,related),"utf8");
  }
  // Remove only our previously generated article pages if they are no longer
  // published or no longer meet editorial standards. Never delete untracked files.
  for(const slug of oldSlugs){
    if(seen.has(slug))continue;
    try{await fs.unlink(path.join(STORIES_DIR,slug+".html"))}
    catch(error){if(error?.code!=="ENOENT")throw error}
  }
  await fs.writeFile(path.join(STORIES_DIR,"index.html"),archiveHtml(stories),"utf8");
  const locales=await writeSearchLandingPages(visibleRows,photos);
  const latest=visibleRows.filter(s=>s.status==="published"&&s.published_at)
    .sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at))[0];
  await fs.writeFile(path.join(OUT,"sitemap.xml"),sitemapXml(stories,locales,latest?.published_at),"utf8");
  await fs.writeFile(path.join(OUT,"news-sitemap.xml"),googleNewsSitemapXml(stories),"utf8");
  await fs.writeFile(path.join(OUT,"feed.xml"),buildRssFeed(visibleRows),"utf8");
  const socialPages=await writeSocialPreviews(rows,photos);
  await fs.writeFile(manifestPath,JSON.stringify(stories.map(s=>s.slug),null,2)+"\n","utf8");
  console.log("GoodWorld SEO built: "+stories.length+" editorial pages, "+locales.length+" localized homepages, source-linked RSS and sitemap ("+(stories.length+5+locales.length)+" URLs)");
  console.log("GoodWorld social preview pages created: "+socialPages+" (noindex, unique article Open Graph metadata).");
  console.log("Excluded "+(rows.length-stories.length)+" public entries with insufficient editorial content or automatic RSS briefs.");
  console.log("Google News sitemap contains only editorially eligible articles dated within the last 48 hours.");
}
main().catch(error=>{console.error("GoodWorld SEO build failed:",error instanceof Error?error.message:"Unknown error");process.exitCode=1});
