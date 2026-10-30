import { createClient } from "npm:@supabase/supabase-js@2";
import { XMLParser } from "npm:fast-xml-parser@4.5.3";

// Discovery queues source-linked candidates for editorial review AND a separate strictly filtered hourly auto-publisher.
const SOURCES=[
 {feed:"https://www.goodnewsnetwork.org/category/news/feed/",host:"goodnewsnetwork.org",name:"Good News Network",category:"Human Kindness"},
 {feed:"https://www.goodnewsnetwork.org/category/news/animals/feed/",host:"goodnewsnetwork.org",name:"Good News Network",category:"Animals"},
 {feed:"https://www.goodnewsnetwork.org/feed/",host:"goodnewsnetwork.org",name:"Good News Network",category:"Human Kindness"},
 {feed:"https://www.goodgoodgood.co/articles/rss.xml",host:"goodgoodgood.co",name:"Good Good Good",category:"Human Kindness"},
 {feed:"https://www.upworthy.com/feeds/feed.rss",host:"upworthy.com",name:"Upworthy",category:"Human Kindness"},
 {feed:"https://reasonstobecheerful.world/feed/",host:"reasonstobecheerful.world",name:"Reasons to be Cheerful",category:"Human Kindness"},
 {feed:"https://www.positive.news/feed/",host:"positive.news",name:"Positive News",category:"Human Kindness"},
 {feed:"https://www.optimistdaily.com/feed/",host:"optimistdaily.com",name:"The Optimist Daily",category:"Human Kindness"},
 {feed:"https://www.sciencedaily.com/rss/top/environment.xml",host:"sciencedaily.com",name:"ScienceDaily",category:"Nature & Planet"},
 {feed:"https://www.sciencedaily.com/rss/top/health.xml",host:"sciencedaily.com",name:"ScienceDaily",category:"Science & Health"},
 {feed:"https://phys.org/rss-feed/earth-news/environment/",host:"phys.org",name:"Phys.org",category:"Nature & Planet"},
 {feed:"https://www.yesmagazine.org/feed",host:"yesmagazine.org",name:"YES! Magazine",category:"Human Kindness"},
 {feed:"https://www.theguardian.com/environment/rss",host:"theguardian.com",name:"The Guardian",category:"Nature & Planet"},
 {feed:"https://www.theguardian.com/science/rss",host:"theguardian.com",name:"The Guardian",category:"Innovation"},
 {feed:"https://www.theguardian.com/global-development/rss",host:"theguardian.com",name:"The Guardian",category:"Human Kindness"},
 {feed:"https://phys.org/rss-feed/technology-news/",host:"phys.org",name:"Phys.org",category:"Innovation"},
 {feed:"https://phys.org/rss-feed/biology-news/ecology/",host:"phys.org",name:"Phys.org",category:"Nature & Planet"},
 {feed:"https://www.sciencedaily.com/rss/top/technology.xml",host:"sciencedaily.com",name:"ScienceDaily",category:"Innovation"},
 {feed:"https://feeds.npr.org/1007/rss.xml",host:"npr.org",name:"NPR",category:"Innovation"},
 {feed:"https://news.mongabay.com/feed/",host:"news.mongabay.com",name:"Mongabay",category:"Nature & Planet"},
 {feed:"https://www.smithsonianmag.com/rss/latest_articles/",host:"smithsonianmag.com",name:"Smithsonian Magazine",category:"Human Kindness"},
 {feed:"https://substack.fixthenews.com/feed",host:"substack.fixthenews.com",name:"Fix The News",category:"Human Kindness"}
];
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@_",textNodeName:"#text",trimValues:true});
function plain(v:unknown):string{
 const s=typeof v==="string"?v:v&&typeof v==="object"&&"#text" in v?String((v as Record<string,unknown>)["#text"]):"";
 return s.replace(/<[^>]*>/g," ")
  .replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(raw,entity)=>{
   const hex=entity[0]?.toLowerCase()==="x",n=parseInt(hex?entity.slice(1):entity,hex?16:10);
   return Number.isInteger(n)&&n>0&&n<=0x10ffff&&(n<0xd800||n>0xdfff)?String.fromCodePoint(n):raw;
  })
  .replace(/&(?:nbsp|ensp|emsp);/gi," ")
  .replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
  .replace(/&quot;/gi,'"').replace(/&apos;/gi,"'")
  .replace(/&(?:ldquo|rdquo);/gi,'"').replace(/&(?:lsquo|rsquo);/gi,"'")
  .replace(/\s+/g," ").trim();
}
function linkFor(item:Record<string,unknown>,host:string):string|null{
 const raw=item.link;
 const href=typeof raw==="string"?raw:raw&&typeof raw==="object"?String((raw as Record<string,unknown>)["@_href"]||""):"";
 try{
  const url=new URL(href);
  if(url.protocol!=="https:"||![host,"www."+host].includes(url.hostname.toLowerCase()))return null;
  url.hash="";
  for(const key of [...url.searchParams.keys()])if(/^utm_|^fbclid$|^gclid$/i.test(key))url.searchParams.delete(key);
  return url.toString().length<=1500?url.toString():null;
 }catch{return null}
}
function publishedDate(v:unknown):string|null{
 const d=new Date(typeof v==="string"?v:"");
 return Number.isFinite(d.valueOf())?d.toISOString():null;
}
function candidateRows(xml:string,source:(typeof SOURCES)[number]){
 const root=parser.parse(xml),rss=root?.rss?.channel?.item,atom=root?.feed?.entry;
 const list:Record<string,unknown>[]=(Array.isArray(rss)?rss:rss?[rss]:Array.isArray(atom)?atom:atom?[atom]:[]) as Record<string,unknown>[];
 const cutoff=Date.now()-36*3600000;
 return list.slice(0,25).flatMap(item=>{
  const source_url=linkFor(item,source.host);
  const original_title=plain(item.title).slice(0,240);
  const original_excerpt=plain(item.description||item.summary).slice(0,900);
  const published_at=publishedDate(item.pubDate||item.published||item.updated);
  if(!source_url||original_title.length<14||!published_at||Date.parse(published_at)<cutoff||Date.parse(published_at)>Date.now()+600000)return [];
  return [{source_url,feed_url:source.feed,source_name:source.name,original_title,original_excerpt,published_at,category:source.category}];
 });
}
function answer(obj:Record<string,unknown>,status=200):Response{
 return new Response(JSON.stringify(obj),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return answer({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL");
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default;
 if(!url||!key)return answer({error:"Missing backend configuration"},500);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const claim=await db.rpc("claim_goodworld_collection_hourly");
 if(claim.error)return answer({error:"Unable to reserve collection slot"},500);
 if(!claim.data)return answer({skipped:true,reason:"Already collected in this hour"});
 let added=0,errors=0,inspected=0,feedsProcessed=0;
 const issues:string[]=[];
 try{
  const pending=await db.from("goodworld_candidates").select("id",{count:"exact",head:true}).eq("status","pending");
  if(pending.error)throw Error("Could not count editorial queue");
  if((pending.count||0)>=50000)return answer({skipped:true,reason:"Editorial queue at safety limit"});
  async function collectOne(source:(typeof SOURCES)[number]){
   try{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),4500);
    let res:Response;
    try{
     res=await fetch(source.feed,{headers:{"Accept":"application/rss+xml, application/xml, text/xml;q=0.9","User-Agent":"GoodWorld positive news RSS reader/2.0"},signal:controller.signal,redirect:"follow"});
    }finally{clearTimeout(timeout)}
    if(!res.ok)throw Error("HTTP "+res.status);
    const xml=await res.text();
    if(xml.length>1200000||!(xml.includes("<rss")||xml.includes("<feed")||xml.includes("<rdf:RDF")))throw Error("Invalid or oversized RSS/XML feed");
    const rows=candidateRows(xml,source);
    let count=0;
    if(rows.length){
     const saved=await db.from("goodworld_candidates").upsert(rows,{onConflict:"source_url",ignoreDuplicates:true}).select("id");
     if(saved.error)throw Error(saved.error.message);
     count=saved.data?.length||0;
    }
    return {added:count,inspected:rows.length,processed:1,error:null as string|null};
   }catch(err){
    return {added:0,inspected:0,processed:0,error:source.name+" "+source.category+": "+String(err instanceof Error?err.message:err).slice(0,100)};
   }
  }
  for(let i=0;i<SOURCES.length;i+=5){
   const batch=await Promise.all(SOURCES.slice(i,i+5).map(collectOne));
   for(const result of batch){
    added+=result.added;inspected+=result.inspected;feedsProcessed+=result.processed;
    if(result.error){errors++;issues.push(result.error)}
   }
  }
 }catch(err){errors++;issues.push(String(err instanceof Error?err.message:err).slice(0,120))}
 finally{await db.rpc("finish_goodworld_collection_hourly",{p_added:added,p_errors:errors})}
 return answer({added,inspected,feedsProcessed,errors,issues});
});