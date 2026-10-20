import { createClient } from "npm:@supabase/supabase-js@2";
import { XMLParser } from "npm:fast-xml-parser@4.5.3";

// This job only queues candidates. Publishing requires human editorial approval.
const SOURCES=[
 {feed:"https://www.goodnewsnetwork.org/category/news/feed/",host:"goodnewsnetwork.org",name:"Good News Network",category:"Human Kindness"},
 {feed:"https://www.goodnewsnetwork.org/category/news/animals/feed/",host:"goodnewsnetwork.org",name:"Good News Network",category:"Animals"},
 {feed:"https://www.sciencedaily.com/rss/top/environment.xml",host:"sciencedaily.com",name:"ScienceDaily",category:"Nature & Planet"},
 {feed:"https://www.sciencedaily.com/rss/top/health.xml",host:"sciencedaily.com",name:"ScienceDaily",category:"Science & Health"},
 {feed:"https://phys.org/rss-feed/earth-news/environment/",host:"phys.org",name:"Phys.org",category:"Nature & Planet"}
];
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@_",textNodeName:"#text",trimValues:true});
function plain(v:unknown):string{
 const s=typeof v==="string"?v:v&&typeof v==="object"&&"#text" in v?String((v as Record<string,unknown>)["#text"]):"";
 return s.replace(/<[^>]*>/g," ").replace(/&(?:nbsp|#160);/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#(?:39|x27);/gi,"'").replace(/\s+/g," ").trim();
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
 const cutoff=Date.now()-14*86400000;
 return list.slice(0,18).flatMap(item=>{
  const source_url=linkFor(item,source.host);
  const original_title=plain(item.title).slice(0,240);
  const original_excerpt=plain(item.description||item.summary).slice(0,900);
  const published_at=publishedDate(item.pubDate||item.published||item.updated);
  if(!source_url||original_title.length<14||(published_at&&Date.parse(published_at)<cutoff))return [];
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
 const claim=await db.rpc("claim_goodworld_collection");
 if(claim.error)return answer({error:"Unable to reserve collection slot"},500);
 if(!claim.data)return answer({skipped:true,reason:"Already collected in this six-hour window"});
 let added=0,errors=0,inspected=0,feedsProcessed=0;
 const issues:string[]=[];
 try{
  const pending=await db.from("goodworld_candidates").select("id",{count:"exact",head:true}).eq("status","pending");
  if(pending.error)throw Error("Could not count editorial queue");
  if((pending.count||0)>=250)return answer({skipped:true,reason:"Editorial queue full"});
  for(const source of SOURCES){
   try{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
    let res:Response;
    try{
     res=await fetch(source.feed,{headers:{"Accept":"application/rss+xml, application/xml, text/xml;q=0.9","User-Agent":"GoodWorld RSS editorial discovery/1.0"},signal:controller.signal,redirect:"follow"});
    }finally{clearTimeout(timeout)}
    if(!res.ok)throw Error("HTTP "+res.status);
    const xml=await res.text();
    if(xml.length>1200000||!(xml.includes("<rss")||xml.includes("<feed")))throw Error("Invalid or oversized feed");
    const rows=candidateRows(xml,source);
    inspected+=rows.length;
    if(rows.length){
     const saved=await db.from("goodworld_candidates").upsert(rows,{onConflict:"source_url",ignoreDuplicates:true}).select("id");
     if(saved.error)throw Error(saved.error.message);
     added+=saved.data?.length||0;
    }
    feedsProcessed++;
   }catch(err){errors++;issues.push(source.name+" "+source.category+": "+String(err instanceof Error?err.message:err).slice(0,100))}
  }
 }catch(err){errors++;issues.push(String(err instanceof Error?err.message:err).slice(0,120))}
 finally{await db.rpc("finish_goodworld_collection",{p_added:added,p_errors:errors})}
 return answer({added,inspected,feedsProcessed,errors,issues});
});