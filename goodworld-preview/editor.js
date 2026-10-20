"use strict";
// Editorial dashboard: hidden unless this signed-in account has an editor grant.
// All actions are verified again in protected database RPCs.
(function(){
 const menu=document.getElementById("editorNav");
 const panel=document.getElementById("page");
 const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 let editor=false,candidates=[],total=0,offset=0;
 const pageSize=30;
 async function refreshAccess(){
  try{
   if(!client) return;
   const {data:{session:s}}=await client.auth.getSession();
   if(!s){editor=false;menu.classList.add("hidden");return}
   const {data,error}=await client.rpc("is_goodworld_editor");
   editor=!error&&data===true;
   menu.classList.toggle("hidden",!editor);
   if(!editor && currentPage==="editor")showPage("feed");
  }catch{editor=false;menu.classList.add("hidden")}
 }
 menu.addEventListener("click",async()=>{
  await refreshAccess();
  if(!editor){showToast("Editor access required");return}
  closeMenu();showPage("editor");renderEditorShell();await fetchCandidates(false);
 });
 function renderEditorShell(){
  panel.innerHTML='<div class="editor-header"><span class="pill">Private editorial</span><h1>Good news,<br>ready to review.</h1><p class="lead">Check sources and write an original summary before publishing. Feed items never go live automatically.</p><div class="editor-controls"><button class="secondary" id="refreshCandidates">Refresh queue</button><select class="input" id="categoryFilter" aria-label="Filter category"><option value="">All topics</option><option>Nature & Planet</option><option>Animals</option><option>Human Kindness</option><option>Science & Health</option></select></div><p class="subtle" id="editorStatus">Loading editorial queue…</p><div id="candidateList"></div><button class="secondary hidden" id="loadMoreCandidates">Load more</button></div>';
  panel.querySelector("#refreshCandidates").addEventListener("click",()=>fetchCandidates(false));
  panel.querySelector("#categoryFilter").addEventListener("change",()=>fetchCandidates(false));
  panel.querySelector("#loadMoreCandidates").addEventListener("click",()=>fetchCandidates(true));
  panel.querySelector("#candidateList").addEventListener("click",onCandidateClick);
 }
 async function fetchCandidates(more){
  if(!editor)return;
  if(!more){offset=0;candidates=[]}
  const category=panel.querySelector("#categoryFilter")?.value||"";
  const status=panel.querySelector("#editorStatus"),list=panel.querySelector("#candidateList");
  if(status)status.textContent="Loading…";
  let query=client.from("goodworld_candidates").select("id,original_title,original_excerpt,source_name,source_url,category,published_at,created_at",{count:"exact"}).eq("status","pending").order("created_at",{ascending:false}).range(offset,offset+pageSize-1);
  if(category)query=query.eq("category",category);
  const {data,error,count}=await query;
  if(currentPage!=="editor"||!list)return;
  if(error){status.textContent="Could not load editorial queue: "+error.message;return}
  total=count??0;candidates=candidates.concat(data||[]);offset=candidates.length;
  status.textContent=total+" awaiting review · "+candidates.length+" shown";
  list.innerHTML=candidates.map(c=>'<article class="editor-candidate" id="candidate-'+escapeHtml(c.id)+'"><div class="editor-meta"><span>'+escapeHtml(c.category)+'</span><span>'+escapeHtml(c.source_name)+'</span></div><h3>'+escapeHtml(c.original_title)+'</h3><p>'+escapeHtml(c.original_excerpt.slice(0,350))+'</p><a href="'+escapeHtml(c.source_url)+'" target="_blank" rel="noopener noreferrer" class="source">Read original source ↗</a><div class="editor-card-buttons"><button class="primary" data-edit="'+escapeHtml(c.id)+'">Review & write</button><button class="secondary" data-reject="'+escapeHtml(c.id)+'">Reject</button></div></article>').join("")||'<div class="panel">Nothing to review. The next source check runs within six hours.</div>';
  panel.querySelector("#loadMoreCandidates")?.classList.toggle("hidden",offset>=total);
 }
 async function onCandidateClick(event){
  const edit=event.target.closest("[data-edit]"),reject=event.target.closest("[data-reject]");
  if(edit)showPublishForm(edit.dataset.edit);
  if(reject){
   if(!confirm("Reject this candidate?"))return;
   const {error}=await client.rpc("reject_goodworld_candidate",{p_id:reject.dataset.reject});
   if(error){showToast("Reject failed: "+error.message);return}
   showToast("Candidate rejected");await fetchCandidates(false);
  }
 }
 function showPublishForm(id){
  const candidate=candidates.find(c=>c.id===id);
  if(!candidate)return;
  const card=panel.querySelector("#candidate-"+CSS.escape(id));
  if(!card)return;
  card.querySelector(".editor-form")?.remove();
  const form=document.createElement("form");form.className="editor-form";
  form.innerHTML='<h3>Write an original story</h3><p>Open and verify the source before publishing. Do not copy the source article or use unlicensed images.</p>'+
   '<label class="fieldlabel">Your original headline<input name="title" class="input" required minlength="10" maxlength="180" placeholder="Write a factual headline"></label>'+
   '<label class="fieldlabel">Short original summary<textarea name="summary" class="input" required minlength="20" maxlength="500" rows="3" placeholder="Explain the positive development in your own words"></textarea></label>'+
   '<label class="fieldlabel">Full original paragraph<textarea name="body" class="input" required minlength="40" maxlength="10000" rows="5" placeholder="Explain context, evidence, limitations and why this matters"></textarea></label>'+
   '<label class="fieldlabel">Category<select name="category" class="input"><option>Nature & Planet</option><option>Science & Health</option><option>Animals</option><option>Human Kindness</option><option>Innovation</option><option>Education</option></select></label>'+
   '<label class="fieldlabel">Licensed image URL (optional)<input name="image" type="url" class="input" placeholder="https://..."></label>'+
   '<button class="primary" type="submit">Publish verified story</button><button class="secondary" type="button" data-close-form>Cancel</button><div class="subtle" role="status"></div>';
  form.elements.category.value=candidate.category;
  card.append(form);form.scrollIntoView({behavior:"smooth",block:"nearest"});
  form.querySelector("[data-close-form]").onclick=()=>form.remove();
  form.addEventListener("submit",async e=>{
   e.preventDefault();if(!form.reportValidity())return;
   const button=form.querySelector('button[type="submit"]');button.disabled=true;
   const status=form.querySelector('[role="status"]');status.textContent="Publishing…";
   const {data,error}=await client.rpc("publish_goodworld_candidate",{
    p_id:id,p_title:form.elements.title.value.trim(),
    p_summary:form.elements.summary.value.trim(),p_body:form.elements.body.value.trim(),
    p_category:form.elements.category.value,p_image_url:form.elements.image.value.trim()||null
   });
   button.disabled=false;
   if(error){status.textContent=error.message;return}
   status.textContent="Published successfully";showToast("Your story is live!");
   await fetchCandidates(false);await loadStories();
  });
 }
 client?.auth.onAuthStateChange(()=>{setTimeout(refreshAccess,0)});
 refreshAccess();
})();