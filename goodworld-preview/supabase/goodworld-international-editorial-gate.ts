import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

// GoodWorld automatic international editorial gate.
// GitHub Actions authenticates via short-lived OIDC JWT: no database secrets in GitHub.
// Finds first-hand source evidence, verifies literal evidence phrases and Commons photo rights.
// It NEVER publishes directly. A separate hourly SQL scheduler publishes "ready" rows.
const dbUrl=Deno.env.get("SUPABASE_URL")||"";
const dbKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||
 JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||"";
if(!dbUrl||!dbKey)throw Error("GoodWorld database not configured");
const db=createClient(dbUrl,dbKey,{auth:{persistSession:false,autoRefreshToken:false}});
const issuer="https://token.actions.githubusercontent.com";
const jwks=createRemoteJWKSet(new URL(issuer+"/.well-known/jwks"));
const audience="goodworld-international-verification";
const workflow="behappyprep/Salesboard/.github/workflows/goodworld-international-verification.yml@refs/heads/main";
const editorialBans=/(^|\W)(politic|election|president|prime minister|protest|war|terror|massacre|murder|killed|tragedy|suicide|corporate press release|grant|pledge|funding announcement|planned|will build|may happen|hopes to|intends to|proposal|unveils plan|researchers suggest|study predicts)(\W|$)/i;
const supportedLicenses:Record<string,string>={
 "cc by 4.0":"https://creativecommons.org/licenses/by/4.0/",
 "cc by-sa 4.0":"https://creativecommons.org/licenses/by-sa/4.0/",
 "cc by 3.0":"https://creativecommons.org/licenses/by/3.0/",
 "cc by-sa 3.0":"https://creativecommons.org/licenses/by-sa/3.0/",
 "cc by 2.0":"https://creativecommons.org/licenses/by/2.0/",
 "cc by-sa 2.0":"https://creativecommons.org/licenses/by-sa/2.0/",
 "cc0 1.0":"https://creativecommons.org/publicdomain/zero/1.0/",
 "cc0":"https://creativecommons.org/publicdomain/zero/1.0/",
 "public domain":"https://commons.wikimedia.org/wiki/Commons:Licensing#Material_in_the_public_domain"
};
const trim=(x:unknown,n=15000)=>String(x??"").trim().slice(0,n);
const clean=(s:unknown)=>trim(s,15000).replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ")
 .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
 .replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/\s+/g," ").trim();
