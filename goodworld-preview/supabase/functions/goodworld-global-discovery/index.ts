import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { XMLParser } from "npm:fast-xml-parser@4.5.3";

// Private international story DISCOVERY ONLY: RSS metadata, never scraped articles,
// never auto-posted to the public feed, and never unlicensed images.
const endpoint=Deno.env.get("SUPABASE_URL")||"";
const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
 ||JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||"";
if(!endpoint||!key)throw Error("Supabase backend unavailable");
const db=createClient(endpoint,key,{auth:{persistSession:false,autoRefreshToken:false}});
const allowedHosts=new Set(["globalvoices.org","news.mongabay.com","theconversation.com","www.positive.news"]);
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@_",textNodeName:"#text",trimValues:true,htmlEntities:true});
const positive=/(rescu|reunit|returned home|recovered|restor|rediscover|found alive|saved|adopt|released|thriv|flourish|return of|first birth|newborn|born|surviv|habitat|conserv|reforest|regenerat|volunteer|community|neighbor|neighbour|kindness|donat|helped|helping|rebuild|protect|hope|success|breakthrough|found again|rare|lost species|new species|sanctuary|wildlife|school garden|local hero|homecoming)/i;
const strong=/(rescu|reunit|found alive|rediscover|first birth|newborn|adopt|saved|restor|thriv|flourish|regenerat|kindness|homecoming|wildlife comeback)/i;
const avoid=/(murder|killed|massacre|gunfire|armed conflict|terror attack|war crime|political scandal|election|president|party leader|opposition leader|sex abuse|death toll|fatal accident|drug traffick|court hearing|criminal case|protest violence)/i;
const plan=/(plans to|hopes to|aims to|could someday|might one day|sets out to|pledged to|promises to)/i;
const host=(u:string)=>{try{return new URL(u).hostname.toLowerCase()}catch{return ""}};
const list=(v:unknown):unknown[]=>v==null?[]:Array.isArray(v)?v:[v];
const val=(v:unknown):string=>typeof v==="string"?v:
 v&&typeof v==="object"&&"#text" in v?String((v as Record<string,unknown>)["#text"]||""):"";
