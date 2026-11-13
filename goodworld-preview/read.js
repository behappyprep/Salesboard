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
 const query=new URLSearchParams(location.search), slug=query.get("story")||(/^\/news\/([a-z0-9-]+)\.html$/.exec(location.pathname)?.[1])||null;
 let article=null,rights=null,originalSourceDate=null;
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
   if(!article){
    // Older bookmarked reports remain readable even if editorial standards
    // have since excluded them from the homepage.
    const {data:published,error:lookupError}=await client.from("goodworld_stories")
     .select("id,slug,title,summary,body,category,image_url,source_url,source_name,published_at")
     .eq("slug",slug).eq("status","published").maybeSingle();
    if(!lookupError)article=published;
   }
   if(!article){renderUnavailable();return}
   const {data:images,error:imageError}=await client.from("goodworld_story_images")
    .select("story_id,image_url,credit,credit_url,alt_text,rights_url,image_license,image_rights_status,image_kind")
    .eq("story_id",article.id).limit(1);
   if(!imageError&&images?.length&&images[0].image_rights_status==="allowed_auto"&&images[0].image_url===article.image_url)
    rights=images[0];
   // Original-source date is different from the date GoodWorld indexed a brief.
   if(article.slug.startsWith("gov-")){
    try{
     const {data:sourceDate,error:dateError}=await client.rpc(
      "get_goodworld_original_publication_date",{p_story_id:article.id}
     );
     if(!dateError)originalSourceDate=sourceDate||null;
    }catch(_){}
   }
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
  const original=safe(article.source_url);
  const back=document.getElementById("backHome");
  if(back)back.href=selected==="en"?"/":"/"+encodeURIComponent(selected)+"/";

  // English must never silently replace the visitor's requested language.
  if(selected!=="en"&&!t){
   const notes={
    ru:["Перевод готовится","Эта история ещё переводится на русский. Пока можно открыть первоисточник или вернуться к готовым новостям."],
    es:["Traducción en preparación","Estamos traduciendo esta historia. Puedes leer la fuente original mientras tanto."],
    fr:["Traduction en préparation","Nous traduisons cette histoire. Vous pouvez consulter la source originale en attendant."],
    pt:["Tradução em preparação","Estamos traduzindo esta história. Enquanto isso, você pode consultar a fonte original."],
    zh:["翻译准备中","这篇新闻正在翻译。您可以先查看原始来源。"],
    hi:["अनुवाद तैयार हो रहा है","इस खबर का अनुवाद चल रहा है। फिलहाल मूल स्रोत पढ़ सकते हैं।"],
    ar:["جارٍ إعداد الترجمة","تجري ترجمة هذه القصة. يمكنك الاطلاع على المصدر الأصلي مؤقتًا."],
    bn:["অনুবাদ তৈরি হচ্ছে","এই খবরটির অনুবাদ চলছে। আপাতত মূল উৎস দেখতে পারেন।"],
    id:["Terjemahan sedang disiapkan","Cerita ini sedang diterjemahkan. Anda dapat membaca sumber aslinya sementara itu."],
    ur:["ترجمہ تیار ہو رہا ہے","اس خبر کا ترجمہ جاری ہے۔ اس دوران اصل ماخذ دیکھ سکتے ہیں۔"]
   };
   const msg=notes[selected]||["Translation in progress","This story is being translated."];
   document.title=msg[0]+" | GoodWorld";
   out.innerHTML='<div class="reader-wait" role="status"><h1>'+escape(msg[0])+'</h1><p>'+escape(msg[1])+'</p>'+
    (original?'<a class="reader-link" href="'+escape(original)+'" target="_blank" rel="noopener noreferrer">'+escape(tx("original"))+'</a>':'')+
    '<p><a class="reader-link" href="'+escape(back?.href||"/")+'">'+escape(tx("back"))+'</a></p></div>';
   return;
  }
  const title=t?.title||article.title;
  const summary=t?.summary||article.summary;
  const body=t?.body||article.body||"";
  const brief=article.slug.startsWith("gov-");
  const actualDate=originalSourceDate||article.published_at;
  const readDate=new Intl.DateTimeFormat(locale,{day:"numeric",month:"long",year:"numeric"}).format(new Date(actualDate));
  document.title=title+" | GoodWorld";

  const photo=rights&&safe(rights.image_url)?
   '<figure class="article-hero reader-hero"><img class="reader-photo" loading="eager" decoding="async" referrerpolicy="no-referrer" src="'+escape(safe(rights.image_url))+'" alt="'+escape(rights.alt_text)+'">'+
   '<figcaption class="reader-image-credit">'+
   (rights.image_kind==="representative"?escape(tx("representative"))+" · ":"")+
   '<a href="'+escape(safe(rights.credit_url))+'" rel="noopener noreferrer" target="_blank">'+escape(rights.credit)+'</a>'+
   (safe(rights.rights_url)?' · <a href="'+escape(safe(rights.rights_url))+'" rel="noopener noreferrer" target="_blank">'+escape(rights.image_license||tx("rights"))+'</a>':'')+
   ' · <span>cropped for layout</span>'+
   '</figcaption></figure>':"";

  // Government briefs contain only a short licensed source excerpt; avoid
  // repeating the excerpt and a full page of legal boilerplate as a fake article.
  const readableSummary=summary.trim()+(brief&&!/[.!?…]$/.test(summary.trim())?"…":"");
  const paragraphs=brief?"":String(body).split(/\n\s*\n/).filter(Boolean).map(p=>'<p>'+escape(p).replace(/\n/g," ")+'</p>').join("");
  const note=selected==="en"?"":'<p class="reader-translation-note">'+escape(tx("machine"))+'</p>';
  const sourceDateLabel=originalSourceDate?
   (selected==="ru"?"Источник":selected==="en"?"Original publication":""):"";
  out.innerHTML=
   '<p class="reader-meta">'+escape(article.category)+' <span aria-hidden="true">·</span> '+
   (sourceDateLabel?'<span>'+escape(sourceDateLabel)+': </span>':'')+
   '<time datetime="'+escape(actualDate)+'">'+escape(readDate)+'</time></p>'+
   '<h1>'+escape(title)+'</h1>'+
   photo+
   '<p class="reader-summary">'+escape(readableSummary)+'</p>'+
   (paragraphs?'<div class="read-news-body">'+paragraphs+'</div>':"")+
   '<div class="reader-citation"><p class="reader-citation-label">'+escape(tx("source"))+'</p>'+
   '<p>'+escape(article.source_name)+'</p>'+
   (original?'<a class="reader-link" href="'+escape(original)+'" rel="noopener noreferrer" target="_blank">'+escape(tx("original"))+' ↗</a>':'')+
   (brief?'<p class="reader-brief-label">'+escape(selected==="ru"?"Краткое изложение первоисточника":selected==="en"?"Short source-based brief":"Source-based brief")+'</p>':"")+
   note+
   '<p class="reader-back"><a class="reader-link" href="'+escape(back?.href||"/")+'">'+escape(tx("back"))+'</a></p></div>';
  trackArticleRead();
 }
 window.addEventListener("goodworld:language-changed",render);
 window.addEventListener("goodworld:translations-loaded",render);
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load,{once:true});else load();
})();
