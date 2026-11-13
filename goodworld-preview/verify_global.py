#!/usr/bin/env python3
"""GoodWorld: first-party event verification via secured GitHub Actions."""
import json, os, sys, time, urllib.request, urllib.parse, urllib.error

API="https://jdmpmrhyjitmjyjuhtds.supabase.co/functions/v1/goodworld-international-editorial-gate"
AUDIENCE="goodworld-international-verification"
MODEL=os.environ.get("GOODWORLD_EDITORIAL_MODEL","gpt-4.1-mini")
RULES="""You are a meticulous independent editorial fact checker for GoodWorld.
Given the original first-party webpage text, determine if it contains a truly
exceptional positive EVENT that has ALREADY HAPPENED. Prioritize successful
animal rescues or releases, wildlife recoveries, remarkable human kindness,
nature recovery, extraordinary reunions. REJECT planned events, announcements,
fundraising, company promotion, politics, controversy, deaths, tragedies,
generic research findings or ordinary unremarkable activities.

Never make up a fact. Only original source_text is evidence; country_hint and
publisher's address do NOT establish event country. The actual country of
occurrence must be explicit IN SOURCE TEXT, and should appear in three distinct
literal evidence quotes (20-220 characters each) copied exactly from source_text
in its native language; choose quotes that establish event, outcome, location,
names, dates, or numbers. Quotes are PRIVATE to verification and must not be
copied into published text. Do not make the source or photographer seem to be
GoodWorld. If insufficient facts, REJECT.

Write an original English title 15-180 characters, concise standalone summary
35-500 characters, and body 220-9000 characters. Prefer 350-600 words only if
substantiated facts allow it; NEVER add padding or invent contextual details.
Clearly distinguish report publication date from actual event date.
All claims must be grounded; no defamatory or unverified allegations.
Photo should be subject-specific (real species or object) and representative,
not falsely presented as the actual event photograph.

Respond as ONLY a JSON object:
{"decision":"publish|reject","reason":"brief reason",
"firsthand_reporting":true,"outcome_completed":true,
"event_country_explicit":true,"copyright_safe_original":true,
"story_country":"actual English event country","title":"title",
"summary":"summary","body":"original factual English prose",
"category":"Animals|Nature & Planet|Human Kindness|Science & Health|Education|Innovation",
"evidence_quotes":["exact source-text quote 1","exact quote 2","exact quote 3"],
"photo_search":"precise English species photograph Wikimedia Commons",
"photo_subject_terms":["distinguishing file title term","second file title term"]}
If not all requirements are verifiable, decision=reject and mark false flags.
Do not reuse the original source's expressive language.
"""
def request(url,body=None,headers=None,timeout=55):
    data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None
    req=urllib.request.Request(url,data=data,method="POST" if data else "GET",
         headers={"Content-Type":"application/json",**(headers or {})})
    with urllib.request.urlopen(req,timeout=timeout) as response:
        return json.loads(response.read(800000).decode())
def oidc_token():
    token=os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN","")
    endpoint=os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL","")
    if not token or not endpoint: raise RuntimeError("GitHub id-token permission unavailable")
    sep="&" if "?" in endpoint else "?"
    reply=request(endpoint+sep+urllib.parse.urlencode({"audience":AUDIENCE}),
        headers={"Authorization":"Bearer "+token},timeout=25)
    if not reply.get("value"): raise RuntimeError("GitHub OIDC token missing")
    return reply["value"]
def evaluate(source):
    key=os.environ.get("OPENAI_API_KEY")
    if not key: raise RuntimeError("OPENAI_API_KEY GitHub secret unavailable")
    try:
        reply=request("https://api.openai.com/v1/chat/completions",{
          "model":MODEL,"temperature":0.1,"response_format":{"type":"json_object"},
          "messages":[{"role":"system","content":RULES},
                      {"role":"user","content":json.dumps(source,ensure_ascii=False)}]
        },{"Authorization":"Bearer "+key},timeout=100)
    except urllib.error.HTTPError as exc:
        detail=exc.read(650).decode(errors="replace")
        raise RuntimeError("OpenAI HTTP "+str(exc.code)+": "+detail[:350]) from exc
    return json.loads(reply["choices"][0]["message"]["content"])
def main():
    auth={"Authorization":"Bearer "+oidc_token()}
    items=request(API,{"action":"next"},auth,timeout=75)
    if items.get("error"):raise RuntimeError("Editorial gate: "+str(items))
    tasks=items.get("tasks",[])
    if not isinstance(tasks,list):raise RuntimeError("Invalid task response")
    print("Firsthand sources ready for analysis:",len(tasks),flush=True)
    for task in tasks[:3]:
        result=evaluate(task)
        checked=request(API,{"action":"submit","id":task["id"],"draft":result},auth,timeout=80)
        print(task["id"],"verified:",checked,flush=True)
        if checked.get("error"):raise RuntimeError(str(checked))
        time.sleep(1.2)
if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("GoodWorld automatic editorial verification failed:",str(exc),file=sys.stderr)
        sys.exit(1)
