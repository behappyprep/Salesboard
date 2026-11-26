import {createClient} from "npm:@supabase/supabase-js@2.57.0";
const url=Deno.env.get("SUPABASE_URL")!;
const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default;
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket="goodworld-media";
const UA="GoodWorldNews/1.0 (https://www.goodworld.news/; photo research)";
const hex=async(b:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",b)),x=>x.toString(16).padStart(2,"0")).join("");
const safe=(s:unknown)=>typeof s==="string"&&s.startsWith("https://");
const allowed=new Set(["by","by-sa","cc0","pdm"]);
const errors:string[]=[];
async function json(u:string){const r=await fetch(u,{headers:{"User-Agent":UA,Accept:"application/json"},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error("HTTP "+r.status);return await r.json();}
async function candidates(j:any,provider:string){
 let rows:any[]=[];
 if(provider==="openverse"){
  const p=new URLSearchParams({q:j.query,license:"by,by-sa,cc0,pdm",page_size:"12",mature:"false"});
  const d=await json("https://api.openverse.org/v1/images/?"+p);
  rows=(d.results||[]).filter((x:any)=>allowed.has(x.license)&&safe(x.url)&&safe(x.foreign_landing_url)).map((x:any)=>({original_url:x.url,source_page:x.foreign_landing_url,title:x.title,creator:x.creator,license:x.license+" "+(x.license_version||""),license_url:x.license_url}));
 }else if(provider==="commons"){
  const p=new URLSearchParams({action:"query",generator:"search",gsrsearch:j.query,gsrnamespace:"6",gsrlimit:"10",prop:"imageinfo",iiprop:"url|extmetadata|mime",iiurlwidth:"960",format:"json"});
  const d=await json("https://commons.wikimedia.org/w/api.php?"+p);
  rows=Object.values(d.query?.pages||{}).flatMap((x:any)=>{const i=x.imageinfo?.[0];const m=i?.extmetadata||{};const l=m.LicenseShortName?.value||"";return i&&/^image\/(jpeg|png|webp)$/.test(i.mime)&&/^(CC BY(?:-SA)? [234]\.0|CC0|Public domain)$/i.test(l)&&safe(i.url)&&safe(i.descriptionurl)?[{original_url:i.url,source_page:i.descriptionurl,title:x.title,creator:(m.Artist?.value||"").replace(/<[^>]*>/g," ").slice(0,500),license:l,license_url:m.LicenseUrl?.value||null}]:[];});
 }else if(provider==="inaturalist"){
  if(!j.scientific_name)return 0;
  const p=new URLSearchParams({taxon_name:j.scientific_name,quality_grade:"research",photo_license:"cc-by,cc-by-sa,cc0",photos:"true",per_page:"8",order_by:"votes"});
  const d=await json("https://api.inaturalist.org/v1/observations?"+p);
  rows=(d.results||[]).flatMap((x:any)=>(x.photos||[]).slice(0,1).filter((p:any)=>["cc-by","cc-by-sa","cc0"].includes(p.license_code)&&safe(p.url)&&safe(x.uri)).map((p:any)=>({original_url:p.url.replace(/\/square\./,"/large."),source_page:x.uri,title:x.taxon?.name||j.scientific_name,creator:p.attribution,license:p.license_code,license_url:null})));
 }
 let n=0;
 for(const a of rows){const {error}=await db.from("goodworld_media_assets").insert({...a,provider,search_job_id:j.id,story_id:j.story_id||null});if(!error)n++;else if(error.code!=="23505")throw Error(error.message);}
 return n;
}
async function archive(a:any){
 // Phase 1: only previously reviewed, explicitly open-licensed Wikimedia files.
 const u=new URL(a.original_url);
 if(!["upload.wikimedia.org","thumb.wikimedia.org"].includes(u.hostname)||u.protocol!=="https:"||u.username||u.password||u.port||!u.pathname.startsWith("/wikipedia/commons/"))throw Error("Download host not enabled for automatic archiving");
 if(!/^CC BY(?:-SA)? [234]\.0$/i.test(a.license||"")&&!/^CC0(?: 1\.0)?$/i.test(a.license||""))throw Error("Explicit reusable license required");
 if(!/^https:\/\/creativecommons\.org\/(licenses\/(by|by-sa)\/[234]\.0|publicdomain\/zero\/1\.0)\/?$/.test(a.license_url||""))throw Error("License URL not recognized");
 // Prefer a source-generated 960px version of the same verified Commons file.
 // Preserve original URL, source size, and exact derivative URL for attribution.
 let download=u, sourceSize:number|null=null, transformNote:string|null=null;
 try {
  const page=new URL(a.source_page);
  if(page.hostname==="commons.wikimedia.org"&&page.pathname.startsWith("/wiki/File:")){
   const title=decodeURIComponent(page.pathname.slice(6));
   const p=new URLSearchParams({action:"query",titles:title,prop:"imageinfo",iiprop:"url|size|mime|extmetadata",iiurlwidth:"960",format:"json"});
   const data=await json("https://commons.wikimedia.org/w/api.php?"+p);
   const info=(Object.values(data.query?.pages||{})[0] as any)?.imageinfo?.[0];
   if(info&&new URL(info.url).pathname===u.pathname&&info.extmetadata?.LicenseShortName?.value?.toLowerCase()===a.license.toLowerCase()){
    sourceSize=Number(info.size)||null;
    if(info.thumburl&&Number(info.width)>960){
     const t=new URL(info.thumburl);
     if(["upload.wikimedia.org","thumb.wikimedia.org"].includes(t.hostname)&&t.protocol==="https:"&&!t.username&&!t.password&&!t.port&&t.pathname.startsWith("/wikipedia/commons/")){
      download=t;transformNote="Resized to "+info.thumbwidth+" × "+info.thumbheight+" pixels by Wikimedia Commons; no editorial alteration.";
     }
    }
   }
  }
 }catch(e){console.warn("Thumbnail lookup unavailable",String(e).slice(0,150));}
 let r=await fetch(download,{redirect:"error",headers:{"User-Agent":UA},signal:AbortSignal.timeout(18000)});
 if(download.href!==u.href&&(!r.ok||!r.headers.get("content-type")?.startsWith("image/")||Number(r.headers.get("content-length"))>3*1024*1024)){
  await r.body?.cancel();download=u;transformNote=null;r=await fetch(u,{redirect:"error",headers:{"User-Agent":UA},signal:AbortSignal.timeout(18000)});
 }
 const mime=(r.headers.get("content-type")||"").split(";")[0].toLowerCase();
 const max=3*1024*1024;
 if(!r.ok||!["image/jpeg","image/png","image/webp"].includes(mime)||Number(r.headers.get("content-length"))>max||!r.body)throw Error("Unsupported image response "+r.status+" "+mime);
 const rd=r.body.getReader();let chunks:Uint8Array[]=[],size=0;
 while(true){const {done,value}=await rd.read();if(done)break;size+=value.length;if(size>max){await rd.cancel();throw Error("File larger than 3 MiB");}chunks.push(value);}
 const b=new Uint8Array(size);let offset=0;for(const c of chunks){b.set(c,offset);offset+=c.length;}
 const jpeg=b[0]===255&&b[1]===216&&b[2]===255;const png=b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71;const webp=String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP";
 if(!(mime==="image/jpeg"&&jpeg||mime==="image/png"&&png||mime==="image/webp"&&webp))throw Error("Image magic mismatch");
 const hash=await hex(b),ext=mime==="image/jpeg"?"jpg":mime.split("/")[1],path=hash+"."+ext;
 const prior=await db.from("goodworld_media_assets").select("id").eq("sha256",hash).maybeSingle();if(prior.error)throw Error(prior.error.message);if(prior.data&&prior.data.id!==a.id)throw Error("Identical file already archived");
 const upload=await db.storage.from(bucket).upload(path,b,{contentType:mime,upsert:false,cacheControl:"86400"});
 if(upload.error&&!/already exists|duplicate/i.test(upload.error.message))throw Error(upload.error.message);
 const publicUrl=db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
 const check=await fetch(publicUrl,{signal:AbortSignal.timeout(12000)});
 if(!check.ok||!check.headers.get("content-type")?.startsWith("image/"))throw Error("Public storage verification failed");
 if(await hex(new Uint8Array(await check.arrayBuffer()))!==hash)throw Error("Storage byte verification failed");
 const update=await db.from("goodworld_media_assets").update({archive_status:"stored",archive_error:null,storage_path:path,sha256:hash,byte_size:size,mime_type:mime,archived_from_url:download.href,source_byte_size:sourceSize||(!transformNote?size:null),transform_note:transformNote,archived_at:new Date().toISOString()}).eq("id",a.id).eq("review_status","approved");
 if(update.error)throw Error(update.error.message);
}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const token=req.headers.get("x-goodworld-media-token")||"";
 const {data:auth,error:ae}=await db.from("goodworld_media_worker_auth").select("token_sha256").eq("id",true).single();
 if(ae||token.length!==64||await hex(new TextEncoder().encode(token))!==auth?.token_sha256)return new Response("Forbidden",{status:403});
 const problems:string[]=[];let searched=0,found=0,stored=0;
 const jobs=await db.from("goodworld_media_search_jobs").select("*").in("status",["pending","retry"]).lt("attempts",3).order("priority").order("created_at").limit(2);
 if(jobs.error)return Response.json({error:jobs.error.message},{status:500});
 for(const j of jobs.data||[]){
  let ok=0,fail:string[]=[];
  for(const provider of ["openverse","commons",...(j.scientific_name?["inaturalist"]:[])]){
   try{found+=await candidates(j,provider);ok++;}catch(e){fail.push(provider+": "+String(e).slice(0,200));}
  }
  const update=await db.from("goodworld_media_search_jobs").update({status:ok&&fail.length===0?"searched":"retry",attempts:j.attempts+1,last_checked_at:new Date().toISOString(),last_error:fail.join("; ")||null}).eq("id",j.id);
  if(update.error)fail.push(update.error.message);problems.push(...fail);searched++;
 }
 try{
  const existing=await db.storage.getBucket(bucket);
  if(existing.error){const created=await db.storage.createBucket(bucket,{public:true,fileSizeLimit:3145728,allowedMimeTypes:["image/jpeg","image/png","image/webp"]});if(created.error)throw Error(created.error.message);}
  else if(!existing.data.public)throw Error("Media bucket not public");
  const count=await db.from("goodworld_media_assets").select("id",{count:"exact",head:true}).eq("archive_status","stored");if(count.error)throw Error(count.error.message);
  // 150 * 3 MiB = 450 MiB maximum in this initial phase.
  if((count.count||0)<150){
   const assets=await db.from("goodworld_media_assets").select("*").eq("review_status","approved").eq("archive_status","pending").order("created_at").limit(Math.min(2,150-(count.count||0)));
   if(assets.error)throw Error(assets.error.message);
   for(const a of assets.data||[]){try{await archive(a);stored++;}catch(e){const msg=String(e).slice(0,350);problems.push("archive "+a.id+": "+msg);const u=await db.from("goodworld_media_assets").update({archive_status:"error",archive_error:msg}).eq("id",a.id);if(u.error)problems.push(u.error.message);}}
  }
 }catch(e){problems.push(String(e).slice(0,350));}
 const log=await db.from("goodworld_media_runs").insert({jobs_searched:searched,assets_found:found,assets_stored:stored,errors:problems});if(log.error)return Response.json({error:log.error.message},{status:500});
 return Response.json({searched,found,stored,errors:problems});
});