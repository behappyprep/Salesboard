"use strict";
/* GoodWorld phase 1. Real articles, Supabase-authenticated per-account likes,
   daily ranking (00:00 UTC). Trial/payments/rewards/submissions not enabled. */
const GW_URL="https://jdmpmrhyjitmjyjuhtds.supabase.co";
const GW_KEY="sb_publishable_Mi4xc0jwt_MFKhjKWZ1Vpw_bG6VPp3_";
const client=window.supabase?.createClient(GW_URL,GW_KEY);
const feed=document.getElementById("feed");
const page=document.getElementById("page");
const nav=[...document.querySelectorAll(".navitem")];
const tabs=[...document.querySelectorAll(".tab")];
const overlay=document.getElementById("menuOverlay");
const menuButton=document.getElementById("menuButton");
const modal=document.getElementById("modal");
let stories=[],currentTab="top",session=null,currentPage="feed",toastTimer=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const validUrl=u=>{try{const x=new URL(u);return x.protocol==="https:"?x.href:""}catch{return ""}};
function showToast(message){const t=document.getElementById("toast");t.textContent=message;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),3000)}
function closeMenu(){overlay.classList.add("hidden");menuButton.setAttribute("aria-expanded","false")}
function openMenu(){overlay.classList.remove("hidden");menuButton.setAttribute("aria-expanded","true")}
menuButton.addEventListener("click",openMenu);
document.getElementById("menuClose").addEventListener("click",closeMenu);
document.getElementById("menuScrim").addEventListener("click",closeMenu);
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeMenu();modal.classList.add("hidden")}});
document.getElementById("home").addEventListener("click",()=>showPage("feed"));
function renderFeed(){
 if(!stories.length){feed.innerHTML='<div class="emptyfeed"><span class="pill">GoodWorld</span><h1>Good news is on its way.</h1><p>We publish verified positive stories with links to original sources.</p><button class="primary" id="refresh">Refresh news ↻</button></div>';feed.querySelector("#refresh").onclick=loadStories;return}
 feed.innerHTML=stories.map((s,i)=>{
 const image=validUrl(s.image_url);
 const liked=!!s.liked_by_me;
 const amount=currentTab==="top"?s.likes_today:s.likes_total;
 const link=validUrl(s.source_url);
 return '<article class="story" id="story-'+esc(s.slug)+'" data-id="'+esc(s.id)+'">'+
 '<div class="photo" style="'+(image?'background-image:url(&quot;'+esc(image)+'&quot;)':'')+'"></div><div class="shade"></div>'+
 '<div class="storycontent"><span class="pill">'+esc(s.category)+'</span><h2 class="headline">'+esc(s.title)+'</h2><p class="desc">'+esc(s.summary)+'</p>'+
 '<div class="meta"><span>✳ '+esc(s.source_name)+'</span><span>·</span><a class="source" href="'+esc(link||"#")+'" target="_blank" rel="noopener noreferrer">Original source ↗</a></div></div>'+
 '<div class="storyactions"><button aria-label="'+(liked?"Unlike":"Like")+' story" class="action '+(liked?"liked":"")+'" data-action="like" data-id="'+esc(s.id)+'"><span class="symbol">'+(liked?"♥":"♡")+'</span><span>'+(Number(amount)||0)+'</span></button>'+
 '<button aria-label="Repost story" class="action" data-action="share" data-id="'+esc(s.id)+'"><span class="symbol">↗</span><span>Repost</span></button></div>'+
 (i===0?'<div class="swipetip">↑ SWIPE FOR MORE GOOD NEWS</div>':"")+'</article>'
 }).join("");
}
async function loadStories(preserveId){
 if(!client){showToast("Unable to connect to news service");return}
 const {data,error}=await client.rpc("get_goodworld_feed",{p_order:currentTab});
 if(error){console.warn("Feed unavailable",error.message);showToast("News temporarily unavailable");return}
 stories=data||[];
 renderFeed();
 if(preserveId){const node=[...feed.querySelectorAll(".story")].find(x=>x.dataset.id===preserveId);node?.scrollIntoView({block:"start",behavior:"instant"})}
}
async function refreshSession(){if(!client)return;const {data}=await client.auth.getSession();session=data?.session??null}
if(client){
 client.auth.onAuthStateChange((_event,next)=>{session=next;if(_event==="SIGNED_IN"||_event==="SIGNED_OUT"){loadStories();if(currentPage==="profile")showPage("profile")}});
 refreshSession().then(()=>loadStories());
}else{
 feed.innerHTML='<div class="emptyfeed"><h1>GoodWorld</h1><p>News service could not be loaded. Please refresh this page.</p></div>';
}
tabs.forEach(t=>t.addEventListener("click",()=>{currentTab=t.dataset.tab;tabs.forEach(x=>x.classList.toggle("selected",x===t));feed.scrollTop=0;loadStories()}));
function showModal(title,body,buttonLabel="Got it"){
 modal.classList.remove("hidden");
 modal.innerHTML='<div class="dialog"><button class="close" aria-label="Close dialog" id="closeModal">×</button><span class="pill">GoodWorld</span><h2>'+esc(title)+'</h2><p>'+esc(body)+'</p><button class="primary" id="dismissModal">'+esc(buttonLabel)+'</button></div>';
 modal.querySelector("#closeModal").onclick=()=>modal.classList.add("hidden");
 modal.querySelector("#dismissModal").onclick=()=>modal.classList.add("hidden");
}
modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.add("hidden")});
function authPrompt(){showPage("profile");showToast("Sign in to like stories")}
async function likeStory(id){
 if(!session?.user){authPrompt();return}
 const story=stories.find(s=>s.id===id);if(!story)return;
 const liked=!!story.liked_by_me;
 // Optimistic state while database updates.
 story.liked_by_me=!liked;
 story.likes_total=Math.max(0,Number(story.likes_total)+(liked?-1:1));
 story.likes_today=Math.max(0,Number(story.likes_today)+(liked?-1:1));
 renderFeed();
 const resp=liked
  ? await client.from("goodworld_likes").delete().eq("story_id",id).eq("user_id",session.user.id)
  : await client.from("goodworld_likes").insert({story_id:id,user_id:session.user.id});
 if(resp.error){showToast("Could not save like");await loadStories(id)}
 else await loadStories(id);
}
async function shareStory(id){
 const s=stories.find(s=>s.id===id);if(!s)return;
 const url=location.origin+location.pathname+"#story-"+encodeURIComponent(s.slug);
 try{if(navigator.share)await navigator.share({title:s.title,text:"GoodWorld · "+s.title,url});
 else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);showToast("Story link copied")}
 else showModal("Share this story",url,"Close");
 }catch(e){if(e.name!=="AbortError")showToast("Could not open share menu")}
}
feed.addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(!b)return;if(b.dataset.action==="like")likeStory(b.dataset.id);if(b.dataset.action==="share")shareStory(b.dataset.id)});
function showPage(which){
 currentPage=which;nav.forEach(n=>n.classList.toggle("active",n.dataset.page===which));
 document.getElementById("switcher").classList.toggle("hidden",which!=="feed");
 page.classList.toggle("hidden",which==="feed");feed.classList.toggle("hidden",which!=="feed");
 if(which==="feed"){page.innerHTML="";return}
 const pages={
  submit:'<h1>Found some good news?</h1><p class="lead">Help us find stories worth sharing.</p><div class="panel"><p>Submit a source link to our editorial team. This feature will open after editorial review tools are ready.</p><button class="secondary" id="backFeed">Return to news</button></div><p class="subtle">No cash rewards are active.</p>',
  rewards:'<h1>Spread the good.</h1><p class="lead">Invite 3 paying friends and earn 3 free months.</p><div class="steps"><div class="step">1</div><div class="step">2</div><div class="step">3</div></div><div class="panel"><p>Referrals will activate when paid subscriptions are ready. No referral links are being tracked yet.</p><button class="secondary" id="backFeed">Return to news</button></div>',
  profile:session?.user
  ? '<h1>Your GoodWorld</h1><p class="lead">'+esc(session.user.email)+'</p><div class="panel"><h2>You are signed in.</h2><p>Your likes are linked to this account across your devices.</p><button class="secondary" id="signOut">Sign out</button></div><div class="panel"><p>7-day trial and $5/month membership are not yet accepting payments.</p></div>'
  : '<h1>Welcome to GoodWorld.</h1><p class="lead">Sign in to support your favorite positive stories.</p><div class="panel"><form id="authForm"><label for="email">Email</label><input class="input" type="email" id="email" autocomplete="email" required placeholder="Your email"/><label for="password">Password</label><input class="input" type="password" id="password" autocomplete="current-password" minlength="8" required placeholder="At least 8 characters"/><button class="primary" id="signIn" type="submit">Sign in</button><button class="secondary" type="button" id="signUp">Create account</button></form><p class="subtle" id="authStatus">Email confirmation may be required for new accounts. Billing is not active.</p></div>'
 };
 page.innerHTML=pages[which]??"";
 page.querySelector("#backFeed")?.addEventListener("click",()=>showPage("feed"));
 page.querySelector("#signOut")?.addEventListener("click",async()=>{await client.auth.signOut();showPage("feed");showToast("Signed out")});
 if(which==="profile"&&!session?.user){
 const form=page.querySelector("#authForm");
 const status=page.querySelector("#authStatus");
 let busy=false;
 async function submitAuth(create){
  if(busy||!form.reportValidity())return;
  busy=true;const btns=[...form.querySelectorAll("button")];btns.forEach(b=>b.disabled=true);
  const email=form.querySelector("#email").value.trim();const password=form.querySelector("#password").value;
  const {data,error}=create?await client.auth.signUp({email,password}):await client.auth.signInWithPassword({email,password});
  busy=false;btns.forEach(b=>b.disabled=false);
  if(error){status.textContent=error.message;return}
  if(create&&!data?.session){status.textContent="Check your email to confirm your account, then return here to sign in."}
  else{session=data?.session??session;showPage("feed");showToast(create?"Account created":"Welcome back");loadStories()}
 }
 form.addEventListener("submit",e=>{e.preventDefault();submitAuth(false)});
 form.querySelector("#signUp").addEventListener("click",()=>submitAuth(true));
 }
}
nav.forEach(n=>n.addEventListener("click",()=>{closeMenu();showPage(n.dataset.page)}));
document.getElementById("join").addEventListener("click",()=>{closeMenu();showModal("7 days free. Then $5/month.","Subscriptions are not live yet. News is open to browse while we complete payments and membership access.")});
const hash=decodeURIComponent(location.hash.slice(1));if(hash.startsWith("story-")){const originalLoad=loadStories;setTimeout(()=>{const slug=hash.slice(6);document.getElementById("story-"+slug)?.scrollIntoView({block:"start"})},1900)}
