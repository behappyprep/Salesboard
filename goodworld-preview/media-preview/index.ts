import {createClient} from "npm:@supabase/supabase-js@2.57.0";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default,{auth:{persistSession:false,autoRefreshToken:false}});
const hash=async(b:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",b)),x=>x.toString(16).padStart(2,"0")).join("");
Deno.serve(async(req)=>{
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const token=req.headers.get("x-goodworld-media-token")||"";
 const {data:auth,error}=await db.from("goodworld_media_worker_auth").select("token_sha256").eq("id",true).single();
 if(error||token.length!==64||await hash(new TextEncoder().encode(token))!==auth?.token_sha256)return new Response("Forbidden",{status:403});
 try{
 const {asset_id,action="preview",expected_sha256}=await req.json();
 if(!["preview","archive"].includes(action))return Response.json({error:"Invalid action"},{status:400});
 if(typeof asset_id!=="string"||!/^[0-9a-f-]{36}$/i.test(asset_id))return Response.json({error:"Invalid asset ID"},{status:400});
 const row=await db.from("goodworld_media_assets").select("id,original_url,provider,source_page,review_status,archive_status,license,license_url").eq("id",asset_id).single();
 if(row.error||!row.data)return Response.json({error:"Asset not found"},{status:404});
 const u=new URL(row.data.original_url);
 const commons=(u.hostname==="upload.wikimedia.org"||u.hostname==="thumb.wikimedia.org")&&u.pathname.startsWith("/wikipedia/commons/");
 const inat=u.hostname==="inaturalist-open-data.s3.amazonaws.com"&&/^\/photos\/[0-9]+\/(?:large|medium|small)\.(?:jpe?g|png|webp)$/i.test(u.pathname);
 const gov=(row.data.provider==="nps"&&u.hostname==="www.nps.gov"&&/^\/[a-z0-9]+\/learn\/news\/images\/[\w.-]+\.jpe?g$/i.test(u.pathname)&&new URL(row.data.source_page).hostname==="www.nps.gov")||(row.data.provider==="dvids"&&u.hostname==="d1ldvf68ux039x.cloudfront.net"&&/^\/thumbs\/photos\/\d{4}\/\d+\/1000w_q95\.jpg$/.test(u.pathname)&&new URL(row.data.source_page).hostname==="www.dvidshub.net");
 if(u.protocol!=="https:"||u.port||u.username||u.password||! (commons||inat||gov))return Response.json({error:"Unsupported photo host or path"},{status:400});
 if(inat)u.pathname=u.pathname.replace(/\/large\./,"/medium.");
 const max=1024*1024;
 const r=await fetch(u,{redirect:"error",signal:AbortSignal.timeout(12000),headers:{"User-Agent":"GoodWorldNews/1.0 (https://www.goodworld.news/; editorial preview)"}});
 const mime=(r.headers.get("content-type")||"").split(";")[0].toLowerCase();
 if(!r.ok||!["image/jpeg","image/png","image/webp"].includes(mime)||Number(r.headers.get("content-length"))>max||!r.body)return Response.json({error:"Image unavailable or too large for preview",status:r.status,mime},{status:422});
 const rd=r.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await rd.read();if(done)break;size+=value.length;if(size>max){await rd.cancel();return Response.json({error:"Preview limit 1 MiB"},{status:422});}chunks.push(value);}
 const b=new Uint8Array(size);let offset=0;for(const c of chunks){b.set(c,offset);offset+=c.length;}
 const jpeg=b[0]===255&&b[1]===216&&b[2]===255,png=b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71,webp=String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP";
 if(!(mime==="image/jpeg"&&jpeg||mime==="image/png"&&png||mime==="image/webp"&&webp))return Response.json({error:"Invalid image bytes"},{status:422});
 const sha=await hash(b);
 if(action==="archive"){
  if(!gov||row.data.review_status!=="approved"||row.data.license!=="Public domain (US government)"||row.data.archive_status==="stored"||typeof expected_sha256!=="string"||expected_sha256!==sha)return Response.json({error:"Archive approval or checked-byte hash missing"},{status:403});
  const cap=await db.from("goodworld_media_assets").select("id",{count:"exact",head:true}).eq("archive_status","stored");if(cap.error||(cap.count||0)>=150)return Response.json({error:"Archive limit"}, {status:409});
  const dup=await db.from("goodworld_media_assets").select("id").eq("sha256",sha).maybeSingle();if(dup.error||dup.data)return Response.json({error:"Image already assigned"},{status:409});
  const path=sha+(mime==="image/jpeg"?".jpg":mime==="image/png"?".png":".webp");
  const bucket=db.storage.from("goodworld-media"),up=await bucket.upload(path,b,{contentType:mime,upsert:false,cacheControl:"86400"});
  if(up.error&&!/already exists|duplicate/i.test(up.error.message))return Response.json({error:"Upload failed"},{status:502});
  const public_url=bucket.getPublicUrl(path).data.publicUrl,check=await fetch(public_url,{signal:AbortSignal.timeout(12000)});
  if(!check.ok||await hash(new Uint8Array(await check.arrayBuffer()))!==sha)return Response.json({error:"Stored file verification failed"},{status:502});
  const save=await db.from("goodworld_media_assets").update({archive_status:"stored",archive_error:null,storage_path:path,sha256:sha,byte_size:size,mime_type:mime,archived_from_url:u.href,source_byte_size:size,archived_at:new Date().toISOString()}).eq("id",asset_id).eq("review_status","approved");
  if(save.error)return Response.json({error:"Archive record failed"},{status:502});
  return Response.json({asset_id,sha256:sha,bytes:size,public_url},{headers:{"Cache-Control":"no-store"}});
 }
 let s="";for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));
 return Response.json({asset_id,mime,bytes:size,sha256:await hash(b),url:u.href,base64:btoa(s)},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return Response.json({error:"Preview failed"},{status:502});}
});