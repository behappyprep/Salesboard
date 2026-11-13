#!/usr/bin/env python3
"""Context-aware GoodWorld translations. Requires OPENAI_API_KEY in private CI secrets.
Usage: python goodworld-preview/translate_ai.py [ru|es|...]
Only translations/*.json are modified. Original stories are never changed.
"""
import json,os,pathlib,sys,time,urllib.request,urllib.error
from translate_news import ROOT,OUT,TARGETS,get_public_feed
MODEL=os.environ.get("GOODWORLD_TRANSLATION_MODEL","gpt-4.1-mini")
KEY=os.environ.get("OPENAI_API_KEY","")
LANG_NAMES={"ru":"Russian","zh":"Simplified Chinese","hi":"Hindi","es":"Spanish","ar":"Arabic","fr":"French","bn":"Bengali","pt":"Brazilian Portuguese","id":"Indonesian","ur":"Urdu"}
def translate(story,language):
    prompt=("You are a professional international news translator and copy editor. Translate the supplied English positive-news article into natural, fluent "+LANG_NAMES[language]+". "
      "Return JSON with exactly title, summary, body. Translate the MEANING, not individual words. Resolve ambiguous words using the full article: seal can mean an animal, not a stamp; Pearl is an animal's name. "
      "Write a compelling but accurate news headline. Preserve named entities, country of the event, factual details, dates, attribution, uncertainty and paragraph breaks. "
      "Never invent facts, embellish, remove important qualifiers or translate URLs. Keep source URLs unchanged. "
      "Do not add editorial notes, legal boilerplate, disclaimers or information absent from the source. "
      "For thin or truncated originals, do not fill gaps. Output valid JSON only.")
    payload={"model":MODEL,"temperature":0.2,"response_format":{"type":"json_object"},"messages":[{"role":"system","content":prompt},{"role":"user","content":json.dumps({"title":story["title"],"summary":story["summary"],"body":story["body"]},ensure_ascii=False)}]}
    req=urllib.request.Request("https://api.openai.com/v1/chat/completions",data=json.dumps(payload).encode(),headers={"Authorization":"Bearer "+KEY,"Content-Type":"application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req,timeout=90) as response: result=json.load(response)
            translated=json.loads(result["choices"][0]["message"]["content"])
            if any(not isinstance(translated.get(k),str) or len(translated[k].strip())<10 for k in ("title","summary","body")):raise ValueError("Missing translation fields")
            if len(translated["body"])<max(60,len(story["body"])*0.28):raise ValueError("Suspiciously short translation")
            return translated
        except urllib.error.HTTPError as e:
            if e.code not in (429,500,502,503) or attempt==2:raise
            time.sleep(3*(attempt+1))
    raise RuntimeError("Translation failed")
def main():
    if not KEY:raise SystemExit("OPENAI_API_KEY not configured. No translations changed.")
    feed=get_public_feed()
    if not feed:raise SystemExit("No source stories. Refusing to update translations.")
    OUT.mkdir(parents=True,exist_ok=True)
    languages=[sys.argv[1]] if len(sys.argv)==2 and sys.argv[1] in TARGETS else TARGETS
    for language in languages:
        path=OUT/(language+".json")
        document=json.loads(path.read_text("utf-8")) if path.exists() else {}
        entries=document.get("stories",{})
        changed=0
        for story in feed:
            old=entries.get(story["id"],{})
            if old.get("engine")=="openai-context-v1" and all(old.get("original_"+k)==story[k] for k in ("title","summary","body")):continue
            try:
                translated=translate(story,language)
                entries[story["id"]]={**translated,**{"original_"+k:story[k] for k in ("title","summary","body")},"engine":"openai-context-v1","review_status":"automated_not_editor_reviewed"}
                changed+=1
            except Exception as e:
                print(language,story["id"],"needs manual review:",e,file=sys.stderr,flush=True)
        if changed:
            document.update({"language":language,"source_language":"en","engine":"openai-context-v1","notice":"Contextual AI translation; not manually reviewed.","stories":entries})
            tmp=path.with_suffix(".tmp")
            tmp.write_text(json.dumps(document,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
            os.replace(tmp,path)
        print(language,"translated",changed,flush=True)
if __name__=="__main__":main()
