"use strict";
// GoodWorld public editorial archive.
// This progressively enhances the crawlable 23-story HTML archive.
// It uses only the public read-only Supabase API (RLS: published stories).
// If network/API is down, existing static links remain fully available.
(async function refreshEditorialArchive(){
  const grid=document.querySelector(".archive-grid");
  if(!grid)return;
  const url="https://jdmpmrhyjitmjyjuhtds.supabase.co/rest/v1/goodworld_stories"+
    "?select=slug,title,summary,body,category,source_url,published_at"+
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
      !s.slug.startsWith("auto-")&&
      String(s.title||"").trim().length>=15&&
      String(s.summary||"").trim().length>=30&&
      String(s.body||"").trim().length>=200&&
      String(s.source_url||"").startsWith("https://")&&
      Number.isFinite(Date.parse(s.published_at))
    );
    if(!qualified.length)return;
    const fragment=document.createDocumentFragment();
    for(const s of qualified){
      const card=document.createElement("a");card.className="archive-card";
      card.href="/stories/"+encodeURIComponent(s.slug)+".html";
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
