"use strict";
// GoodWorld public editorial archive.
// This progressively enhances the crawlable 23-story HTML archive.
// It uses only the public read-only Supabase API (RLS: published stories).
// If network/API is down, existing static links remain fully available.
(async function refreshEditorialArchive(){
  const grid=document.querySelector(".archive-grid");
  if(!grid)return;
  const url="https://jdmpmrhyjitmjyjuhtds.supabase.co/rest/v1/goodworld_stories"+
    "?select=id,slug,title,summary,body,category,image_url,source_url,published_at"+
    "&status=eq.published&published_at=not.is.null"+
    "&order=published_at.desc&limit=500";
  const key="sb_publishable_Mi4xc0jwt_MFKhjKWZ1Vpw_bG6VPp3_";
  try{
    const response=await fetch(url,{method:"GET",headers:{"apikey":key,"Accept":"application/json"}});
    if(!response.ok)throw new Error("Archive unavailable");
    const stories=await response.json();
    if(!Array.isArray(stories))return;
    const qualified=stories.filter(s=>
      s&&typeof s.slug==="string"&&/^[a-z0-9-]{5,120}$/.test(s.slug)&&
      !s.slug.startsWith("auto-")&&!s.slug.startsWith("gov-")&&
      String(s.title||"").trim().length>=15&&
      String(s.summary||"").trim().length>=30&&
      String(s.body||"").trim().length>=200&&
      String(s.source_url||"").startsWith("https://")&&
      Number.isFinite(Date.parse(s.published_at))
    );
    if(!qualified.length)return;
    const rightsUrl="https://jdmpmrhyjitmjyjuhtds.supabase.co/rest/v1/goodworld_story_images"+
      "?select=story_id,image_url,alt_text,credit&limit=2000";
    const rightsResponse=await fetch(rightsUrl,{
      headers:{"apikey":key,"Accept":"application/json"}
    });
    if(!rightsResponse.ok)throw new Error("Photo rights unavailable");
    const rightsData=await rightsResponse.json();
    const rights=new Map((rightsData||[]).map(x=>[x.story_id,x]));
    const fragment=document.createDocumentFragment();
    for(const s of qualified){
      const card=document.createElement("a");card.className="archive-card";
      card.href="/stories/"+encodeURIComponent(s.slug)+".html";
      const record=rights.get(s.id);
      if(record&&record.image_url===s.image_url){
        const img=document.createElement("img");
        img.className="archive-thumb";
        img.src=s.image_url;
        img.alt=record.alt_text;
        img.loading="lazy";
        img.decoding="async";
        img.referrerPolicy="no-referrer";
        card.appendChild(img);
      }
      const category=document.createElement("span");category.className="category";
      category.textContent=s.category||"Good News";
      const title=document.createElement("strong");title.textContent=s.title;
      const stamp=document.createElement("time");
      stamp.dateTime=new Date(s.published_at).toISOString();
      stamp.textContent=new Date(s.published_at).toLocaleDateString("en-US",{
        month:"long",day:"numeric",year:"numeric",timeZone:"UTC"
      });
      card.append(category,title,stamp);fragment.append(card);
    }
    grid.replaceChildren(fragment);
  }catch(error){
    // Static, server-rendered archive remains a useful SEO and reader fallback.
    console.info("Using static GoodWorld story archive");
  }
})();
