#!/usr/bin/env python3
"""GoodWorld automatic machine translations, generated offline with Argos Translate.
Run hourly in GitHub Actions. No paid APIs or story-text transmission to a translator.
All published story IDs and original English text are sourced from the public read-only feed.
"""
import json, os, pathlib, re, sys, time, urllib.request
from datetime import datetime, timezone

ROOT=pathlib.Path(__file__).resolve().parent
OUT=ROOT/"translations"
TARGETS=("zh","hi","es","ar","fr","bn","pt","id","ur","ru")
PAGE_SIZE=250

def get_public_feed():
    """Read the complete published archive, not the 60-item reader feed RPC."""
    app=(ROOT/"app.js").read_text(encoding="utf-8")
    key=re.search(r'const GW_KEY="([^"]+)";',app)
    url=re.search(r'const GW_URL="([^"]+)";',app)
    if not key or not url: raise RuntimeError("Public Supabase endpoint not found")
    headers={"apikey":key.group(1),"Authorization":"Bearer "+key.group(1),
             "Accept":"application/json","User-Agent":"GoodWorld-Argos-Translations/2.0"}
    stories=[]
    offset=0
    while True:
        # Published originals are public; draft and private editorial data are never fetched.
        endpoint=(url.group(1)+"/rest/v1/goodworld_stories"
                  "?select=id,slug,title,summary,body,published_at"
                  "&status=eq.published&order=published_at.desc"
                  +"&limit="+str(PAGE_SIZE)+"&offset="+str(offset))
        request=urllib.request.Request(endpoint,headers=headers)
        with urllib.request.urlopen(request,timeout=45) as response:
            batch=json.load(response)
        if not isinstance(batch,list):
            raise RuntimeError("Published archive endpoint returned an unexpected shape")
        stories.extend(s for s in batch if s.get("id") and s.get("title")
                       and s.get("summary") and s.get("body"))
        if len(batch)<PAGE_SIZE:
            break
        offset+=PAGE_SIZE
        if offset>100000:
            raise RuntimeError("Archive pagination exceeded safety limit")
    return stories

def ensure_translation(language):
    import argostranslate.package
    import argostranslate.translate
    installed=argostranslate.translate.get_installed_languages()
    english=next((p for p in installed if p.code=="en"),None)
    target=next((p for p in installed if p.code==language),None)
    if english and target:
        existing=english.get_translation(target)
        if existing: return existing
    argostranslate.package.update_package_index()
    available=argostranslate.package.get_available_packages()
    direct=next((p for p in available if p.from_code=="en" and p.to_code==language),None)
    if not direct: raise RuntimeError("Argos model not found: en to "+language)
    print("Installing open-source Argos model en ->",language,flush=True)
    argostranslate.package.install_from_path(direct.download())
    installed=argostranslate.translate.get_installed_languages()
    english=next((p for p in installed if p.code=="en"),None)
    target=next((p for p in installed if p.code==language),None)
    if not english or not target: raise RuntimeError("Argos model was not loaded: "+language)
    return english.get_translation(target)

def trans(model,value):
    if not isinstance(value,str) or not value.strip():return ""
    # Preserve logical paragraph breaks; long paragraphs can exceed NMT context.
    paragraphs=value.strip().split("\n")
    out=[]
    for line in paragraphs:
        if not line.strip():out.append("");continue
        if len(line)<=540:segments=[line]
        else:
            sentences=re.split(r'(?<=[.!?])\s+',line)
            segments=[];part=""
            for sentence in sentences:
                if len(part)+len(sentence)>480 and part:
                    segments.append(part.strip());part=""
                part+=((" " if part else "")+sentence)
            if part:segments.append(part.strip())
            if not segments:segments=[line[:500]]
        result=[]
        for segment in segments:
            try:
                translated=model.translate(segment).strip()
            except Exception as exc:
                raise RuntimeError("NMT inference failed for text: "+str(exc)) from exc
            if not translated or len(translated)>max(500,len(segment)*5):
                raise RuntimeError("Invalid machine translation result")
            result.append(translated)
        out.append(" ".join(result))
    return "\n".join(out)

def translate_language(language,feed):
    OUT.mkdir(parents=True,exist_ok=True)
    target=OUT/(language+".json")
    if target.is_file():
        try:existing=json.loads(target.read_text("utf-8"))
        except Exception:existing={}
    else:existing={}
    entries=existing.get("stories",{}) if isinstance(existing,dict) else {}
    if not isinstance(entries,dict):entries={}
    new=[s for s in feed if not isinstance(entries.get(s["id"]),dict)
        or entries[s["id"]].get("original_title")!=s.get("title")
        or entries[s["id"]].get("original_summary")!=s.get("summary")
        or entries[s["id"]].get("original_body")!=s.get("body")]
    if not new:
        print(language,": already translated",len(entries),"stories",flush=True)
        return 0
    model=ensure_translation(language)
    count=0
    for s in new:
        try:
            entries[s["id"]]={
                "title":trans(model,s["title"]),
                "summary":trans(model,s["summary"]),
                "body":trans(model,s["body"]),
                "original_title":s["title"],
                "original_summary":s["summary"],
                "original_body":s["body"],
                "engine":"argos-offline",
            }
            count+=1
        except Exception as exc:
            print("Translation error",language,s["id"],str(exc),file=sys.stderr,flush=True)
    document={"language":language,"source_language":"en",
        "updated_at":datetime.now(timezone.utc).isoformat(),"engine":"argos-offline",
        "notice":"Automatic machine translation, not reviewed. Refer to the original source for precise medical or scientific terminology.",
        "stories":entries}
    # Preserve a finite history without dropping older stories already in the archive.
    tmp=target.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(document,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    os.replace(tmp,target)
    print(language,": added",count,"new translations; total",len(entries),flush=True)
    return count

def main():
    feed=get_public_feed()
    if not feed:raise RuntimeError("Public feed is empty; refusing to erase translations")
    print("Public verified stories:",len(feed),flush=True)
    failures=[]
    languages=(sys.argv[1],) if len(sys.argv)==2 and sys.argv[1] in TARGETS else TARGETS
    for lang in languages:
        try:translate_language(lang,feed)
        except Exception as exc:
            print("Failed language",lang,str(exc),file=sys.stderr,flush=True)
            failures.append(lang)
    if failures:raise SystemExit("Partial translation failure: "+", ".join(failures))
if __name__=="__main__": main()
