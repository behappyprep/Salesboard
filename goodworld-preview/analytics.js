"use strict";
/* GoodWorld privacy-first GA4. No Google script, cookie, or analytics request before opt-in.
   Google Consent Mode v2, analytics only. No advertising or user identifiers sent. */
(function(){
 const ID="G-DRVQQFN3VD";
 const KEY="gw_analytics_consent_v1";
 const DENIED={analytics_storage:"denied",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied"};
 window.dataLayer=window.dataLayer||[];
 window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};
 window.gtag("consent","default",DENIED);
 let preference="unset";
 try{const saved=localStorage.getItem(KEY);if(saved==="accepted"||saved==="declined")preference=saved}catch(_){}
 let tagStarted=false;
 let banner=null;
 let settingsButton=null;
 function safePath(){
  // Auth confirmation links may contain one-time tokens. Never report query or fragment.
  return location.pathname||"/";
 }
 function safeLocation(virtualPath){
  return location.origin+(virtualPath||safePath());
 }
 function event(name,params){
  if(preference!=="accepted")return;
  if(!/^[a-z][a-z0-9_]{1,39}$/.test(name))return;
  const safe={};
  if(params&&typeof params==="object"){
   for(const key of ["content_type","content_id","method","feed_order","section","network","story_category"]){
    const val=params[key];
    if((typeof val==="string"||typeof val==="number")&&String(val).length<=100)safe[key]=val;
   }
  }
  window.gtag("event",name,safe);
 }
 function page(section,virtualPath){
  if(preference!=="accepted")return;
  const cleanName=String(section||"GoodWorld").replace(/[^- a-zA-Z0-9&]/g,"").slice(0,65);
  window.gtag("event","page_view",{
   page_title:cleanName==="GoodWorld"?"GoodWorld":cleanName+" | GoodWorld",
   page_location:safeLocation(virtualPath),
   page_path:virtualPath||safePath()
  });
 }
 function setupTag(){
  if(preference!=="accepted"||tagStarted)return;
  tagStarted=true;
  window.gtag("consent","update",{...DENIED,analytics_storage:"granted"});
  window.gtag("js",new Date());
  window.gtag("config",ID,{
   send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false
  });
  const script=document.createElement("script");
  script.async=true;
  script.src="https://www.googletagmanager.com/gtag/js?id="+encodeURIComponent(ID);
  document.head.appendChild(script);
  const isArticle=/^\/stories\/[a-z0-9-]+\.html$/.test(safePath());
  const isArchive=safePath()==="/stories/"||safePath()==="/stories/index.html";
  page(isArticle?"Story":isArchive?"Stories":"GoodWorld");
  if(isArticle)event("read_article",{content_type:"article",content_id:safePath().split("/").pop().replace(/\.html$/,"")});
 }
 function save(value){
  const old=preference;
  preference=value;
  try{localStorage.setItem(KEY,value)}catch(_){}
  if(value==="accepted")setupTag();
  else if(old==="accepted"){
   window.gtag("consent","update",DENIED);
   // Loading again is essential: an already loaded Google script cannot be unloaded.
   const names=["_ga","_ga_"+ID.replace(/[^A-Za-z0-9]/g,"_")];
   for(const name of names){
    for(const domain of ["",".goodworld.news"]){
     document.cookie=name+"=; Max-Age=0; path=/; SameSite=Lax"+(domain?"; domain="+domain:"");
    }
   }
   location.reload();
   return;
  }
  if(banner)banner.hidden=true;
  if(settingsButton)settingsButton.hidden=false;
 }
 function showBanner(){
  if(!banner)return;
  banner.hidden=false;
  if(settingsButton)settingsButton.hidden=true;
  banner.querySelector(".gw-consent-accept")?.focus();
 }
 function initUi(){
  const root=document.createElement("div");
  root.id="gw-privacy-controls";
  root.innerHTML=
   '<section class="gw-consent" role="region" aria-label="Analytics privacy choice" hidden>'+
   '<div class="gw-consent-copy"><strong>Good news, your choice.</strong>'+
   '<p>We use optional Google Analytics to understand which stories readers enjoy. No analytics is sent unless you agree. You can change your choice anytime. <a href="/privacy.html">Privacy details</a></p></div>'+
   '<div class="gw-consent-actions">'+
   '<button type="button" class="gw-consent-decline">Decline</button>'+
   '<button type="button" class="gw-consent-accept">Accept analytics</button>'+
   '</div></section>'+
   '<button type="button" class="gw-privacy-trigger" aria-label="Change analytics privacy settings" hidden>Privacy choices</button>';
  document.body.appendChild(root);
  banner=root.querySelector(".gw-consent");
  settingsButton=root.querySelector(".gw-privacy-trigger");
  root.querySelector(".gw-consent-decline").addEventListener("click",()=>save("declined"));
  root.querySelector(".gw-consent-accept").addEventListener("click",()=>save("accepted"));
  settingsButton.addEventListener("click",showBanner);
  if(preference==="unset")banner.hidden=false;
  else settingsButton.hidden=false;
  if(preference==="accepted")setupTag();
 }
 window.GWAnalytics=Object.freeze({
  enabled:()=>preference==="accepted",
  track:event,
  page,
  openPreferences:()=>showBanner()
 });
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initUi,{once:true});
 else initUi();
})();