const norm=(s:unknown)=>clean(s).normalize("NFKC").replace(/[“”‘’]/g,'"').replace(/[.,:;!?()[\]{}–—]/g," ").replace(/\s+/g," ").toLowerCase();
const hostOf=(x:string)=>{try{return new URL(x).hostname.toLowerCase()}catch{return ""}};
function isSafeUrl(s:string){
 try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password
  &&u.hostname.includes(".")&&!/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/i.test(u.hostname)
  &&s.length<1300;}catch{return false}
}
async function authenticated(req:Request):Promise<boolean>{
 const raw=req.headers.get("authorization")||"";
 if(!raw.startsWith("Bearer "))return false;
 try{
  const {payload}=await jwtVerify(raw.slice(7),jwks,{issuer,audience,clockTolerance:15});
  return payload.repository==="behappyprep/Salesboard"&&
   payload.ref==="refs/heads/main"&&payload.workflow_ref===workflow&&
   payload.event_name!=="pull_request";
 }catch{return false}
}
async function loadOriginal(url:string):Promise<{text:string,html:string,dated:boolean}|null>{
 if(!isSafeUrl(url))return null;
 let timer:number|undefined;
 try{
  const ctrl=new AbortController();timer=setTimeout(()=>ctrl.abort(),11500);
  const res=await fetch(url,{redirect:"manual",signal:ctrl.signal,
   headers:{"Accept":"text/html,application/xhtml+xml","User-Agent":"GoodWorldNews/1.0 (https://www.goodworld.news; verify factual source metadata)"}});
  if(!res.ok||hostOf(res.url)!==hostOf(url))return null;
  if(!/text\/html|application\/xhtml/i.test(res.headers.get("content-type")||"text/html"))return null;
  const html=(await res.text()).slice(0,450000);
  let body=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
   .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
   .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi," ")
   .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi," ")
   .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi," ")
   .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi," ");
  const main=body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)||
    body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if(main?.[1]&&clean(main[1]).length>450)body=main[1];
  const text=clean(body).slice(0,18000);
  const dated=/(article:published_time|datepublished|pubdate|datePublished|datetime=|發布日期|發佈日期|Publication date|Publicado el|Published on)/i.test(html);
  return text.length>=500?{text,html:html.slice(0,65000),dated}:null;
 }catch{return null}finally{if(timer)clearTimeout(timer)}
}
function sourceDateMatches(html:string,sourceDate:string){
 const date=sourceDate.slice(0,10),dateNum=date.replace(/-/g,"");
 // Source metadata timestamp/ISO first; if the source site uses a localized
 // printed date, the editor still has to verify that exact date via excerpts.
 return html.includes(date)||html.includes(dateNum) ||
   new RegExp(date.slice(0,4)+"[^\\d]{0,6}0?"+Number(date.slice(5,7))+"[^\\d]{0,6}0?"+Number(date.slice(8,10))).test(html);
}
function extractPublisherDate(html:string,sourceDate:string){
 const date=sourceDate.slice(0,10);
 return sourceDateMatches(html,sourceDate)&&!!date;
}
async function getWork(){
 const {data:rows,error}=await db.from("goodworld_candidates")
  .select("id,original_title,original_excerpt,source_url,source_name,published_at,source_language,story_country,source_country_hint,discovery_region,category")
  .eq("status","pending").eq("global_discovery",true)
  .gte("published_at",new Date(Date.now()-65*86400000).toISOString())
  .order("created_at",{ascending:false}).limit(75);
 if(error)return {error:"Candidate queue unavailable"};
 const {data:reviews}=await db.from("goodworld_auto_reviews")
   .select("candidate_id,status,checked_at")
   .in("candidate_id",(rows||[]).map((r:any)=>r.id).slice(0,75));
 const known=new Map((reviews||[]).map((r:any)=>[r.candidate_id,r]));
 const {data:trusted}=await db.from("goodworld_trusted_firsthand_domains")
  .select("hostname,organization,publication_country").eq("enabled",true);
 const domains=new Map((trusted||[]).map((r:any)=>[r.hostname,r]));
 const picked=[];
 for(const row of rows||[]){
  if(picked.length>=3)break;
  const old=known.get(row.id);
  if(old&&["ready","published","rejected"].includes(old.status))continue;
  if(old&&Date.now()-Date.parse(old.checked_at)<24*3600000)continue;
  const host=hostOf(row.source_url);
  const org=domains.get(host);
  if(!org)continue; // Other independent journalism needs second source verification.
  if(editorialBans.test(row.original_title))continue;
  const source=await loadOriginal(row.source_url);
  if(!source){
   await db.from("goodworld_auto_reviews").upsert({candidate_id:row.id,status:"needs_evidence",
    reason:"Firsthand source unavailable or too little independently extractable text",
    source_url:row.source_url,checked_at:new Date().toISOString()}, {onConflict:"candidate_id"});
   continue;
  }
  const sourceDate=String(row.published_at||"");
  if(!sourceDate||!extractPublisherDate(source.html,sourceDate)){
   await db.from("goodworld_auto_reviews").upsert({candidate_id:row.id,status:"needs_evidence",
    reason:"Official page does not expose matching publication date",source_url:row.source_url,
    checked_at:new Date().toISOString()},{onConflict:"candidate_id"});
   continue;
  }
  picked.push({id:row.id,source_url:row.source_url,source_name:row.source_name,
   original_title:row.original_title,source_publication_date:sourceDate,
   source_language:row.source_language,story_country_hint:row.story_country||row.source_country_hint,
   region_hint:row.discovery_region,category:row.category,firsthand_organization:org.organization,
   firsthand_organization_country:org.publication_country,
   source_text:source.text.slice(0,16000)});
 }
 return {tasks:picked,reviewedOnlyFirsthand:true,autoPublish:false};
}
async function commonsImage(query:string,subjectTerms:string[]){
 const terms=subjectTerms.map(s=>norm(s)).filter(s=>s.length>=4&&s.length<=35).slice(0,4);
 if(!terms.length||query.length<6||query.length>120)return null;
 const url=new URL("https://commons.wikimedia.org/w/api.php");
 for(const [k,v] of Object.entries({action:"query",format:"json",generator:"search",
    gsrsearch:query,gsrnamespace:"6",gsrlimit:"12",prop:"imageinfo",
    iiprop:"url|extmetadata|size|mime",iiurlwidth:"950",maxlag:"5"}))url.searchParams.set(k,v);
 let timer:number|undefined;
 try{
  const controller=new AbortController();timer=setTimeout(()=>controller.abort(),11500);
  const res=await fetch(url,{signal:controller.signal,headers:{
   "Accept":"application/json",
   "User-Agent":"GoodWorldNews/1.0 (https://www.goodworld.news; open-license verification)",
   "Api-User-Agent":"GoodWorldNews/1.0 (https://www.goodworld.news)" }});
  if(!res.ok)return null;
  const json=await res.json();
  if(json.error)return null;
  const pages=Object.values(json.query?.pages||{}) as any[];
  const matches=[] as any[];
  for(const page of pages){
   const ii=page.imageinfo?.[0],m=ii?.extmetadata;
   if(page.ns!==6||!ii||!m||ii.width<800||ii.height<480)continue;
   if(!/image\/(jpeg|png|webp)/i.test(String(ii.mime||"")))continue;
   const title=String(page.title||"").replace(/^File:/,"");
   if(!/\.(jpe?g|png|webp)$/i.test(title)||/\b(illustration|rendering|poster|logo|painting|drawing|screenshot|diagram|flag|stock)\b/i.test(title))continue;
   const short=norm(m.LicenseShortName?.value||"");
   const lic=supportedLicenses[short];
   if(!lic||m.Restrictions?.value&&clean(m.Restrictions.value))continue;
   if(short==="public domain"&&!/pd|public/i.test(String(m.License?.value||"")) &&m.Copyrighted?.value!=="False")continue;
   const licenseDeclared=String(m.LicenseUrl?.value||"");
   if(short.startsWith("cc ")&&licenseDeclared&&!licenseDeclared.startsWith("https://creativecommons.org/"))continue;
   const image=String(ii.thumburl||ii.url||"");
   const original=String(ii.url||"");
   const pageUrl=String(ii.descriptionurl||"");
   if(!/^https:\/\/(thumb|upload)[.]wikimedia[.]org\/wikipedia\/commons\//.test(image)||
     !pageUrl.startsWith("https://commons.wikimedia.org/wiki/File:"))continue;
   const titleLow=norm(title);
   const matchesTitle=terms.filter(x=>titleLow.includes(x)).length;
   if(matchesTitle<1)continue;
   const artist=clean(m.Artist?.value||"").slice(0,120) || "Wikimedia Commons contributor";
   if(artist.length<3)continue;
   const {data:used}=await db.from("goodworld_story_images").select("story_id")
     .or("credit_url.eq."+pageUrl+",image_url.eq."+image).limit(1);
   if(used?.length)continue;
   matches.push({image_url:image,original_url:original,page_url:pageUrl,credit:artist,
    license_name:clean(m.LicenseShortName?.value||""),license_url:lic,
    alt:"Representative photograph: "+title.replace(/\.(jpe?g|png|webp)$/i,"").slice(0,125)+". Not a photograph of the reported event.",
    image_kind:"representative",match:matchesTitle});
  }
  matches.sort((a,b)=>b.match-a.match);
  return matches[0]||null;
 }catch{return null}finally{if(timer)clearTimeout(timer)}
}
async function submit(payload:any){
 const id=trim(payload.id,80),draft=payload.draft||{};
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(id))return {accepted:false,reason:"Invalid candidate"};
 const {data:c,error}=await db.from("goodworld_candidates")
  .select("*").eq("id",id).eq("status","pending").eq("global_discovery",true).maybeSingle();
 if(error||!c)return {accepted:false,reason:"Candidate not pending"};
 const host=hostOf(c.source_url);
 const {data:trust}=await db.from("goodworld_trusted_firsthand_domains")
  .select("organization").eq("hostname",host).eq("enabled",true).maybeSingle();
 if(!trust)return {accepted:false,reason:"Independent secondary source verification unavailable"};
 const original=await loadOriginal(c.source_url);
 const parsedDate=new Date(c.published_at);
 const age=Date.now()-parsedDate.getTime();
 if(!original||!Number.isFinite(age)||age<0||age>65*86400000||
  !sourceDateMatches(original.html,String(c.published_at)))return {accepted:false,reason:"Publication source/date not verifiable"};
 const quoteList=Array.isArray(draft.evidence_quotes)?draft.evidence_quotes:[];
 const quotes=quoteList.map((s:any)=>clean(s)).filter((s:string)=>s.length>=20&&s.length<=220).slice(0,6);
 const originalNorm=norm(original.text);
 const grounded=quotes.filter((s:string)=>originalNorm.includes(norm(s)));
 const country=trim(draft.story_country,85),headline=trim(draft.title,180),summary=trim(draft.summary,500),
   body=trim(draft.body,9000),category=trim(draft.category,65);
 const pass=draft.decision==="publish" && draft.firsthand_reporting===true &&
  draft.outcome_completed===true && draft.event_country_explicit===true &&
  draft.copyright_safe_original===true &&
  grounded.length>=3 && new Set(grounded).size>=3 &&
  country.length>=2 && headline.length>=15 && summary.length>=35 && body.length>=220 &&
  !editorialBans.test(headline) && !editorialBans.test(summary) &&
  ["Animals","Nature & Planet","Human Kindness","Science & Health","Education","Innovation"].includes(category);
 // A verified evidence phrase has to identify the actual EVENT LOCATION, not the publisher country.
 const aliases:Record<string,string[]>={
  "morocco":["morocco","marokko","maroc"],
  "vietnam":["vietnam","việt nam","viet nam"],
  "democratic republic of the congo":["democratic republic of the congo","dr congo","drc","congo","rdc"],
  "taiwan":["taiwan","臺灣","台灣"]
 };
 const cTokens=aliases[country.toLowerCase()]||[country.toLowerCase()];
 const countryInOriginal=cTokens.some(t=>norm(original.text).includes(norm(t)));
 const reason=trim(draft.reason,350)||"Unconfirmed extraordinary positive outcome, location or independent original writing";
 const base={candidate_id:id,checked_at:new Date().toISOString(),
  source_retrieved_at:new Date().toISOString(),source_url:c.source_url,
  source_publication_date:c.published_at,original_title:c.original_title,
  editor_model:"gpt-4.1-mini"};
 if(!pass||!countryInOriginal){
  await db.from("goodworld_auto_reviews").upsert({...base,status:"needs_evidence",
    reason:!countryInOriginal?"Event country not explicit in the first-party report":reason,
    evidence_quotes:grounded}, {onConflict:"candidate_id"});
  return {accepted:false,reason:!countryInOriginal?"country unverified":reason};
 }
 if((await db.from("goodworld_stories").select("id").eq("source_url",c.source_url).limit(1)).data?.length)
  return {accepted:false,reason:"Duplicate published or removed source"};
 const subjectTerms=Array.isArray(draft.photo_subject_terms)?draft.photo_subject_terms:[];
 const photo=await commonsImage(trim(draft.photo_search,120),subjectTerms);
 const nextStatus=photo?"ready":"needs_photo";
 const data={...base,status:nextStatus,reason:photo?"Verified firsthand source, country, outcome and open-license photo":"No eligible freely licensed subject-matched photograph",
  evidence_quotes:grounded,verified_firsthand:true,verified_country:country,
  draft_title:headline,draft_summary:summary,draft_body:body,category,photo};
 const {error:writeErr}=await db.from("goodworld_auto_reviews").upsert(data,{onConflict:"candidate_id"});
 if(writeErr)return {accepted:false,reason:"Failed to save verified story: "+writeErr.message.slice(0,160)};
 return {accepted:!!photo,status:nextStatus,photo_licensed:!!photo,queued_for_hourly_publication:!!photo};
}
Deno.serve(async req=>{
 if(req.method!=="POST")return Response.json({error:"POST required"},{status:405});
 if(!(await authenticated(req)))return Response.json({error:"GitHub workflow identity required"},{status:403});
 let body:any={};
 try{body=await req.json()}catch{return Response.json({error:"Invalid JSON"},{status:400})}
 try{
  const result=body.action==="next"?await getWork():body.action==="submit"?await submit(body):{error:"Unsupported action"};
  return Response.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  return Response.json({error:"Verification worker failure",details:String(e instanceof Error?e.message:e).slice(0,180)}, {status:500});
 }
});