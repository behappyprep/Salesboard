import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { XMLParser } from "npm:fast-xml-parser@4.5.3";

/**
 * GoodWorld RIGHTS-AWARE PRIMARY SOURCE COLLECTOR, v1.
 * Only official NASA/NOAA/GOV.UK feeds in database allowlist.
 * Never collects media photos, embedded assets, full HTML or third-party news.
 * Candidate collection is NOT publication. Each row stores rights and provenance.
 * Service-role key is supplied by Supabase at runtime, never checked into Git.
 */
const dbUrl = Deno.env.get("SUPABASE_URL")!;
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
if(!dbUrl||!secret)throw new Error("Supabase project secrets unavailable");
const db=createClient(dbUrl,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@_",textNodeName:"#text",trimValues:true,htmlEntities:true});

type Source={
 source_key:string;name:string;feed_url:string;host:string;path_re:string;
 category:string;license_id:string;license_url:string;credit:string;enabled:boolean;
};
type Candidate={
 source_key:string;url:string;title:string;excerpt:string;source_published_at:string;
 category:string;government_owner_verified:boolean;third_party_text_excluded:boolean;
};
const list=(v:unknown):unknown[]=>v==null?[]:Array.isArray(v)?v:[v];
const ent=(str:string):string=>str
 .replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(match,raw)=>{
   const hex=raw[0]?.toLowerCase()==="x",n=parseInt(hex?raw.slice(1):raw,hex?16:10);
   return Number.isInteger(n)&&n>0&&n<=0x10ffff&&(n<0xd800||n>0xdfff)?String.fromCodePoint(n):match;
 })
 .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&apos;/gi,"'")
 .replace(/&(?:lsquo|rsquo);/gi,"'").replace(/&(?:ldquo|rdquo);/gi,'"').replace(/&(?:nbsp|ensp|emsp);/gi," ")
 .replace(/&lt;/gi,"<").replace(/&gt;/gi,">");
