// GoodWorld approved-content policy, updated 2026-10-30.
// All 22 inherited RSS feeds have been removed pending a rights/license audit.
// Do not fetch, store, score, or republish third-party RSS excerpts without an
// explicit applicable permission or individually verified reusable license.
// This inert endpoint intentionally returns HTTP 200 for old/manual callers
// while both discovery and auto-publication cron jobs remain disabled.
// To resume, install a *different* documented rights-aware source pipeline.
Deno.serve((req: Request) => {
 if(req.method!=="POST")return new Response(
  JSON.stringify({error:"Method not allowed"}),
  {status:405,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}}
 );
 return new Response(JSON.stringify({
  disabled:true,
  reason:"No sources are approved for automated redistribution under current GoodWorld editorial policy",
  added:0,
  feedsProcessed:0
 }),{status:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
});
