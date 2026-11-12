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
  panel.innerHTML='<div class="editor-header"><span class="pill">Private editorial</span>'+
   '<h1>World story desk.</h1><p class="lead">Find extraordinary, verifiable stories from beyond the usual news cycle. The source region is a discovery hint, not proof of where an event happened. Verify the actual country before publishing.</p>'+
   '<div class="editor-controls"><button class="secondary" id="refreshCandidates">Refresh queue</button>'+
   '<select class="input" id="regionFilter" aria-label="Filter region">'+
   '<option value="">All regions</option><option>Africa</option><option>Asia</option>'+
   '<option>Latin America</option><option>Caribbean</option><option>Oceania</option><option>Worldwide</option></select>'+
   '<select class="input" id="categoryFilter" aria-label="Filter category">'+
   '<option value="">All topics</option><option>Nature & Planet</option><option>Animals</option>'+
   '<option>Human Kindness</option><option>Science & Health</option><option>Education</option><option>Innovation</option></select></div>'+
   '<p class="subtle" id="editorStatus">Loading editorial queue…</p>'+
   '<div id="candidateList"></div><button class="secondary hidden" id="loadMoreCandidates">Load more</button></div>';
  panel.querySelector("#refreshCandidates").addEventListener("click",()=>fetchCandidates(false));
  panel.querySelector("#categoryFilter").addEventListener("change",()=>fetchCandidates(false));
  panel.querySelector("#regionFilter").addEventListener("change",()=>fetchCandidates(false));
  panel.querySelector("#loadMoreCandidates").addEventListener("click",()=>fetchCandidates(true));
  panel.querySelector("#candidateList").addEventListener("click",onCandidateClick);
 }
 async function fetchCandidates(more){
  if(!editor)return;
  if(!more){offset=0;candidates=[]}
  const category=panel.querySelector("#categoryFilter")?.value||"";
  const region=panel.querySelector("#regionFilter")?.value||"";
  const status=panel.querySelector("#editorStatus"),list=panel.querySelector("#candidateList");
  if(status)status.textContent="Loading…";
  let query=client.from("goodworld_candidates")
   .select("id,original_title,original_excerpt,source_name,source_url,category,published_at,created_at,global_discovery,discovery_region,source_country_hint,source_language,discovery_score,draft_title,draft_summary,draft_body,story_country,draft_image_url,draft_image_credit,draft_image_credit_url,draft_image_rights_url,draft_image_license,draft_image_alt,draft_image_kind",{count:"exact"})
   .eq("status","pending").order("created_at",{ascending:false}).range(offset,offset+pageSize-1);
  if(category)query=query.eq("category",category);
  if(region)query=query.eq("discovery_region",region);
  const {data,error,count}=await query;
  if(currentPage!=="editor"||!list)return;
  if(error){status.textContent="Could not load editorial queue: "+error.message;return}
  total=count??0;
  candidates=candidates.concat(data||[]);offset=candidates.length;
  status.textContent=total+" awaiting review · "+candidates.length+" shown. Nothing publishes without your approval.";
  list.innerHTML=candidates.map(c=>{
   const label=c.global_discovery
     ? '<span>Discovery: '+escapeHtml(c.discovery_region||"Worldwide")+'</span>'+
       '<span>Location to confirm: '+escapeHtml(c.story_country||c.source_country_hint||"Unknown")+'</span>'+
       '<span>Language: '+escapeHtml(c.source_language||"en")+'</span>'
     : '<span>Existing editorial candidate</span>';
   return '<article class="editor-candidate" id="candidate-'+escapeHtml(c.id)+'">'+
    '<div class="editor-meta"><span>'+escapeHtml(c.category)+'</span>'+
    '<span>'+escapeHtml(c.source_name)+'</span>'+label+'</div>'+
    '<h3>'+escapeHtml(c.original_title)+'</h3>'+
    '<p>'+escapeHtml((c.original_excerpt||"").slice(0,500))+'</p>'+
    '<a href="'+escapeHtml(c.source_url)+'" target="_blank" rel="noopener noreferrer" class="source">Check original source ↗</a>'+
    '<div class="editor-card-buttons"><button class="primary" data-edit="'+escapeHtml(c.id)+'">Review & write</button>'+
    '<button class="secondary" data-reject="'+escapeHtml(c.id)+'">Reject</button></div></article>';
  }).join("")||'<div class="panel">Nothing to review yet. International discovery runs four times a day.</div>';
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
  const global=!!candidate.global_discovery;
  const f=document.createElement("form");
  f.className="editor-form";
  const extra=global?
   '<p class="subtle">Discovery region: '+escapeHtml(candidate.discovery_region||"Worldwide")+
   '. Source-location hint: '+escapeHtml(candidate.source_country_hint||"unknown")+
   '. Enter the actual country where the story happened, not the publisher’s country.</p>':'';
  f.innerHTML='<h3>'+(global?'Prepare a world story':'Write an original story')+'</h3>'+
   '<p>Open the source. Verify the joyful outcome, dates, names, location and rights. Write independently: do not copy another publisher’s text or use unlicensed images.</p>'+extra+
   '<label class="fieldlabel">Original headline<input name="title" class="input" required minlength="15" maxlength="180" placeholder="Accurate, joyful, specific headline" value="'+escapeHtml(candidate.draft_title||"")+'"></label>'+
   '<label class="fieldlabel">Original summary<textarea name="summary" class="input" required minlength="35" maxlength="500" rows="3" placeholder="What happened and why it matters?">'+escapeHtml(candidate.draft_summary||"")+'</textarea></label>'+
   '<label class="fieldlabel">Original report<textarea name="body" class="input" required minlength="'+(global?'220':'40')+'" maxlength="10000" rows="8" placeholder="Write factual context and specific, confirmed positive outcomes. Do not invent details.">'+escapeHtml(candidate.draft_body||"")+'</textarea></label>'+
   '<label class="fieldlabel">Category<select name="category" class="input"><option>Nature & Planet</option><option>Science & Health</option><option>Animals</option><option>Human Kindness</option><option>Innovation</option><option>Education</option></select></label>'+
   (global?
    '<label class="fieldlabel">Verified event country<input name="country" class="input" required minlength="2" maxlength="85" placeholder="e.g., Madagascar, Nepal, Namibia" value="'+escapeHtml(candidate.story_country||"")+'"></label>'+
    '<label class="fieldlabel"><input type="checkbox" name="sourceChecked" required> I checked the original reporting and the factual outcome.</label>'+
    '<label class="fieldlabel"><input type="checkbox" name="countryChecked" required> I verified the country where this event happened.</label>'+
    '<p class="subtle">Photo required. Use a rights-verified Wikimedia Commons or approved public-agency image. Link to its actual license and credit the photographer. A representative photo must be clearly labelled.</p>'+
    '<label class="fieldlabel">Licensed direct photo URL<input name="photoUrl" type="url" class="input" required placeholder="https://upload.wikimedia.org/wikipedia/commons/..." value="'+escapeHtml(candidate.draft_image_url||"")+'"></label>'+
    '<label class="fieldlabel">Photographer / image credit<input name="photoCredit" class="input" required maxlength="350" value="'+escapeHtml(candidate.draft_image_credit||"")+'"></label>'+
    '<label class="fieldlabel">Image credit and original file page URL<input name="photoCreditUrl" type="url" class="input" required value="'+escapeHtml(candidate.draft_image_credit_url||"")+'"></label>'+
    '<label class="fieldlabel">Image license URL<input name="photoRightsUrl" type="url" class="input" required value="'+escapeHtml(candidate.draft_image_rights_url||"")+'"></label>'+
    '<label class="fieldlabel">Image license name<input name="photoLicense" class="input" required maxlength="150" value="'+escapeHtml(candidate.draft_image_license||"")+'"></label>'+
    '<label class="fieldlabel">Factual photo description<input name="photoAlt" class="input" required minlength="20" maxlength="600" value="'+escapeHtml(candidate.draft_image_alt||"")+'"></label>'+
    '<label class="fieldlabel">Photo relationship<select name="photoKind" class="input"><option value="representative">Representative photo, not this actual event</option><option value="source">Actual verified event photo</option></select></label>'+
    '<label class="fieldlabel"><input type="checkbox" name="photoChecked" required> I checked the photographer, commercial reuse rights, attribution and whether this is an actual event photo.</label>'
    :'<label class="fieldlabel">Licensed image URL (optional)<input name="image" type="url" class="input" placeholder="https://..."></label>')+
   '<div class="editor-card-buttons">'+
   (global?'<button type="button" class="secondary" id="saveGlobalDraft">Save draft</button>':'')+
   '<button class="primary" type="submit">Approve & publish</button>'+
   '<button class="secondary" type="button" data-close-form>Cancel</button></div>'+
   '<div class="subtle" role="status"></div>';
  f.elements.category.value=candidate.category;
  if(global)f.elements.photoKind.value=candidate.draft_image_kind||"representative";
  card.append(f);
  f.scrollIntoView({behavior:"smooth",block:"nearest"});
  f.querySelector("[data-close-form]").onclick=()=>f.remove();
  const reportStatus=f.querySelector('[role="status"]');
  if(global){
   f.querySelector("#saveGlobalDraft").addEventListener("click",async()=>{
    reportStatus.textContent="Saving private draft…";
    const {data,error}=await client.rpc("save_goodworld_global_draft",{
     p_id:id,p_title:f.elements.title.value.trim(),
     p_summary:f.elements.summary.value.trim(),
     p_body:f.elements.body.value.trim(),
     p_story_country:f.elements.country.value.trim(),
     p_image_url:f.elements.photoUrl.value.trim(),
     p_image_credit:f.elements.photoCredit.value.trim(),
     p_image_credit_url:f.elements.photoCreditUrl.value.trim(),
     p_image_rights_url:f.elements.photoRightsUrl.value.trim(),
     p_image_license:f.elements.photoLicense.value.trim(),
     p_image_alt:f.elements.photoAlt.value.trim(),
     p_image_kind:f.elements.photoKind.value
    });
    if(error||!data){reportStatus.textContent=error?.message||"Draft not available";return}
    candidate.draft_title=f.elements.title.value.trim();
    candidate.draft_summary=f.elements.summary.value.trim();
    candidate.draft_body=f.elements.body.value.trim();
    candidate.story_country=f.elements.country.value.trim();
    candidate.draft_image_url=f.elements.photoUrl.value.trim();
    candidate.draft_image_credit=f.elements.photoCredit.value.trim();
    candidate.draft_image_credit_url=f.elements.photoCreditUrl.value.trim();
    candidate.draft_image_rights_url=f.elements.photoRightsUrl.value.trim();
    candidate.draft_image_license=f.elements.photoLicense.value.trim();
    candidate.draft_image_alt=f.elements.photoAlt.value.trim();
    candidate.draft_image_kind=f.elements.photoKind.value;
    reportStatus.textContent="Draft saved privately. Not published.";
   });
  }
  f.addEventListener("submit",async e=>{
   e.preventDefault();if(!f.reportValidity())return;
   const button=f.querySelector('button[type="submit"]');
   button.disabled=true;
   reportStatus.textContent="Verifying & publishing…";
   const args={
    p_id:id,p_title:f.elements.title.value.trim(),
    p_summary:f.elements.summary.value.trim(),p_body:f.elements.body.value.trim(),
    p_category:f.elements.category.value
   };
   const {error}=global
    ?await client.rpc("publish_goodworld_global_candidate",{
      ...args,p_story_country:f.elements.country.value.trim(),
      p_source_checked:f.elements.sourceChecked.checked,
      p_country_checked:f.elements.countryChecked.checked,
      p_image_url:f.elements.photoUrl.value.trim(),
      p_image_credit:f.elements.photoCredit.value.trim(),
      p_image_credit_url:f.elements.photoCreditUrl.value.trim(),
      p_image_rights_url:f.elements.photoRightsUrl.value.trim(),
      p_image_license:f.elements.photoLicense.value.trim(),
      p_image_alt:f.elements.photoAlt.value.trim(),
      p_image_kind:f.elements.photoKind.value,
      p_image_checked:f.elements.photoChecked.checked
     })
    :await client.rpc("publish_goodworld_candidate",{
      ...args,p_image_url:f.elements.image.value.trim()||null
     });
   button.disabled=false;
   if(error){reportStatus.textContent=error.message;return}
   reportStatus.textContent="Published successfully";
   showToast("Story approved and published!");
   await fetchCandidates(false);
   await loadStories();
  });
 }
 client?.auth.onAuthStateChange(()=>{setTimeout(refreshAccess,0)});
 refreshAccess();
})();