function clean(v:unknown):string{
 const txt=typeof v==="string"?v:
    v&&typeof v==="object"&&"#text" in v?String((v as Record<string,unknown>)["#text"]||""):"";
 return ent(txt).replace(/<script[\s\S]*?<\/script>/gi," ")
  .replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
}
function link(item:Record<string,unknown>,atom:boolean):string{
 if(!atom)return clean(item.link);
 const links=list(item.link);
 for(const obj of links){
   if(obj&&typeof obj==="object"){
      const rec=obj as Record<string,unknown>;
      if(rec["@_rel"]==="alternate"||!rec["@_rel"])return String(rec["@_href"]||"");
   }
 }
 return "";
}
function acceptedUrl(raw:string,source:Source):string|null{
 let u:URL;
 try{u=new URL(raw)}catch{return null}
 if(u.protocol!=="https:"||u.hostname!==source.host)return null;
 const rx=new RegExp(source.path_re);
 if(!rx.test(u.pathname))return null;
 // Never accept a search result or reader redirect as an article source.
 if(u.pathname.includes("//")||u.pathname.length>300)return null;
 u.hash="";u.search="";
 return u.toString();
}
function candidate(item:Record<string,unknown>,source:Source,atom:boolean):Candidate|null{
 const title=clean(item.title).slice(0,200);
 const excerpt=clean(atom?(item.summary||item.content||""):(item.description||"")).slice(0,700);
 const url=acceptedUrl(link(item,atom),source);
 const dateRaw=clean(atom?(item.published||item.updated):(item.pubDate||item["dc:date"]||""));
 const time=Date.parse(dateRaw),now=Date.now();
 if(!url||title.length<28||excerpt.length<85||!Number.isFinite(time)
    ||time>now+300000||time<now-5*24*3600000)return null;
 if(!/^[\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]*$/.test(title))return null;
 // Disallow third-party syndicated text & quotations; no image reuse at all.
 if(/©|copyright|all rights reserved|reuters|associated press|guest (author|post)|by [a-z]+\/afp|shutterstock|getty images|originally published (at|by)|reprinted (from|with)/i.test(excerpt))return null;
 // Primary government page only: narrower than the site's general RSS.
 if(source.license_id==="OGL-3.0"&&!url.includes("/government/news/"))return null;
 return {source_key:source.source_key,url,title,excerpt,
  source_published_at:new Date(time).toISOString(),category:source.category,
  government_owner_verified:true,third_party_text_excluded:true};
}
function itemsFrom(xml:string):{entries:Record<string,unknown>[],atom:boolean}{
 const obj=parser.parse(xml) as Record<string,unknown>;
 if(obj.rss&&typeof obj.rss==="object"){
  const ch=(obj.rss as Record<string,unknown>).channel as Record<string,unknown>|undefined;
  return {entries:list(ch?.item).filter(x=>x&&typeof x==="object") as Record<string,unknown>[],atom:false};
 }
 if(obj.feed&&typeof obj.feed==="object"){
  const feed=obj.feed as Record<string,unknown>;
  return {entries:list(feed.entry).filter(x=>x&&typeof x==="object") as Record<string,unknown>[],atom:true};
 }
 throw new Error("Unrecognized RSS/Atom format");
}
async function collect(source:Source){
 let inspected=0,added=0;
 const ctrl=new AbortController(),clock=setTimeout(()=>ctrl.abort(),14000);
 try{
  const res=await fetch(source.feed_url,{
   headers:{Accept:"application/rss+xml,application/atom+xml,application/xml,text/xml","User-Agent":"GoodWorld-source-reader/1.0 (primary public-domain or OGL releases only)"},
   redirect:"follow",signal:ctrl.signal
  });
  if(!res.ok)throw Error("HTTP "+res.status);
  const xml=await res.text();
  if(xml.length>800000||!xml.startsWith("<?xml"))throw Error("Invalid or oversized feed");
  const {entries,atom}=itemsFrom(xml);
  const selected=entries.slice(0,35).map(item=>candidate(item,source,atom)).filter(Boolean) as Candidate[];
  inspected=entries.length;
  if(selected.length){
   const result=await db.from("goodworld_primary_candidates").upsert(selected,{
    onConflict:"url",ignoreDuplicates:true
   }).select("id");
   if(result.error)throw Error(result.error.message);
   added=result.data?.length||0;
  }
  return {processed:1,inspected,added,issue:null as string|null};
 }catch(e){
  return {processed:0,inspected,added,issue:source.source_key+": "+String(e instanceof Error?e.message:e).slice(0,160)};
 }finally{clearTimeout(clock)}
}
Deno.serve(async (request:Request)=>{
 if(request.method!=="POST")return new Response(JSON.stringify({error:"Method not allowed"}),{
  status:405,headers:{"Content-Type":"application/json"}
 });
 const {data:sources,error}=await db.from("goodworld_primary_sources").select("*").eq("enabled",true);
 if(error||!sources)return new Response(JSON.stringify({error:"Approved source registry unavailable"}),{
  status:503,headers:{"Content-Type":"application/json"}
 });
 let added=0,inspected=0,processed=0,errors=0;
 const issues:string[]=[];
 // Up to four approved feeds, no unbounded origin fetch.
 const approved=(sources as Source[]).filter(s=>["www.nasa.gov","www.noaa.gov","www.gov.uk"].includes(s.host))
  .filter(s=>s.feed_url.startsWith("https://"+s.host+"/")).slice(0,8);
 const {data:run,error:runError}=await db.from("goodworld_primary_collection_logs")
   .insert({}).select("id").single();
 if(runError)return new Response(JSON.stringify({error:"Collection log unavailable"}),{
  status:503,headers:{"Content-Type":"application/json"}
 });
 for(const src of approved){
  const result=await collect(src);added+=result.added;inspected+=result.inspected;processed+=result.processed;
  if(result.issue){errors++;issues.push(result.issue)}
 }
 await db.from("goodworld_primary_collection_logs").update({
  completed_at:new Date().toISOString(),checked:inspected,added,errors,notes:issues.join(" | ").slice(0,1400)
 }).eq("id",run!.id);
 return new Response(JSON.stringify({added,inspected,processed,errors,issues,approvedSources:approved.map(x=>x.source_key)}),{
  status:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
 });
});
