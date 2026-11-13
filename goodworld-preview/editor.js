"use strict";
// The editor can remove a published story from the public feed.
// Discovery, fact checking, rights checks and publication are automated upstream.
(()=>{
 const client=window.gwSupabase;
 const menu=document.getElementById("editorNav");
 const panel=document.getElementById("page");
 if(!client||!menu||!panel)return;
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 let editor=false,offset=0,busy=false;
 const pageSize=50;
 async function refreshAccess(){
  const {data:{session}}=await client.auth.getSession();
  if(!session){editor=false;menu.classList.add("hidden");return}
  const {data,error}=await client.rpc("is_goodworld_editor");
  editor=!error&&data===true;
  menu.classList.toggle("hidden",!editor);
  if(!editor&&currentPage==="editor")showPage("feed");
 }
 async function openEditorial(){
  await refreshAccess();
  if(!editor){
   showPage("profile");
   showToast("Sign in with an editor account to manage the feed");
   return;
  }
  closeMenu();showPage("editor");
  panel.innerHTML='<div class="editor-page">'+
   '<h1>Published stories.</h1>'+
   '<p class="lead">GoodWorld publishes automatically once a story meets its editorial and rights checks. Remove any unsuitable story from the public feed; its source and removal history stay in our private records.</p>'+
   '<div class="editor-controls"><button class="secondary" id="refreshPublished" type="button">Refresh published feed</button></div>'+
   '<p id="editorStatus" class="subtle" role="status">Loading published stories…</p>'+
   '<div id="publishedStoryList"></div>'+
   '<button class="secondary hidden" id="morePublished" type="button">Load more</button>'+
   '</div>';
  panel.querySelector("#refreshPublished").addEventListener("click",()=>fetchPublished(false));
  panel.querySelector("#morePublished").addEventListener("click",()=>fetchPublished(true));
  panel.querySelector("#publishedStoryList").addEventListener("click",removeClick);
  await fetchPublished(false);
 }
 async function fetchPublished(more){
  if(busy||!editor)return;
  busy=true;
  if(!more)offset=0;
  const list=panel.querySelector("#publishedStoryList");
  const status=panel.querySelector("#editorStatus");
  if(!list||!status){busy=false;return}
  status.textContent="Loading published stories…";
  const {data,error}=await client.rpc("list_goodworld_published_editor_stories",
   {p_limit:pageSize,p_offset:offset});
  if(error){
   status.textContent="Unable to load stories: "+error.message;busy=false;return;
  }
  if(!more)list.innerHTML="";
  const records=Array.isArray(data)?data:[];
  for(const s of records){
   const el=document.createElement("article");
   el.className="editor-card";
   el.innerHTML='<div><p class="subtle">'+esc(s.category||"News")+' · '+esc(s.source_name||"Source")+
    ' · '+esc(s.published_at?new Date(s.published_at).toLocaleDateString():"")+'</p>'+
    '<h2>'+esc(s.title)+'</h2>'+
    '<p><a href="'+esc(s.source_url||"#")+'" target="_blank" rel="noopener noreferrer">Original source ↗</a></p></div>'+
    '<div class="editor-card-buttons">'+
    '<button class="secondary" type="button" data-remove-story="'+esc(s.id)+'" data-story-title="'+esc(s.title)+'">Remove from feed</button></div>';
   list.append(el);
  }
  offset+=records.length;
  const moreButton=panel.querySelector("#morePublished");
  if(moreButton)moreButton.classList.toggle("hidden",records.length<pageSize);
  status.textContent=offset+" published stories loaded. Stories are published automatically.";
  if(offset===0)status.textContent="No published stories.";
  busy=false;
 }
 async function removeClick(event){
  const button=event.target.closest("[data-remove-story]");
  if(!button||busy||!editor)return;
  const id=button.dataset.removeStory,title=button.dataset.storyTitle;
  if(!window.confirm('Remove "'+title+'" from the GoodWorld public feed? This hides it but preserves the record.'))return;
  busy=true;button.disabled=true;button.textContent="Removing…";
  const {data,error}=await client.rpc("remove_goodworld_published_story",{p_id:id,p_reason:"Editorial removal"});
  busy=false;
  if(error||data!==true){
   button.disabled=false;button.textContent="Remove from feed";
   showToast(error?.message||"The story was already removed");
   return;
  }
  showToast("Removed from the public feed");
  await fetchPublished(false);
  if(typeof loadStories==="function")await loadStories();
 }
 menu.addEventListener("click",openEditorial);
 client.auth.onAuthStateChange(()=>setTimeout(refreshAccess,0));
 refreshAccess().then(()=>{
  if(new URLSearchParams(location.search).get("editorial")==="1")openEditorial();
 });
})();