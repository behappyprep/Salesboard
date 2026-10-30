"use strict";
/* Free positive-news feed, authenticated likes and editorial review.
   No paywall. Crypto support needs an owner-approved public wallet. */
const GW_URL="https://jdmpmrhyjitmjyjuhtds.supabase.co";
// During DNS migration, auth links stay on the host where registration starts. After Render verification, www.goodworld.news is canonical.
const GW_SITE=(location.hostname==="goodworld.news"||location.hostname==="www.goodworld.news")?"https://www.goodworld.news":"https://goodworld-app.onrender.com";
const GW_KEY="sb_publishable_Mi4xc0jwt_MFKhjKWZ1Vpw_bG6VPp3_";
// Only substantial, manually approved stories receive search-indexable URLs.
// Automatic short RSS briefs remain feed-only until an editor rewrites and approves them.
function gwEditorialUrl(story){
 if(!story||typeof story.slug!=="string"||!/^[-a-z0-9]{5,120}$/.test(story.slug))return "";
 if(story.slug.startsWith("auto-")||story.slug.startsWith("gov-")||String(story.body||"").trim().length<200)return "";
 if(String(story.title||"").trim().length<15||String(story.summary||"").trim().length<30)return "";
 if(!String(story.source_url||"").startsWith("https://"))return "";
 return GW_SITE+"/stories/"+encodeURIComponent(story.slug)+".html";
}
// Only public receiving addresses approved by the GoodWorld founder.
// Never put private keys, recovery phrases or exchange login credentials in frontend code.
const GW_WALLETS=Object.freeze({
 evm:"0xf0DE078f2bB149a891e479E5e6e2A951F3B15E38",
 bitcoin:"bc1qtswv69s6fqjcykgaj4jdyzz6nx4063c999lxg2",
 solana:"DVCbn4ziBFb98ECvCXiouRAeJqzxx6nrY5MZVXBs7tTc"
});
const GW_DONATION_OPTIONS=Object.freeze([
 {symbol:"BTC",network:"Bitcoin",wallet:"bitcoin"},
 {symbol:"SOL",network:"Solana",wallet:"solana"},
 {symbol:"USDC",network:"Solana (SPL)",wallet:"solana"},
 {symbol:"ETH",network:"Ethereum (Mainnet)",wallet:"evm"},
 {symbol:"USDT",network:"Ethereum (ERC-20)",wallet:"evm"},
 {symbol:"USDC",network:"Ethereum (ERC-20)",wallet:"evm"},
 {symbol:"ETH",network:"Base",wallet:"evm"},
 {symbol:"USDC",network:"Base",wallet:"evm"},
 {symbol:"BNB",network:"BNB Smart Chain (native BNB)",wallet:"evm"},
 {symbol:"USDT",network:"BNB Smart Chain (BEP-20)",wallet:"evm"},
 {symbol:"ETH",network:"Arbitrum One",wallet:"evm"}
]);
const client=window.supabase?.createClient(GW_URL,GW_KEY);
const feed=document.getElementById("feed");
const page=document.getElementById("page");
const nav=[...document.querySelectorAll(".navitem")];
const tabs=[...document.querySelectorAll(".tab")];
const overlay=document.getElementById("menuOverlay");
const menuButton=document.getElementById("menuButton");
const modal=document.getElementById("modal");
let stories=[],currentTab="new",session=null,currentPage="feed",toastTimer=null;
const authParams=new URLSearchParams(location.search);
const callbackError=new URLSearchParams(location.hash.replace(/^#/,"")).get("error_description");
let recoveryMode=authParams.has("gw_reset") || /(?:^|[&#])type=recovery(?:&|$)/.test(location.hash);
const confirmationReturn=authParams.has("gw_confirm");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const validUrl=u=>{try{const x=new URL(u);return x.protocol==="https:"?x.href:""}catch{return ""}};
function goodworldAge(value){
 const elapsed=Date.now()-Date.parse(value);
 if(!Number.isFinite(elapsed)||elapsed<0)return "";
 const minutes=Math.floor(elapsed/60000);
 if(minutes<1)return "Just now";
 if(minutes<60)return minutes+"m ago";
 const hours=Math.floor(minutes/60);
 if(hours<24)return hours+"h ago";
 return Math.floor(hours/24)+"d ago";
}
function showToast(message){const t=document.getElementById("toast");t.textContent=message;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),3000)}
function closeMenu(){overlay.classList.add("hidden");menuButton.setAttribute("aria-expanded","false")}
function openMenu(){overlay.classList.remove("hidden");menuButton.setAttribute("aria-expanded","true")}
menuButton.addEventListener("click",openMenu);
document.getElementById("menuClose").addEventListener("click",closeMenu);
document.getElementById("menuScrim").addEventListener("click",closeMenu);
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeMenu();modal.classList.add("hidden")}});
document.getElementById("home").addEventListener("click",()=>showPage("feed"));
// A story counts as read after it stays mostly visible. Consent is required.
const gwViewedStories=new Set();
let gwStoryObserver=null;
const gwStoryTimers=new Map();
function gwObserveStoryViews(){
 if(gwStoryObserver)gwStoryObserver.disconnect();
 for(const timer of gwStoryTimers.values())clearTimeout(timer);
 gwStoryTimers.clear();
 if(!("IntersectionObserver" in window))return;
 gwStoryObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){
   const id=entry.target.dataset.id;
   if(!id||gwViewedStories.has(id))continue;
   const previous=gwStoryTimers.get(id);
   if(previous){clearTimeout(previous);gwStoryTimers.delete(id)}
   if(entry.isIntersecting&&entry.intersectionRatio>=.65){
    const timer=setTimeout(()=>{
     gwStoryTimers.delete(id);
     if(document.hidden||currentPage!=="feed"||!window.GWAnalytics?.enabled())return;
     const story=stories.find(x=>x.id===id);
     if(!story)return;
     gwViewedStories.add(id);
     window.GWAnalytics.track("view_story",{
      content_type:"feed_story",content_id:story.slug,
      feed_order:currentTab,story_category:story.category
     });
    },1200);
    gwStoryTimers.set(id,timer);
   }
  }
 },{root:feed,threshold:[0,.65,1]});
 for(const item of feed.querySelectorAll(".story"))gwStoryObserver.observe(item);
}
window.addEventListener("gw:analytics-ready",gwObserveStoryViews);
function renderFeed(){
 if(!stories.length){feed.innerHTML='<div class="emptyfeed"><span class="pill">GoodWorld</span><h1>Good news is on its way.</h1><p>We are reviewing our news sources and publishing rights. Only independently reported or properly licensed positive stories will return to this feed.</p><button class="primary" id="refresh">Refresh news ↻</button></div>';feed.querySelector("#refresh").onclick=loadStories;return}
 feed.innerHTML=stories.map((s,i)=>{
 const image=validUrl(s.image_url);
 const liked=!!s.liked_by_me;
 const amount=currentTab==="top"?s.likes_today:s.likes_total;
 const link=validUrl(s.source_url);
 const editorialUrl=gwEditorialUrl(s);
 return '<article class="story" id="story-'+esc(s.slug)+'" data-id="'+esc(s.id)+'">'+
 (image?'<img class="photo" src="'+esc(image)+'" alt="" loading="'+(i===0?'eager':'lazy')+'" decoding="async"/>':'<div class="photo story-fallback" aria-hidden="true"><span class="fallback-star">✳</span><span class="fallback-caption">GOOD THINGS ARE HAPPENING</span></div>')+'<div class="shade"></div>'+
 '<div class="storycontent"><span class="pill">'+esc(s.category)+'</span><h2 class="headline">'+(editorialUrl?'<a class="story-permalink" href="'+esc(editorialUrl)+'">'+esc(s.title)+'</a>':esc(s.title))+'</h2><p class="desc">'+esc(s.summary)+'</p>'+
 '<div class="meta"><span>✳ '+esc(s.source_name)+'</span><span>·</span><span class="story-age">'+esc(goodworldAge(s.published_at))+'</span><span>·</span>'+(editorialUrl?'<a class="source" href="'+esc(editorialUrl)+'">Our brief ↗</a><span>·</span>':'')+'<a class="source" href="'+esc(link||"#")+'" target="_blank" rel="noopener noreferrer">Source ↗</a>'+(image?'<span class="photo-note">Illustrative photo · Unsplash</span>':'')+(String(s.slug).startsWith("auto-")?'<span class="auto-brief-label">Automatically curated</span>':String(s.slug).startsWith("gov-")?'<span class="auto-brief-label">Official source · licensed brief</span>':'')+'</div></div>'+
 '<div class="storyactions"><button aria-label="'+(liked?"Unlike":"Like")+' story" class="action '+(liked?"liked":"")+'" data-action="like" data-id="'+esc(s.id)+'"><span class="symbol">'+(liked?"♥":"♡")+'</span><span>'+(Number(amount)||0)+'</span></button>'+
 '<button aria-label="Repost story" class="action" data-action="share" data-id="'+esc(s.id)+'"><span class="symbol">↗</span><span>Repost</span></button></div>'+
 (i===0?'<div class="swipetip">↑ SWIPE FOR MORE GOOD NEWS</div>':"")+'</article>'
 }).join("");
 gwObserveStoryViews();
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
async function quietlyRefreshFeed(){
 if(document.hidden||currentPage!=="feed"||feed.scrollTop>90||!client)return;
 const previousTop=stories[0]?.id;
 const {data,error}=await client.rpc("get_goodworld_feed",{p_order:currentTab});
 if(error||!data)return;
 const same=stories.length===data.length&&data.every((x,i)=>x.id===stories[i].id&&x.likes_total===stories[i].likes_total&&x.likes_today===stories[i].likes_today&&x.liked_by_me===stories[i].liked_by_me);
 if(same)return;
 stories=data;renderFeed();
 if(previousTop&&stories[0]?.id!==previousTop)showToast("Fresh good news just arrived ✳");
}
setInterval(quietlyRefreshFeed,10*60*1000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)quietlyRefreshFeed()});
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
 else{
  window.GWAnalytics?.track(liked?"unlike_story":"like_story",{
   content_type:"article",content_id:story.slug,story_category:story.category
  });
  await loadStories(id);
 }
}
async function shareStory(id){
 const s=stories.find(s=>s.id===id);if(!s)return;
 const url=gwEditorialUrl(s)||location.origin+location.pathname+"#story-"+encodeURIComponent(s.slug);
 try{
  let method="dialog";
  if(navigator.share){await navigator.share({title:s.title,text:"GoodWorld · "+s.title,url});method="native"}
  else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);showToast("Story link copied");method="clipboard"}
  else showModal("Share this story",url,"Close");
  window.GWAnalytics?.track("share",{method,content_type:"article",content_id:s.slug});
 }catch(e){if(e.name!=="AbortError")showToast("Could not open share menu")}
}
feed.addEventListener("click",e=>{
 const articleLink=e.target.closest(".story-permalink");
 if(articleLink){
  const item=articleLink.closest(".story");
  const story=stories.find(s=>s.id===item?.dataset.id);
  if(story)window.GWAnalytics?.track("select_content",{content_type:"article",content_id:story.slug});
 }
 const b=e.target.closest("[data-action]");if(!b)return;
 if(b.dataset.action==="like")likeStory(b.dataset.id);
 if(b.dataset.action==="share")shareStory(b.dataset.id);
});
function showPage(which){
 currentPage=which;
 window.GWAnalytics?.page(which==="feed"?"GoodWorld":which.charAt(0).toUpperCase()+which.slice(1),which==="feed"?"/":"/#"+which);
 if(which==="donate")window.GWAnalytics?.track("donate_open",{section:"donate"});nav.forEach(n=>n.classList.toggle("active",n.dataset.page===which));
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
  donate:'<h1>Support GoodWorld.</h1><p class="lead">Good news should be free for everyone.</p><div class="panel" id="donationPanel"></div><p class="subtle">Contributions are voluntary and do not grant special access. They are not tax-deductible charitable donations. Crypto transfers are generally irreversible.</p>',
  profile:session?.user
  ? '<h1>Your GoodWorld</h1><p class="lead">'+esc(session.user.email)+'</p><div class="panel"><h2>You are signed in.</h2><p>Your likes are linked to this account across your devices.</p><button class="secondary" id="signOut">Sign out</button></div><div class="panel"><p>GoodWorld is free for everyone. Thanks for being part of it.</p></div>'
  : '<h1>Welcome to GoodWorld.</h1><p class="lead">Sign in to support your favorite positive stories.</p><div class="panel"><form id="authForm"><label for="email">Email</label><input class="input" type="email" id="email" autocomplete="email" required placeholder="Your email"/><label for="password">Password</label><input class="input" type="password" id="password" autocomplete="current-password" minlength="8" required placeholder="At least 8 characters"/><button class="primary" id="signIn" type="submit">Sign in</button><button class="secondary" type="button" id="signUp">Create account</button><button class="password-link" type="button" id="forgotPassword">Forgot password?</button><button class="password-link" type="button" id="pasteRecoveryLink">Reset link not opening? Paste it here</button><div class="recovery-paste hidden" id="recoveryPaste"><label for="recoveryEmailLink">Paste the entire reset link from your email</label><textarea class="input" id="recoveryEmailLink" rows="3" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="https://…/auth/v1/verify?token=…&type=recovery"></textarea><button class="secondary" type="button" id="verifyRecoveryLink">Use this reset link</button><p class="subtle" id="pasteRecoveryStatus" role="status">Keep your reset link private. Never send it in a chat.</p></div></form><p class="subtle" id="authStatus">GoodWorld is free. An account is only needed to like stories. Email confirmation may be required.</p></div>'
 };
 page.innerHTML=pages[which]??"";
 page.querySelector("#backFeed")?.addEventListener("click",()=>showPage("feed"));
 if(which==="donate"){
  const donationPanel=page.querySelector("#donationPanel");
  donationPanel.innerHTML='<h2>Choose a coin and network</h2>'+
   '<p>Donations go directly to GoodWorld wallets. Choose the exact asset and network your sending wallet supports.</p>'+
   '<label for="donationChoice">Coin / blockchain network</label>'+
   '<select class="input" id="donationChoice" aria-label="Coin and blockchain network"></select>'+
   '<p class="donation-warning" id="donationNetworkNote" role="status"></p>'+
   '<div class="donation-qr" id="donationQr" aria-label="Wallet address QR code"></div>'+
   '<label for="donationAddress">Public receiving address</label>'+
   '<textarea id="donationAddress" class="input wallet-address" rows="2" readonly aria-label="Donation receiving address"></textarea>'+
   '<button class="primary" type="button" id="copyDonationAddress">Copy wallet address</button>'+
   '<p class="subtle">Network fees may apply. Verify the destination and network in your wallet before sending. Transfers are usually irreversible. No login or wallet connection is required.</p>';
  const select=donationPanel.querySelector("#donationChoice");
  const addressInput=donationPanel.querySelector("#donationAddress");
  const warning=donationPanel.querySelector("#donationNetworkNote");
  const qrBox=donationPanel.querySelector("#donationQr");
  for(const [i,item] of GW_DONATION_OPTIONS.entries()){
   const opt=document.createElement("option");
   opt.value=String(i);
   opt.textContent=item.symbol+" · "+item.network;
   select.appendChild(opt);
  }
  function renderDonationChoice(){
   const item=GW_DONATION_OPTIONS[Number(select.value)]||GW_DONATION_OPTIONS[0];
   const address=GW_WALLETS[item.wallet];
   addressInput.value=address;
   warning.textContent="Send ONLY "+item.symbol+" on "+item.network+". Coins on an incompatible network or unsupported tokens can be lost.";
   qrBox.textContent="";
   if(typeof window.qrcode==="function"){
    try{
     const qr=window.qrcode(0,"M");
     qr.addData(address);
     qr.make();
     const img=document.createElement("img");
     img.src=qr.createDataURL(5,4);
     img.alt="Scan to copy the "+item.network+" receiving address";
     img.width=210;img.height=210;
     qrBox.appendChild(img);
    }catch(error){qrBox.textContent="QR code unavailable. Copy the verified address below."}
   }else{qrBox.textContent="QR code unavailable. Copy the address below."}
  }
  select.addEventListener("change",()=>{
   renderDonationChoice();
   const item=GW_DONATION_OPTIONS[Number(select.value)]||GW_DONATION_OPTIONS[0];
   window.GWAnalytics?.track("donation_network_selected",{network:item.network});
  });
  donationPanel.querySelector("#copyDonationAddress").addEventListener("click",async()=>{
   const item=GW_DONATION_OPTIONS[Number(select.value)]||GW_DONATION_OPTIONS[0];
   const address=GW_WALLETS[item.wallet];
   try{
    if(!navigator.clipboard?.writeText)throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(address);
    window.GWAnalytics?.track("donation_address_copied",{network:item.network});
    showToast(item.network+" address copied");
   }catch{
    addressInput.focus();addressInput.select();
    showToast("Select and copy the address");
   }
  });
  renderDonationChoice();
 }
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
document.getElementById("join").addEventListener("click",()=>{closeMenu();showPage("donate")});
const hash=decodeURIComponent(location.hash.slice(1));if(hash.startsWith("story-")){const originalLoad=loadStories;setTimeout(()=>{const slug=hash.slice(6);document.getElementById("story-"+slug)?.scrollIntoView({block:"start"})},1900)}
