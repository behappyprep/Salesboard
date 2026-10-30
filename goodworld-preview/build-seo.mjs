// GoodWorld SEO build: public, editorially verified pages only.
// Run from the repository root with: node goodworld-preview/build-seo.mjs
// Output writes only into goodworld-preview (the existing Render publish directory).
// The hourly automatic RSS feed stays separate: short auto-briefs are not SEO articles.
import fs from "node:fs/promises";
import path from "node:path";

const OUT=path.resolve(process.env.GOODWORLD_OUTPUT_DIR||"goodworld-preview");
const STORIES_DIR=path.join(OUT,"stories");
const SITE="https://www.goodworld.news";
const API="https://jdmpmrhyjitmjyjuhtds.supabase.co/rest/v1/goodworld_stories";
const PHOTO_API="https://jdmpmrhyjitmjyjuhtds.supabase.co/rest/v1/goodworld_story_images";
const PUBLIC_KEY=process.env.GOODWORLD_SUPABASE_PUBLIC_KEY||"sb_publishable_Mi4xc0jwt_MFKhjKWZ1Vpw_bG6VPp3_";
const PAGE_SIZE=500;
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
   "@context":"https://schema.org","@type":"Article",
   headline:s.title,description:s.summary,datePublished:pub,
   mainEntityOfPage:{"@type":"WebPage","@id":url},
   author:{"@type":"Organization",name:"GoodWorld Editorial",url:SITE},
   publisher:{"@type":"Organization",name:"GoodWorld",url:SITE},
   citation:s.source_url,articleSection:s.category,
   ...(photo?{image:[s.image_url]}:{})
  };
  const safeLd=JSON.stringify(ld).replace(/</g,"\\u003c");
  const paragraphs=s.body.trim().split(/\n\s*\n/g).map(p=>"<p>"+esc(p)+"</p>").join("\n");
  const related=other.filter(x=>x.slug!==s.slug).slice(0,2).map(x=>
    '<a class="related-card" href="/stories/'+encodeURIComponent(x.slug)+'.html">'+
    esc(x.title)+'<span>Read brief ↗</span></a>').join("");
  return '<!doctype html><html lang="en"><head>'+
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="theme-color" content="#FFF9F0"><meta name="robots" content="index,follow">'+
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
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">'+
    '<link rel="stylesheet" href="/article.css">'+
    '<link rel="stylesheet" href="/analytics.css">'+
    '<script src="/analytics.js" defer></script>'+
    '<script type="application/ld+json">'+safeLd+'</script></head><body>'+
    '<header class="site-head"><a class="brand" href="/">✳ <span>good<strong>world</strong></span></a>'+
    '<a class="head-link" href="/stories/">All stories ↗</a></header>'+
    '<main class="article-wrap"><p class="eyebrow">'+esc(s.category)+
    ' <span class="dot">·</span><time datetime="'+esc(pub)+'">'+esc(formatDate(s.published_at))+'</time></p>'+
    '<article class="article"><h1>'+esc(s.title)+'</h1>'+
    '<p class="intro">'+esc(s.summary)+'</p>'+
    (photo?'<figure class="article-hero"><img src="'+esc(s.image_url)+
     '" alt="'+esc(s.image_alt_text)+'" loading="eager" decoding="async" referrerpolicy="no-referrer">'+
     '<figcaption>Photo: <a href="'+esc(s.image_credit_url)+
     '" target="_blank" rel="noopener noreferrer">'+esc(s.image_credit)+
     '</a> · Official source image</figcaption></figure>':'')+
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
     '" alt="'+esc(s.image_alt_text)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'')+
    '<span class="category">'+esc(s.category)+'</span><strong>'+esc(s.title)+'</strong>'+
    '<time datetime="'+esc(iso(s.published_at))+'">'+esc(formatDate(s.published_at))+'</time></a>').join("\n");
  return '<!doctype html><html lang="en"><head>'+
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="theme-color" content="#FFF9F0">'+
    '<title>Good news stories | GoodWorld</title>'+
    '<meta name="description" content="Browse original, source-linked GoodWorld positive news briefs about nature, animals, community kindness and real progress.">'+
    '<link rel="canonical" href="'+SITE+'/stories/">'+
    '<meta property="og:type" content="website"><meta property="og:site_name" content="GoodWorld">'+
    '<meta property="og:title" content="Good news stories | GoodWorld">'+
    '<meta property="og:url" content="'+SITE+'/stories/">'+
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">'+
    '<link rel="stylesheet" href="/article.css">'+
    '<link rel="stylesheet" href="/analytics.css">'+
    '<script src="/analytics.js" defer></script></head><body>'+
    '<header class="site-head"><a class="brand" href="/">✳ <span>good<strong>world</strong></span></a>'+
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
function sitemapXml(stories){
  const urls=[{url:SITE+"/",lastmod:null},{url:SITE+"/stories/",lastmod:null}].concat(
    stories.map(s=>({url:seoUrl(s),lastmod:dateOnly(s.published_at)})));
  return '<?xml version="1.0" encoding="UTF-8"?>\n'+
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
    urls.map(x=>'  <url><loc>'+esc(x.url)+'</loc>'+
      (x.lastmod?'<lastmod>'+x.lastmod+'</lastmod>':'')+'</url>').join("\n")+
    '\n</urlset>\n';
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
  url.searchParams.set("select","story_id,image_url,credit,credit_url,alt_text");
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
async function main(){
  const rows=await fetchPublished();
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
     image_alt_text:verified?checked.alt_text:""
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
  await fs.writeFile(path.join(OUT,"sitemap.xml"),sitemapXml(stories),"utf8");
  await fs.writeFile(manifestPath,JSON.stringify(stories.map(s=>s.slug),null,2)+"\n","utf8");
  console.log("GoodWorld SEO built: "+stories.length+" original editorial pages + archive + sitemap ("+(stories.length+2)+" URLs)");
  console.log("Excluded "+(rows.length-stories.length)+" public entries with insufficient editorial content or automatic RSS briefs.");
}
main().catch(error=>{console.error("GoodWorld SEO build failed:",error instanceof Error?error.message:"Unknown error");process.exitCode=1});
