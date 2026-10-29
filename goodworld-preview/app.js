"use strict";
/* GoodWorld phase 1. Real articles, Supabase-authenticated per-account likes,
   daily ranking (00:00 UTC). Trial/payments/rewards/submissions not enabled. */
const GW_URL="https://jdmpmrhyjitmjyjuhtds.supabase.co";
// During DNS migration, auth links stay on the host where registration starts. Once the custom domain is live, root is canonical.
const GW_SITE=(location.hostname==="goodworld.news"||location.hostname==="www.goodworld.news")?"https://goodworld.news":"https://goodworld-app.onrender.com";
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
const authParams=new URLSearchParams(location.search);
const callbackError=new URLSearchParams(location.hash.replace(/^#/,"")).get("error_description");
let recoveryMode=authParams.has("gw_reset") || /(?:^|[&#])type=recovery(?:&|$)/.test(location.hash);
const confirmationReturn=authParams.has("gw_confirm");
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
 (image?'<img class="photo" src="'+esc(image)+'" alt="" loading="'+(i===0?'eager':'lazy')+'" decoding="async"/>':'<div class="photo"></div>')+'<div class="shade"></div>'+
 '<div class="storycontent"><span class="pill">'+esc(s.category)+'</span><h2 class="headline">'+esc(s.title)+'</h2><p class="desc">'+esc(s.summary)+'</p>'+
 '<div class="meta"><span>✳ '+esc(s.source_name)+'</span><span>·</span><a class="source" href="'+esc(link||"#")+'" target="_blank" rel="noopener noreferrer">Read source ↗</a>'+(image?'<span class="photo-note">Illustrative photo · Unsplash</span>':'')+'</div></div>'+
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
 client.auth.onAuthStateChange((_event,next)=>{
  session=next;
  if(_event==="PASSWORD_RECOVERY"){recoveryMode=true;setTimeout(()=>showPage("reset-password"),0);return}
  if(_event==="SIGNED_IN" && recoveryMode){setTimeout(()=>showPage("reset-password"),0);return}
  if(_event==="SIGNED_IN"||_event==="SIGNED_OUT"){
   loadStories();
   if(currentPage==="profile")showPage("profile");
  }
 });
 refreshSession().then(()=>{
  loadStories();
  if(callbackError){
   recoveryMode=false;
   history.replaceState(null,"",location.pathname);
   showPage("profile");
   showToast("This email link has expired or is invalid. Please request a new link.");
  }else if(recoveryMode){showPage("reset-password")}
  else if(confirmationReturn){
   history.replaceState(null,"",location.pathname);
   if(session?.user)showToast("Email confirmed. Welcome to GoodWorld!");
   else {showPage("profile");showToast("Email confirmation complete. Please sign in.")}
  }
 });
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
 if(which==="reset-password"){
  page.innerHTML='<h1>Set a new password.</h1><p class="lead">Choose a new password for your GoodWorld account.</p><div class="panel"><form id="resetPasswordForm"><label for="newPassword">New password</label><input class="input" type="password" id="newPassword" autocomplete="new-password" minlength="10" required placeholder="At least 10 characters"/><label for="confirmPassword">Confirm new password</label><input class="input" type="password" id="confirmPassword" autocomplete="new-password" minlength="10" required placeholder="Repeat your password"/><button class="primary" type="submit">Save new password</button></form><p class="subtle" id="resetStatus" role="status">If you used a reset link from email, you can now choose a new password.</p><button class="secondary" id="backToSignIn" type="button">Back to sign in</button></div>';
  page.querySelector("#backToSignIn").onclick=()=>{recoveryMode=false;history.replaceState(null,"",location.pathname);showPage("profile")};
  page.querySelector("#resetPasswordForm").addEventListener("submit",async e=>{
   e.preventDefault();
   const form=e.currentTarget,status=page.querySelector("#resetStatus");
   if(!form.reportValidity())return;
   const p=form.querySelector("#newPassword").value;
   if(p!==form.querySelector("#confirmPassword").value){status.textContent="Passwords do not match.";return}
   const {data:{session:active}}=await client.auth.getSession();
   if(!active){status.textContent="Reset link has expired or is not valid. Request a new link from Profile.";return}
   const button=form.querySelector('button[type="submit"]');button.disabled=true;
   status.textContent="Updating password…";
   const {error}=await client.auth.updateUser({password:p});
   button.disabled=false;
   if(error){status.textContent=error.message;return}
   recoveryMode=false;
   history.replaceState(null,"",location.pathname);
   showPage("profile");
   showToast("Password successfully updated");
  });
  return;
 }
 const pages={
  submit:'<h1>Found some good news?</h1><p class="lead">Help us find stories worth sharing.</p><div class="panel"><p>Submit a source link to our editorial team. This feature will open after editorial review tools are ready.</p><button class="secondary" id="backFeed">Return to news</button></div><p class="subtle">No cash rewards are active.</p>',
  rewards:'<h1>Spread the good.</h1><p class="lead">Invite 3 paying friends and earn 3 free months.</p><div class="steps"><div class="step">1</div><div class="step">2</div><div class="step">3</div></div><div class="panel"><p>Referrals will activate when paid subscriptions are ready. No referral links are being tracked yet.</p><button class="secondary" id="backFeed">Return to news</button></div>',
  profile:session?.user
  ? '<h1>Your GoodWorld</h1><p class="lead">'+esc(session.user.email)+'</p><div class="panel"><h2>You are signed in.</h2><p>Your likes are linked to this account across your devices.</p><button class="secondary" id="signOut">Sign out</button></div><div class="panel"><p>7-day trial and $5/month membership are not yet accepting payments.</p></div>'
  : '<h1>Welcome to GoodWorld.</h1><p class="lead">Sign in to support your favorite positive stories.</p><div class="panel"><form id="authForm"><label for="email">Email</label><input class="input" type="email" id="email" autocomplete="email" required placeholder="Your email"/><label for="password">Password</label><input class="input" type="password" id="password" autocomplete="current-password" minlength="8" required placeholder="At least 8 characters"/><button class="primary" id="signIn" type="submit">Sign in</button><button class="secondary" type="button" id="signUp">Create account</button><button class="password-link" type="button" id="forgotPassword">Forgot password?</button><button class="password-link" type="button" id="pasteRecoveryLink">Reset link not opening? Paste it here</button><div class="recovery-paste hidden" id="recoveryPaste"><label for="recoveryEmailLink">Paste the entire reset link from your email</label><textarea class="input" id="recoveryEmailLink" rows="3" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="https://…/auth/v1/verify?token=…&type=recovery"></textarea><button class="secondary" type="button" id="verifyRecoveryLink">Use this reset link</button><p class="subtle" id="pasteRecoveryStatus" role="status">Keep your reset link private. Never send it in a chat.</p></div></form><p class="subtle" id="authStatus">Email confirmation may be required for new accounts. Billing is not active.</p></div>'
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
  const {data,error}=create?await client.auth.signUp({email,password,options:{emailRedirectTo:GW_SITE+"/?gw_confirm=1"}}):await client.auth.signInWithPassword({email,password});
  busy=false;btns.forEach(b=>b.disabled=false);
  if(error){status.textContent=error.message;return}
  if(create&&!data?.session){status.textContent="Check your email to confirm your account, then return here to sign in."}
  else{session=data?.session??session;showPage("feed");showToast(create?"Account created":"Welcome back");loadStories()}
 }
 form.addEventListener("submit",e=>{e.preventDefault();submitAuth(false)});
 form.querySelector("#signUp").addEventListener("click",()=>submitAuth(true));
 form.querySelector("#pasteRecoveryLink").addEventListener("click",()=>{
  form.querySelector("#recoveryPaste").classList.toggle("hidden");
 });
 form.querySelector("#verifyRecoveryLink").addEventListener("click",async()=>{
  const status=form.querySelector("#pasteRecoveryStatus");
  const pasted=form.querySelector("#recoveryEmailLink").value.trim();
  let tokenHash;
  try{
   const link=new URL(pasted);
   const expected=new URL(GW_URL);
   if(link.origin!==expected.origin || link.pathname!=="/auth/v1/verify" || link.searchParams.get("type")!=="recovery"){
    status.textContent="This does not look like a GoodWorld password reset link.";return;
   }
   tokenHash=link.searchParams.get("token")||link.searchParams.get("token_hash");
   if(!tokenHash || tokenHash.length>4096 || !/^[A-Za-z0-9_-]+$/.test(tokenHash)){
    status.textContent="The link does not contain a valid reset token. Request a new email.";return;
   }
  }catch{status.textContent="Paste the full link beginning with https:// from your password reset email.";return}
  const button=form.querySelector("#verifyRecoveryLink");
  button.disabled=true;status.textContent="Checking secure reset link…";
  recoveryMode=true;
  const {data,error}=await client.auth.verifyOtp({token_hash:tokenHash,type:"recovery"});
  button.disabled=false;
  form.querySelector("#recoveryEmailLink").value="";
  if(error){
   recoveryMode=false;
   status.textContent="Link could not be verified. It may already have been used. Request a new email, then copy its link without opening it.";
   return;
  }
  session=data?.session||session;
  history.replaceState(null,"",location.pathname+"?gw_reset=1");
  showPage("reset-password");
 });
 form.querySelector("#forgotPassword").addEventListener("click",async()=>{
  const emailInput=form.querySelector("#email");
  const email=emailInput.value.trim();
  if(!email || !emailInput.checkValidity()){
    status.textContent="Enter your account email above, then tap Forgot password?.";
    emailInput.focus();return;
  }
  const btn=form.querySelector("#forgotPassword");
  btn.disabled=true;status.textContent="Sending password reset email…";
  const {error}=await client.auth.resetPasswordForEmail(email,{
    redirectTo:GW_SITE+"/?gw_reset=1"
  });
  btn.disabled=false;
  const limited=!!error&&(error.status===429||/rate limit|too many requests/i.test(error.message||""));
  status.classList.toggle("limit-warning",limited);
  if(limited){
   status.textContent="GoodWorld email delivery is temporarily limited. Please do not retry repeatedly. Try later or paste a new, unused reset link from your inbox.";
  }else if(error){
   status.textContent="Could not send reset email: "+error.message;
  }else{
   status.textContent="If this email belongs to a GoodWorld account, a password reset link is on its way. Check Inbox and Spam. Copy the link without opening it if it does not redirect correctly.";
  }
 });
 }
}
nav.forEach(n=>n.addEventListener("click",()=>{closeMenu();showPage(n.dataset.page)}));
document.getElementById("join").addEventListener("click",()=>{closeMenu();showModal("7 days free. Then $5/month.","Subscriptions are not live yet. News is open to browse while we complete payments and membership access.")});
const hash=decodeURIComponent(location.hash.slice(1));if(hash.startsWith("story-")){const originalLoad=loadStories;setTimeout(()=>{const slug=hash.slice(6);document.getElementById("story-"+slug)?.scrollIntoView({block:"start"})},1900)}
