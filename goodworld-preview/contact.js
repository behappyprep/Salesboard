"use strict";
(function(){
 const form=document.getElementById("goodworldFeedbackForm");
 if(!form)return;
 const status=document.getElementById("feedbackStatus");
 const submit=document.getElementById("feedbackSubmit");
 const supabaseUrl="https://jdmpmrhyjitmjyjuhtds.supabase.co";
 const publicKey="sb_publishable_Mi4xc0jwt_MFKhjKWZ1Vpw_bG6VPp3_";
 const db=window.supabase?.createClient(supabaseUrl,publicKey);
 form.addEventListener("submit",async(event)=>{
  event.preventDefault();
  if(!form.reportValidity()||!db)return;
  const data=new FormData(form);
  submit.disabled=true;
  status.textContent="Sending your feedback…";
  try{
   const {data:result,error}=await db.rpc("submit_goodworld_feedback",{
    p_topic:String(data.get("topic")||"general"),
    p_message:String(data.get("message")||"").trim(),
    p_email:String(data.get("email")||"").trim()||null,
    p_story_url:String(data.get("story")||"").trim()||null,
    p_website:String(data.get("website")||"")
   });
   if(error||result?.accepted!==true)throw new Error(error?.message||"Submission was not accepted");
   status.textContent="Thank you. Your message has been received.";
   form.reset();
   window.GWAnalytics?.track("feedback_sent",{section:"editorial_feedback"});
  }catch(err){
   console.warn("Could not submit feedback",err);
   status.textContent="We could not receive your message. Please try again later.";
  }finally{submit.disabled=false}
 });
})();