(()=>{"use strict";
const root=document.querySelector(".reader-actions[data-story-slug]");
if(!root)return;
const like=root.querySelector("[data-article-like]"),share=root.querySelector("[data-article-share]");
const slug=root.dataset.storySlug;
const endpoint="https://jdmpmrhyjitmjyjuhtds.supabase.co";
const key="sb_publishable_Mi4xc0jwt_MFKhjKWZ1Vpw_bG6VPp3_";
let client=null,story=null,busy=false;
const getClient=()=>{if(!client&&window.supabase?.createClient)client=window.supabase.createClient(endpoint,key);return client};
const update=()=>{if(!story)return;like.setAttribute("aria-pressed",String(!!story.liked_by_me));root.querySelector("[data-like-label]").textContent=story.liked_by_me?"Liked":"Like";root.querySelector("[data-like-count]").textContent=String(story.likes_total??0)};
async function init(){const c=getClient();if(!c)return;const {data,error}=await c.rpc("get_goodworld_feed",{p_order:"new"});if(!error){story=(data||[]).find(x=>x.slug===slug);update()}}
like.addEventListener("click",async()=>{const c=getClient();if(!c||busy)return;busy=true;try{
const {data:{session}}=await c.auth.getSession();
if(!session?.user){alert("Please sign in on GoodWorld to like this story.");return}
if(!story)await init();if(!story)return;
const wasLiked=!!story.liked_by_me;
const result=wasLiked?await c.from("goodworld_likes").delete().eq("story_id",story.id).eq("user_id",session.user.id):await c.from("goodworld_likes").insert({story_id:story.id,user_id:session.user.id});
if(result.error)throw result.error;
story.liked_by_me=!wasLiked;story.likes_total=Math.max(0,Number(story.likes_total||0)+(wasLiked?-1:1));update()
}catch(e){console.warn("GoodWorld like failed",e);alert("Unable to save your like right now.")}finally{busy=false}});
share.addEventListener("click",async()=>{try{if(navigator.share)await navigator.share({title:document.title,url:location.href});else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(location.href);share.textContent="Link copied";setTimeout(()=>share.textContent="↗ Share",1800)}else prompt("Copy story link",location.href)}catch(e){if(e.name!=="AbortError")console.warn(e)}});
if(window.supabase)init();else{const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";script.onload=init;document.head.append(script)}
})();
