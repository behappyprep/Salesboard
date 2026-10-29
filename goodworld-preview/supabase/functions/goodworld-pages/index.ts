// GoodWorld crawlable editorial pages and live sitemap.
// Public read-only endpoint, no privileged key and no database writes.
// RSS auto-briefs stay feed-only until editorially approved and rewritten.
// Render rewrites /stories/* and /sitemap-live.xml to this function.
// On Render static sites existing static files always override rewrites.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const SITE = "https://www.goodworld.news";
const PROJECT_URL = Deno.env.get("SUPABASE_URL") || "https://jdmpmrhyjitmjyjuhtds.supabase.co";
const PUBLIC_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_Mi4xc0jwt_MFKhjKWZ1Vpw_bG6VPp3_";
const db = createClient(PROJECT_URL, PUBLIC_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { "X-Client-Info": "goodworld-seo-pages/1.0" } },
});
const ESCAPES: Record<string,string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ESCAPES[c]);
const date = (s: string) => new Date(s).toISOString();
type Story = {
 slug:string; title:string; summary:string; body:string; category:string;
 source_name:string; source_url:string; published_at:string; created_at:string;
 image_url?:string|null; status?:string;
};
const fields = "slug,title,summary,body,category,source_name,source_url,published_at,created_at";
const headers = (type: string, ttl = 300): HeadersInit => ({
  "Content-Type": type,
  "Cache-Control": "public, max-age=60, s-maxage="+ttl,
  "X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"strict-origin-when-cross-origin",
  "X-Robots-Tag":"index, follow",
});
function failure(status: number, message: string) {
  return new Response(message, {status,headers:{
    "Content-Type":"text/plain; charset=utf-8",
    "X-Robots-Tag":"noindex",
    "Cache-Control":"public, max-age=30"
  }});
}
function eligible(s: Story) {
  return !!s && !s.slug.startsWith("auto-")
   && /^[a-z0-9-]{5,120}$/.test(s.slug)
   && !!s.published_at
   && s.title.trim().length>=15
   && s.summary.trim().length>=30
   && s.body.trim().length>=200
   && s.source_name.trim().length>=3
   && (() => {try { const u=new URL(s.source_url);return u.protocol==="https:" } catch{return false}})();
}
function publishedTime(s: Story) {
 return new Date(s.published_at).toLocaleDateString("en-US", { month:"long",day:"numeric",year:"numeric",timeZone:"UTC" });
}
function assetHeaders(){
 return '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta name="theme-color" content="#FFF9F0"><link rel="icon" href="'+SITE+'/favicon.svg">'+
  '<link rel="stylesheet" href="'+SITE+'/article.css">';
}
function websiteHeader(){
 return '<header class="site-head"><a class="brand" href="'+SITE+'/">✳ <span>good<strong>world</strong></span></a>'+
  '<a class="head-link" href="'+SITE+'/stories/">All stories ↗</a></header>';
}
function renderStory(s: Story) {
 const url=SITE+"/stories/"+encodeURIComponent(s.slug)+".html";
 const schema={
   "@context":"https://schema.org","@type":"Article",
   headline:s.title,description:s.summary,
   datePublished:date(s.published_at),
   mainEntityOfPage:{"@type":"WebPage","@id":url},
   author:{"@type":"Organization",name:"GoodWorld Editorial",url:SITE},
   publisher:{"@type":"Organization",name:"GoodWorld",url:SITE},
   citation:s.source_url,articleSection:s.category
 };
 const ld=JSON.stringify(schema).replace(/</g,"\\u003c");
 const html='<!doctype html><html lang="en"><head>'+assetHeaders()+
 '<title>'+esc(s.title)+' | GoodWorld</title>'+
 '<meta name="description" content="'+esc(s.summary)+'">'+
 '<meta property="og:type" content="article">'+
 '<meta property="og:site_name" content="GoodWorld">'+
 '<meta property="og:title" content="'+esc(s.title)+'">'+
 '<meta property="og:description" content="'+esc(s.summary)+'">'+
 '<meta property="og:url" content="'+esc(url)+'">'+
 '<meta property="article:published_time" content="'+esc(date(s.published_at))+'">'+
 '<meta name="twitter:card" content="summary">'+
 '<link rel="canonical" href="'+esc(url)+'">'+
 '<script type="application/ld+json">'+ld+'</script></head><body>'+
 websiteHeader()+
 '<main class="article-wrap"><p class="eyebrow">'+esc(s.category)+
 ' <span class="dot">·</span> <time datetime="'+esc(date(s.published_at))+'">'+esc(publishedTime(s))+'</time></p>'+
 '<article class="article"><h1>'+esc(s.title)+'</h1>'+
 '<p class="intro">'+esc(s.summary)+'</p>'+
 '<div class="article-body"><p>'+esc(s.body).replace(/\n\n+/g,"</p><p>")+'</p></div>'+
 '<div class="source-block"><p class="source-label">Original reporting</p>'+
 '<p>This is an independently written GoodWorld summary of reporting by <strong>'+esc(s.source_name)+
 '</strong>. Follow the original article for further context.</p>'+
 '<a rel="noopener noreferrer" target="_blank" href="'+esc(s.source_url)+'">Read original reporting ↗</a></div>'+
 '</article><p class="bottom-home"><a href="'+SITE+'/stories/">← Browse more positive stories</a></p></main>'+
 '<footer class="site-footer"><a href="'+SITE+'/">GoodWorld</a> · Real positive news, free for everyone.</footer>'+
 '</body></html>';
 return new Response(html,{headers:headers("text/html; charset=utf-8",300)});
}
async function fetchEligible(): Promise<Story[]> {
 const result:Story[]=[];
 for(let offset=0;offset<5000;offset+=500){
  const {data,error}=await db.from("goodworld_stories")
   .select(fields).eq("status","published")
   .not("published_at","is",null).order("published_at",{ascending:false})
   .range(offset,offset+499);
  if(error) throw Error("Public news query unavailable");
  if(!data?.length)break;
  for(const row of data as Story[]) if(eligible(row))result.push(row);
  if(data.length<500)break;
 }
 return result;
}
function renderSitemap(stories:Story[]) {
 const entries=[{url:SITE+"/",lastmod:""},{url:SITE+"/stories/",lastmod:""}]
 .concat(stories.map(s=>({
   url:SITE+"/stories/"+encodeURIComponent(s.slug)+".html",
   lastmod:date(s.created_at||s.published_at).slice(0,10)
 })));
 const xml='<?xml version="1.0" encoding="UTF-8"?>\n'+
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
  entries.map(x=>'<url><loc>'+esc(x.url)+'</loc>'+ (x.lastmod?'<lastmod>'+x.lastmod+'</lastmod>':'')+'</url>').join("\n")+
  '\n</urlset>\n';
 return new Response(xml,{headers:headers("application/xml; charset=utf-8",300)});
}
function renderArchive(stories:Story[]) {
 const list=stories.slice(0,250).map(s=>{
  const u=SITE+"/stories/"+encodeURIComponent(s.slug)+".html";
  return '<a class="archive-card" href="'+esc(u)+'"><span class="category">'+esc(s.category)+
   '</span><strong>'+esc(s.title)+'</strong><time datetime="'+esc(date(s.published_at))+'">'+
   esc(publishedTime(s))+'</time></a>';
 }).join("");
 const html='<!doctype html><html lang="en"><head>'+assetHeaders()+
 '<title>Good news stories | GoodWorld</title>'+
 '<meta name="description" content="Browse original GoodWorld positive news briefs and discover real inspiring stories from around the world.">'+
 '<link rel="canonical" href="'+SITE+'/stories/">'+
 '<meta property="og:title" content="Positive stories | GoodWorld"><meta property="og:type" content="website">'+
 '</head><body>'+websiteHeader()+
 '<main class="article-wrap"><p class="eyebrow">THE GOODWORLD LIBRARY</p>'+
 '<h1 class="archive-title">Good news worth sharing.</h1>'+
 '<p class="archive-intro">Fresh, source-linked editorial stories about nature, kindness, animals and meaningful discoveries. Our live feed updates throughout the day.</p>'+
 '<section class="archive-grid" aria-label="GoodWorld news stories">'+list+'</section>'+
 '<p class="bottom-home"><a href="'+SITE+'/">← Live good news feed</a></p></main>'+
 '<footer class="site-footer"><a href="'+SITE+'/">GoodWorld</a> · Positive news for everyone.</footer>'+
 '</body></html>';
 return new Response(html,{headers:headers("text/html; charset=utf-8",120)});
}
Deno.serve(async (request:Request) => {
 try{
  if(request.method!=="GET" && request.method!=="HEAD")return failure(405,"Method not allowed");
  const url=new URL(request.url);
  const p=url.pathname.slice(url.pathname.indexOf("/goodworld-pages")+("/goodworld-pages").length);
  let response:Response;
  if(p==="/sitemap-live.xml" || p==="/sitemap.xml"){
   response=renderSitemap(await fetchEligible());
  }else if(p==="/stories" || p==="/stories/" || p==="/archive"){
   response=renderArchive(await fetchEligible());
  }else{
   const path=p.startsWith("/stories/")?p.slice("/stories/".length):"";
   if(!/^[a-z0-9-]{5,120}\.html$/.test(path))return failure(404,"Not found");
   const slug=path.slice(0,-5);
   const {data,error}=await db.from("goodworld_stories").select(fields).eq("status","published").eq("slug",slug).maybeSingle();
   if(error)return failure(503,"Story temporarily unavailable");
   if(!data || !eligible(data as Story))return failure(404,"No public editorial page");
   response=renderStory(data as Story);
  }
  if(request.method==="HEAD")return new Response(null,{status:response.status,headers:response.headers});
  return response;
 }catch(err){
  console.error("GoodWorld SEO handler error",err instanceof Error?err.message:"unknown");
  return failure(503,"News temporarily unavailable");
 }
});
