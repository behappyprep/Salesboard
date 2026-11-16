"use strict";
(async function(){
 const root=document.getElementById("article");
 const slug=new URLSearchParams(location.search).get("slug")||"";
 const api="https://jdmpmrhyjitmjyjuhtds.supabase.co/rest/v1/";
 const key="sb_publishable_Mi4xc0jwt_MFKhjKWZ1Vpw_bG6VPp3_";
 const headers={apikey:key,Accept:"application/json"};
 const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x};
 const error=()=>root.replaceChildren(el("h1","","Story unavailable"),el("p","","This story is not available. Please return to the latest news."));
 if(!/^[a-z0-9-]{5,120}$/.test(slug)){error();return}
 try{
  const r=await fetch(api+"goodworld_stories?select=id,slug,title,summary,body,category,image_url,source_url,source_name,published_at,story_country&slug=eq."+encodeURIComponent(slug)+"&status=eq.published&limit=1",{headers});
  if(!r.ok)throw Error("story lookup");
  const a=await r.json(),s=a[0];if(!s||!s.body||s.body.length<200){error();return}
  const ir=await fetch(api+"goodworld_story_images?select=image_url,credit,credit_url,alt_text,image_license,rights_url,image_kind&story_id=eq."+encodeURIComponent(s.id)+"&limit=1",{headers});
  const photos=ir.ok?await ir.json():[];const photo=photos[0];
  document.title=s.title+" | GoodWorld";
  const desc=document.createElement("meta");desc.name="description";desc.content=s.summary||"";document.head.append(desc);
  const h=el("h1","",s.title),summary=el("p","article-intro",s.summary),meta=el("p","gw-meta",(s.story_country||"GoodWorld")+" · "+new Date(s.published_at).toLocaleDateString("en-US",{dateStyle:"long"}));
  root.replaceChildren(meta,h,summary);
  if(photo&&photo.image_url===s.image_url&&/^https:\/\/upload\.wikimedia\.org\//.test(photo.image_url)){
   const img=el("img","gw-photo");img.src=photo.image_url;img.alt=photo.alt_text||s.title;img.referrerPolicy="no-referrer";root.append(img);
   const cap=el("p","gw-meta",(photo.image_kind==="representative"?"Representative photo · ":"")+"Photo: "+(photo.credit||"Wikimedia Commons")+" · "+(photo.image_license||""));root.append(cap);
  }
  root.append(el("div","gw-body",s.body.replace(/\\n/g,"\n")));
  if(/^https:\/\//.test(s.source_url||"")){const p=el("p","gw-source"),a=el("a","","Original source: "+(s.source_name||"Read source"));a.href=s.source_url;a.target="_blank";a.rel="noopener noreferrer";p.append(a);root.append(p)}
  const home=el("p",""),link=el("a","","← More good news");link.href="/";home.append(link);root.append(home);
 }catch(e){error()}
})();