function clean(v:unknown,max=700):string{
 return val(v).replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ")
 .replace(/<[^>]*>/g," ").replace(/&(?:nbsp|amp|lt|gt|quot|#39|#8217|#8230);/gi," ")
 .replace(/\s+/g," ").trim().slice(0,max);
}
function itemLink(item:Record<string,unknown>):string{
 const raw=item.link;
 if(typeof raw==="string")return raw;
 for(const x of list(raw)){
  if(!x||typeof x!=="object")continue;
  const o=x as Record<string,unknown>;
  if((!o["@_rel"]||o["@_rel"]==="alternate")&&typeof o["@_href"]==="string")return o["@_href"] as string;
  if(typeof o["#text"]==="string")return o["#text"] as string;
 }
 return "";
}
function acceptedArticle(raw:string,source:Record<string,unknown>):string|null{
 let u:URL;
 try{u=new URL(raw)}catch{return null}
 const h=u.hostname.toLowerCase(),expected=String(source.article_host);
 if(u.protocol!=="https:"||h!==expected||u.pathname.length<7||u.pathname.length>400)return null;
 u.hash="";
 for(const k of [...u.searchParams.keys()])
  if(/^utm_|^fbclid$|^gclid$|^ref$/i.test(k))u.searchParams.delete(k);
 const url=u.toString();
 return url.length<1300?url:null;
}
function candidates(xml:string,source:Record<string,unknown>){
 const parsed=parser.parse(xml) as Record<string,unknown>;
 let items:Record<string,unknown>[]=[];
 if(parsed.rss&&typeof parsed.rss==="object"){
  const channel=(parsed.rss as Record<string,unknown>).channel as Record<string,unknown>|undefined;
  items=list(channel?.item).filter(v=>v&&typeof v==="object") as Record<string,unknown>[];
 }else if(parsed.feed&&typeof parsed.feed==="object"){
  items=list((parsed.feed as Record<string,unknown>).entry).filter(v=>v&&typeof v==="object") as Record<string,unknown>[];
 }else throw Error("Not an RSS/Atom feed");
 const out:Record<string,unknown>[]=[];
 const now=Date.now(),last=now-14*86400000;
 for(const item of items.slice(0,30)){
  const title=clean(item.title,180);
  const excerpt=clean(item.description||item.summary||"",650);
  const url=acceptedArticle(itemLink(item),source);
  const rawTime=clean(item.pubDate||item.published||item.updated||item["dc:date"],80);
  const published=Date.parse(rawTime);
  if(!url||title.length<20||excerpt.length<65||!Number.isFinite(published)
   ||published<last||published>now+300000)continue;
  const sample=title+" "+excerpt.slice(0,220);
  if(avoid.test(sample)||plan.test(title)||!positive.test(sample))continue;
  let score=11;
  if(strong.test(title))score+=6;
  if(positive.test(title))score+=3;
  if(/animal|turtle|elephant|bird|forest|coral|wildlife|school|children|community|village|neighbou?r|garden|species/i.test(sample))score+=3;
  if(excerpt.length>=180)score+=2;
  if(score<15)continue;
  const category=/animal|wildlife|turtle|elephant|bird|panda|tiger|species|lion/i.test(sample)?"Animals":
   /forest|coral|habitat|conserv|regenerat|reforest|rainforest|ocean|river/i.test(sample)?"Nature & Planet":
   /school|children|education/i.test(sample)?"Education":"Human Kindness";
  out.push({
   source_url:url,feed_url:String(source.feed_url),source_name:String(source.source_name),
   original_title:title,original_excerpt:excerpt,category,published_at:new Date(published).toISOString(),
   status:"pending",global_discovery:true,discovery_region:String(source.region),
   source_country_hint:source.country_hint||null,
   source_language:String(source.original_language||"en"),discovery_score:score
  });
 }
 return out.sort((a,b)=>Number(b.discovery_score)-Number(a.discovery_score)).slice(0,8);
}
async function collect(src:Record<string,unknown>){
 let timer:number|undefined;
 try{
  const feedUrl=new URL(String(src.feed_url));
  if(feedUrl.protocol!=="https:"||!allowedHosts.has(feedUrl.hostname)
    ||!allowedHosts.has(String(src.article_host)))throw Error("Feed host not allowlisted");
  const ctrl=new AbortController();
  timer=setTimeout(()=>ctrl.abort(),10500);
  const resp=await fetch(feedUrl,{headers:{Accept:"application/rss+xml,application/atom+xml,text/xml,application/xml","User-Agent":"GoodWorld editorial RSS discovery (metadata only)"},redirect:"follow",signal:ctrl.signal});
  if(!resp.ok)throw Error("Feed HTTP "+resp.status);
  if(host(resp.url)!==feedUrl.hostname)throw Error("Unexpected feed redirect");
  const xml=await resp.text();
  if(xml.length>1000000||!/(<rss|<feed|<rdf:RDF)/i.test(xml.slice(0,500)))throw Error("Invalid feed");
  return {source:String(src.source_key),items:candidates(xml,src),error:null as string|null};
 }catch(err){return {source:String(src.source_key),items:[] as Record<string,unknown>[],
  error:String(err instanceof Error?err.message:err).slice(0,120)};
 }finally{if(timer!==undefined)clearTimeout(timer)}
}
async function authorized(req:Request):Promise<boolean>{
 if(req.headers.get("Authorization")==="Bearer "+key)return true;
 const proposed=req.headers.get("x-goodworld-cron-token")||"";
 if(proposed.length<48||proposed.length>128)return false;
 const hashed=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(proposed));
 const candidate=Array.from(new Uint8Array(hashed)).map(b=>b.toString(16).padStart(2,"0")).join("");
 const {data,error}=await db.from("goodworld_joy_worker_auth")
  .select("token_sha256").eq("worker_name","goodworld-global-discovery").maybeSingle();
 if(error||!data?.token_sha256||data.token_sha256.length!==candidate.length)return false;
 let diff=0;
 for(let i=0;i<candidate.length;i++)diff|=candidate.charCodeAt(i)^data.token_sha256.charCodeAt(i);
 return diff===0;
}
function selectBalanced(groups:Record<string,unknown>[][],already:Record<string,number>,maxTotal:number){
 const byRegion=new Map<string,Record<string,unknown>[]>();
 const seen=new Set<string>();
 for(const batch of groups)for(const item of batch){
  const u=String(item.source_url),r=String(item.discovery_region);
  if(seen.has(u))continue;
  seen.add(u);
  if(!byRegion.has(r))byRegion.set(r,[]);
  byRegion.get(r)!.push(item);
 }
 for(const items of byRegion.values())items.sort((a,b)=>Number(b.discovery_score)-Number(a.discovery_score));
 const chosen:Record<string,unknown>[]=[];
 while(chosen.length<maxTotal){
  let advanced=false;
  for(const [region,items] of byRegion){
   if(chosen.length>=maxTotal)break;
   if((already[region]||0)>=4||!items.length)continue;
   chosen.push(items.shift()!);already[region]=(already[region]||0)+1;advanced=true;
  }
  if(!advanced)break;
 }
 return chosen;
}
Deno.serve(async req=>{
 if(req.method!=="POST")return Response.json({error:"POST required"},{status:405});
 if(!(await authorized(req)))return Response.json({error:"Worker authorization required"},{status:403});
 const cutoff=new Date(Date.now()-90*60000).toISOString();
 const {count:recent}=await db.from("goodworld_global_discovery_runs")
  .select("id",{count:"exact",head:true}).gte("started_at",cutoff);
 if((recent||0)>0)return Response.json({skipped:true,reason:"A global discovery cycle already ran recently"});
 const {data:run,error:runErr}=await db.from("goodworld_global_discovery_runs").insert({}).select("id").single();
 if(runErr||!run)return Response.json({error:"Audit log unavailable"},{status:503});
 const {data:sources,error:err}=await db.from("goodworld_global_sources").select("*").eq("enabled",true).limit(30);
 if(err||!sources)return Response.json({error:"Source registry unavailable"},{status:503});
 const midnight=new Date();midnight.setUTCHours(0,0,0,0);
 const {data:today,error:todayErr}=await db.from("goodworld_candidates")
  .select("discovery_region").eq("global_discovery",true).gte("created_at",midnight.toISOString()).limit(100);
 if(todayErr)return Response.json({error:"Daily quota unavailable"},{status:503});
 const used:Record<string,number>={};
 for(const row of today||[]){const r=String(row.discovery_region||"Worldwide");used[r]=(used[r]||0)+1;}
 const remaining=Math.max(0,20-(today||[]).length);
 let checked=0,issues:string[]=[],seen=0,added=0;
 if(remaining>0){
  const collected:Record<string,unknown>[][]=[];
  for(let i=0;i<sources.length;i+=4){
   const batch=await Promise.all(sources.slice(i,i+4).map(s=>collect(s)));
   for(const res of batch){
    checked++;seen+=res.items.length;
    if(res.error)issues.push(res.source+": "+res.error);
    collected.push(res.items);
   }
  }
  const balanced=selectBalanced(collected,used,remaining);
  if(balanced.length){
   const {data:stored,error:upErr}=await db.from("goodworld_candidates")
    .upsert(balanced,{onConflict:"source_url",ignoreDuplicates:true}).select("id");
   if(upErr)issues.push("Queue insert: "+upErr.message.slice(0,180));
   else added=stored?.length||0;
  }
 }
 await db.from("goodworld_global_discovery_runs").update({
  completed_at:new Date().toISOString(),feeds_checked:checked,items_seen:seen,
  queued:added,errors:issues.length,issues:issues.join(" | ").slice(0,1200)
 }).eq("id",run.id);
 return Response.json({runId:run.id,feedsChecked:checked,qualified:seen,queued:added,
  errors:issues.length,issues,publication:"requires human editorial approval"},
  {headers:{"Cache-Control":"no-store"}});
});
