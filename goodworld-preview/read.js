"use strict";
/* Read an already published GoodWorld brief in the visitor's chosen language.
   Machine translations come from the offline translation job and are labeled.
   The original official source and copyright information remain accessible. */
(function(){
 const GW_URL="https://jdmpmrhyjitmjyjuhtds.supabase.co";
 const GW_KEY="sb_publishable_Mi4xc0jwt_MFKhjKWZ1Vpw_bG6VPp3_";
 const out=document.getElementById("articleRegion");
 const lang=()=>window.GW_I18N;
 const tx=k=>lang()?.t(k)||k;
 const escape=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 const safe=u=>{try{const a=new URL(u);return a.protocol==="https:"?a.href:""}catch{return ""}};
 const query=new URLSearchParams(location.search), slug=query.get("story");
 let article=null,rights=null;
 let engagementTracked=false;
 function trackArticleRead(){
  if(!article||engagementTracked||!window.GWAnalytics?.enabled())return;
  engagementTracked=true;
  const chosen=lang()?.getLang()||"en";
  window.GWAnalytics.track("read_article",{
   content_type:"article",content_id:article.slug,
   language:chosen,story_category:article.category,
   translation_status:chosen==="en"?"original":lang()?.translated(article)?"machine":"pending"
  });
 }
 window.addEventListener("gw:analytics-ready",trackArticleRead);

 async function load(){
  if(!slug||!/^[-a-z0-9]{5,120}$/.test(slug)){renderUnavailable();return}
  try{
   const client=window.supabase?.createClient(GW_URL,GW_KEY);
   if(!client)throw new Error("News service unavailable");
   const {data,error}=await client.rpc("get_goodworld_feed",{p_order:"new"});
   if(error)throw error;
   article=(data||[]).find(s=>s.slug===slug);
   if(!article){renderUnavailable();return}
   const {data:images,error:imageError}=await client.from("goodworld_story_images")
    .select("story_id,image_url,credit,credit_url,alt_text,rights_url,image_license,image_rights_status,image_kind")
    .eq("story_id",article.id).limit(1);
   if(!imageError&&images?.length&&images[0].image_rights_status==="allowed_auto"&&images[0].image_url===article.image_url)
    rights=images[0];
   render();
  }catch(e){console.warn("Unable to load GoodWorld story",e);renderUnavailable()}
 }
 function renderUnavailable(){
  out.innerHTML='<h1>'+escape(tx("unable"))+'</h1><p><a class="reader-link" href="/?lang='+
   encodeURIComponent(lang()?.getLang()||"en")+'">'+escape(tx("back"))+'</a></p>';
 }
 function render(){
  if(!article)return;
  const locale=lang()?.locale()||"en-US";
  const selected=lang()?.getLang()||"en";
  const t=lang()?.translated(article);
  const title=t?.title||article.title;
  const summary=t?.summary||article.summary;
  const body=t?.body||article.body||"";
  const original=safe(article.source_url);
  const readDate=new Intl.DateTimeFormat(locale,{day:"numeric",month:"long",year:"numeric"}).format(new Date(article.published_at));
  document.title=title+" | GoodWorld";
  const photo=rights&&safe(rights.image_url)?
   '<figure class="article-hero"><img class="reader-photo" loading="eager" decoding="async" referrerpolicy="no-referrer" src="'+escape(safe(rights.image_url))+'" alt="'+escape(rights.alt_text)+'">'+
   '<figcaption class="reader-image-credit">'+
   (rights.image_kind==="representative"?escape(tx("representative"))+" · ":"")+
   '<a href="'+escape(safe(rights.credit_url))+'" rel="noopener noreferrer" target="_blank">'+escape(rights.credit)+'</a>'+
   (safe(rights.rights_url)?' · <a href="'+escape(safe(rights.rights_url))+'" rel="noopener noreferrer" target="_blank">'+escape(rights.image_license||tx("rights"))+'</a>':'')+
   '</figcaption></figure>':"";
  const notice=selected==="en"?"":'<aside class="reader-disclosure" role="note">'+
     escape(t?tx("machine"):tx("pending"))+'. '+escape(tx("disclosure"))+'</aside>';
  const paragraphs=String(body).split(/\n\s*\n/).map(p=>'<p>'+escape(p).replace(/\n/g," ")+'</p>').join("");
  out.innerHTML='<p class="reader-meta">'+escape(article.category)+' · '+escape(readDate)+' · '+escape(article.source_name)+'</p>'+
   '<h1>'+escape(title)+'</h1>'+
   notice+'<p class="reader-summary">'+escape(summary)+'</p>'+
   photo+
   '<div class="read-news-body">'+paragraphs+'</div>'+
   '<div class="reader-citation"><p>'+escape(tx("reported"))+': '+escape(article.source_name)+'</p>'+
   (original?'<p><a class="reader-link" href="'+escape(original)+'" rel="noopener noreferrer" target="_blank">'+escape(tx("original"))+' ↗</a></p>':'')+
   '<p><a class="reader-link" href="/?lang='+encodeURIComponent(selected)+'">'+escape(tx("back"))+'</a></p></div>';
  const back=document.getElementById("backHome");
  if(back)back.href=selected==="en"?"/":"/"+encodeURIComponent(selected)+"/";
  trackArticleRead();
 }
 window.addEventListener("goodworld:language-changed",render);
 window.addEventListener("goodworld:translations-loaded",render);
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load,{once:true});else load();
})();
