"use strict";
/* GoodWorld reader UI translations. Editorial news translations are generated
   separately by the offline Argos job and are never guessed in this client. */
(function(){
 const LANGS=[
  ["en","English","en-US"],["zh","中文","zh-CN"],["hi","हिन्दी","hi-IN"],
  ["es","Español","es-ES"],["ar","العربية","ar"],["fr","Français","fr-FR"],
  ["bn","বাংলা","bn-BD"],["pt","Português","pt-BR"],["id","Bahasa Indonesia","id-ID"],
  ["ur","اردو","ur-PK"],["ru","Русский","ru-RU"]
 ];
 const BASE={
  menu:"Menu",label:"Independent positive news",latest:"Latest",top:"Top Today",
  latestTitle:"Latest news",topTitle:"Top Today",
  latestSub:"The newest stories, all in one feed",topSub:"Stories readers liked today",
  sourceProof:"Good news from verified sources",reported:"REPORTED BY",source:"Original source",
  representative:"Representative photo",illustrative:"Illustrative photo",photo:"Photo",
  rights:"Image rights",share:"Share",like:"Like",unlike:"Unlike",privacy:"Privacy",
  all:"All stories",footer:"Positive news, sourced and free to read.",
  pending:"English original · translation pending",machine:"Automatically translated · Not editorially reviewed",
  original:"Read original source",read:"Read story",back:"Back to GoodWorld",
  noTop:"The favorites are still coming.",
  noTopDetails:"No stories have received a heart today. Find something uplifting in Latest and tap the heart to help it appear here.",
  browse:"Explore latest stories",noLatest:"Something good is on its way.",
  noLatestDetails:"We only publish sourced, meaningful news. Try refreshing to see what is new.",
  refresh:"Refresh news",profile:"Profile",account:"Your account and likes",
  donate:"Donate",editor:"Editorial",login:"Sign in",close:"Close",
  disclosure:"Machine translation may be inaccurate, especially for medical and scientific terms. Check the original source.",
  unable:"This story is not available.", language:"Language"
 };
 const DICT={
 zh:{menu:"菜单",label:"独立正面新闻",latest:"最新",top:"今日热门",latestTitle:"最新新闻",topTitle:"今日热门",latestSub:"世界各地的最新好消息",topSub:"读者今天最喜欢的故事",sourceProof:"来自可靠来源的好消息",reported:"消息来源",source:"原始来源",representative:"示意照片",illustrative:"示意照片",photo:"照片",rights:"图片许可",share:"分享",like:"喜欢",unlike:"取消喜欢",privacy:"隐私",all:"所有新闻",footer:"有来源的好消息，免费阅读。",pending:"英文原文 · 翻译处理中",machine:"机器翻译 · 未经编辑审核",original:"查看原始来源",read:"阅读新闻",back:"返回 GoodWorld",noTop:"今天还没有热门新闻。",noTopDetails:"今天还没有读者点赞。浏览最新新闻并为喜欢的故事点赞。",browse:"浏览最新新闻",noLatest:"好消息即将到来。",noLatestDetails:"我们只发布有可靠来源的新闻。请稍后刷新。",refresh:"刷新",profile:"个人资料",account:"账户和点赞",donate:"捐赠",editor:"编辑",login:"登录",close:"关闭",disclosure:"机器翻译可能不准确，尤其是医学和科学术语。请查阅原始来源。",unable:"暂时无法查看这篇新闻。",language:"语言"},
 hi:{menu:"मेनू",label:"स्वतंत्र सकारात्मक समाचार",latest:"ताज़ा",top:"आज की प्रमुख",latestTitle:"ताज़ा खबरें",topTitle:"आज की प्रमुख",latestSub:"दुनिया भर की नई सकारात्मक खबरें",topSub:"आज पाठकों की पसंदीदा खबरें",sourceProof:"विश्वसनीय स्रोतों से अच्छी खबरें",reported:"स्रोत",source:"मूल स्रोत",representative:"प्रतीकात्मक तस्वीर",illustrative:"प्रतीकात्मक तस्वीर",photo:"फ़ोटो",rights:"चित्र लाइसेंस",share:"शेयर करें",like:"पसंद",unlike:"पसंद हटाएँ",privacy:"गोपनीयता",all:"सभी खबरें",footer:"विश्वसनीय स्रोतों से मुफ़्त अच्छी खबरें।",pending:"अंग्रेज़ी मूल · अनुवाद जारी है",machine:"मशीन अनुवाद · संपादकीय समीक्षा नहीं",original:"मूल स्रोत देखें",read:"खबर पढ़ें",back:"GoodWorld पर लौटें",noTop:"आज अभी कोई प्रमुख खबर नहीं।",noTopDetails:"आज किसी खबर को पसंद नहीं किया गया। ताज़ा खबरें देखें और पसंद करें।",browse:"ताज़ा खबरें देखें",noLatest:"अच्छी खबर जल्द आएगी।",noLatestDetails:"हम केवल सत्यापित स्रोतों की खबरें प्रकाशित करते हैं।",refresh:"रीफ़्रेश करें",profile:"प्रोफ़ाइल",account:"खाता और पसंद",donate:"दान करें",editor:"संपादकीय",login:"साइन इन",close:"बंद करें",disclosure:"मशीन अनुवाद में त्रुटियाँ हो सकती हैं, विशेषकर चिकित्सा और विज्ञान में। मूल स्रोत जाँचें।",unable:"यह खबर उपलब्ध नहीं है।",language:"भाषा"},
 es:{menu:"Menú",label:"Noticias positivas independientes",latest:"Últimas",top:"Más populares",latestTitle:"Últimas noticias",topTitle:"Lo mejor de hoy",latestSub:"Las buenas noticias más recientes, en un solo lugar",topSub:"Las historias favoritas de hoy",sourceProof:"Buenas noticias de fuentes verificadas",reported:"FUENTE",source:"Fuente original",representative:"Foto ilustrativa",illustrative:"Foto ilustrativa",photo:"Foto",rights:"Licencia de imagen",share:"Compartir",like:"Me gusta",unlike:"Ya no me gusta",privacy:"Privacidad",all:"Todas las noticias",footer:"Buenas noticias verificadas y gratuitas.",pending:"Original en inglés · traducción pendiente",machine:"Traducción automática · sin revisión editorial",original:"Ver fuente original",read:"Leer noticia",back:"Volver a GoodWorld",noTop:"Todavía no hay favoritas hoy.",noTopDetails:"Nadie ha dado un corazón a una noticia hoy. Explora las últimas y elige tu favorita.",browse:"Explorar las últimas",noLatest:"Las buenas noticias están por llegar.",noLatestDetails:"Solo publicamos noticias de fuentes fiables. Actualiza la página más tarde.",refresh:"Actualizar",profile:"Perfil",account:"Tu cuenta y favoritos",donate:"Donar",editor:"Redacción",login:"Iniciar sesión",close:"Cerrar",disclosure:"La traducción automática puede contener errores, especialmente en términos médicos y científicos. Consulta la fuente original.",unable:"Esta noticia no está disponible.",language:"Idioma"},
 ar:{menu:"القائمة",label:"أخبار إيجابية مستقلة",latest:"الأحدث",top:"الأكثر رواجًا اليوم",latestTitle:"آخر الأخبار",topTitle:"الأكثر رواجًا اليوم",latestSub:"أحدث الأخبار الإيجابية من أنحاء العالم",topSub:"القصص المفضلة لدى القراء اليوم",sourceProof:"أخبار جيدة من مصادر موثوقة",reported:"المصدر",source:"المصدر الأصلي",representative:"صورة توضيحية",illustrative:"صورة توضيحية",photo:"صورة",rights:"ترخيص الصورة",share:"مشاركة",like:"إعجاب",unlike:"إلغاء الإعجاب",privacy:"الخصوصية",all:"جميع الأخبار",footer:"أخبار إيجابية موثوقة ومجانية.",pending:"الأصل بالإنجليزية · الترجمة قيد الإعداد",machine:"ترجمة آلية · دون مراجعة تحريرية",original:"قراءة المصدر الأصلي",read:"قراءة الخبر",back:"العودة إلى GoodWorld",noTop:"لا توجد أخبار مفضلة بعد اليوم.",noTopDetails:"لم تحصل أي قصة على إعجاب اليوم. تصفح الأخبار الأخيرة واختر قصتك المفضلة.",browse:"تصفح أحدث الأخبار",noLatest:"أخبار جيدة قادمة قريبًا.",noLatestDetails:"ننشر فقط الأخبار الموثقة. حاول التحديث لاحقًا.",refresh:"تحديث",profile:"الملف الشخصي",account:"حسابك والإعجابات",donate:"تبرع",editor:"التحرير",login:"تسجيل الدخول",close:"إغلاق",disclosure:"قد تحتوي الترجمة الآلية على أخطاء، خصوصًا المصطلحات الطبية والعلمية. راجع المصدر الأصلي.",unable:"هذا الخبر غير متاح.",language:"اللغة"},
 fr:{menu:"Menu",label:"Actualités positives indépendantes",latest:"Récentes",top:"À la une",latestTitle:"Dernières actualités",topTitle:"Les préférées du jour",latestSub:"Les nouvelles positives les plus récentes",topSub:"Les articles préférés des lecteurs aujourd’hui",sourceProof:"De bonnes nouvelles de sources vérifiées",reported:"SOURCE",source:"Source originale",representative:"Photo d’illustration",illustrative:"Photo d’illustration",photo:"Photo",rights:"Licence de l’image",share:"Partager",like:"J’aime",unlike:"Je n’aime plus",privacy:"Confidentialité",all:"Tous les articles",footer:"Des bonnes nouvelles vérifiées, accessibles à tous.",pending:"Original en anglais · traduction en attente",machine:"Traduction automatique · non relue",original:"Lire la source originale",read:"Lire l’article",back:"Retour à GoodWorld",noTop:"Pas encore de favoris aujourd’hui.",noTopDetails:"Aucun article n’a reçu de cœur aujourd’hui. Parcourez les actualités récentes.",browse:"Voir les actualités",noLatest:"De bonnes nouvelles arrivent.",noLatestDetails:"Nous publions uniquement des informations sourcées. Réessayez plus tard.",refresh:"Actualiser",profile:"Profil",account:"Compte et favoris",donate:"Faire un don",editor:"Rédaction",login:"Se connecter",close:"Fermer",disclosure:"La traduction automatique peut contenir des erreurs, notamment pour les termes médicaux et scientifiques. Consultez la source originale.",unable:"Cet article est indisponible.",language:"Langue"},
 bn:{menu:"মেনু",label:"স্বাধীন ইতিবাচক সংবাদ",latest:"সর্বশেষ",top:"আজকের সেরা",latestTitle:"সর্বশেষ সংবাদ",topTitle:"আজকের জনপ্রিয়",latestSub:"সারা বিশ্বের সাম্প্রতিক ভালো খবর",topSub:"আজ পাঠকদের পছন্দের খবর",sourceProof:"যাচাইকৃত উৎসের ভালো খবর",reported:"সংবাদের উৎস",source:"মূল উৎস",representative:"প্রতিনিধিত্বমূলক ছবি",illustrative:"প্রতীকী ছবি",photo:"ছবি",rights:"ছবির লাইসেন্স",share:"শেয়ার",like:"পছন্দ",unlike:"পছন্দ সরান",privacy:"গোপনীয়তা",all:"সব সংবাদ",footer:"যাচাইকৃত ভালো খবর, সবার জন্য বিনামূল্যে।",pending:"ইংরেজি মূল · অনুবাদ চলছে",machine:"স্বয়ংক্রিয় অনুবাদ · সম্পাদকীয় যাচাই হয়নি",original:"মূল উৎস দেখুন",read:"খবর পড়ুন",back:"GoodWorld-এ ফিরুন",noTop:"আজ এখনো জনপ্রিয় খবর নেই।",noTopDetails:"আজ কোনো গল্পে লাইক পড়েনি। সর্বশেষ খবর দেখুন।",browse:"সর্বশেষ খবর দেখুন",noLatest:"ভালো খবর আসছে।",noLatestDetails:"আমরা শুধু যাচাইকৃত খবর প্রকাশ করি। পরে আবার দেখুন।",refresh:"রিফ্রেশ",profile:"প্রোফাইল",account:"আপনার অ্যাকাউন্ট",donate:"অনুদান",editor:"সম্পাদকীয়",login:"সাইন ইন",close:"বন্ধ",disclosure:"স্বয়ংক্রিয় অনুবাদে ত্রুটি থাকতে পারে, বিশেষত চিকিৎসা ও বিজ্ঞান বিষয়ক শব্দে। মূল উৎস যাচাই করুন।",unable:"খবরটি পাওয়া যাচ্ছে না।",language:"ভাষা"},
 pt:{menu:"Menu",label:"Notícias positivas independentes",latest:"Recentes",top:"Destaques de hoje",latestTitle:"Últimas notícias",topTitle:"Mais populares hoje",latestSub:"As boas notícias mais recentes de todo o mundo",topSub:"As histórias favoritas dos leitores hoje",sourceProof:"Boas notícias de fontes verificadas",reported:"FONTE",source:"Fonte original",representative:"Foto ilustrativa",illustrative:"Foto ilustrativa",photo:"Foto",rights:"Licença da imagem",share:"Compartilhar",like:"Curtir",unlike:"Descurtir",privacy:"Privacidade",all:"Todas as notícias",footer:"Boas notícias verificadas e gratuitas.",pending:"Original em inglês · tradução pendente",machine:"Tradução automática · sem revisão editorial",original:"Ver fonte original",read:"Ler notícia",back:"Voltar ao GoodWorld",noTop:"Ainda não há destaques hoje.",noTopDetails:"Nenhuma história recebeu curtidas hoje. Explore as últimas notícias.",browse:"Ver últimas notícias",noLatest:"Boas notícias estão a caminho.",noLatestDetails:"Publicamos apenas notícias de fontes verificadas. Tente atualizar mais tarde.",refresh:"Atualizar",profile:"Perfil",account:"Sua conta e curtidas",donate:"Doar",editor:"Redação",login:"Entrar",close:"Fechar",disclosure:"Traduções automáticas podem conter erros, especialmente em temas médicos e científicos. Consulte a fonte original.",unable:"Esta notícia não está disponível.",language:"Idioma"},
 id:{menu:"Menu",label:"Berita positif independen",latest:"Terbaru",top:"Populer hari ini",latestTitle:"Berita terbaru",topTitle:"Terpopuler hari ini",latestSub:"Berita baik terbaru dari seluruh dunia",topSub:"Cerita favorit pembaca hari ini",sourceProof:"Berita baik dari sumber terverifikasi",reported:"SUMBER",source:"Sumber asli",representative:"Foto ilustrasi",illustrative:"Foto ilustrasi",photo:"Foto",rights:"Lisensi foto",share:"Bagikan",like:"Suka",unlike:"Batal suka",privacy:"Privasi",all:"Semua berita",footer:"Berita baik yang terverifikasi dan gratis.",pending:"Versi asli bahasa Inggris · terjemahan menyusul",machine:"Terjemahan mesin · belum ditinjau redaksi",original:"Baca sumber asli",read:"Baca berita",back:"Kembali ke GoodWorld",noTop:"Belum ada berita populer hari ini.",noTopDetails:"Belum ada berita yang mendapat suka hari ini. Jelajahi berita terbaru.",browse:"Lihat berita terbaru",noLatest:"Berita baik segera hadir.",noLatestDetails:"Kami hanya menerbitkan berita dengan sumber terverifikasi. Coba lagi nanti.",refresh:"Muat ulang",profile:"Profil",account:"Akun dan suka",donate:"Donasi",editor:"Editorial",login:"Masuk",close:"Tutup",disclosure:"Terjemahan mesin mungkin keliru, terutama istilah medis dan ilmiah. Periksa sumber asli.",unable:"Berita ini tidak tersedia.",language:"Bahasa"},
 ur:{menu:"مینو",label:"آزاد مثبت خبریں",latest:"تازہ ترین",top:"آج کی مقبول",latestTitle:"تازہ ترین خبریں",topTitle:"آج کی مقبول خبریں",latestSub:"دنیا بھر سے نئی اچھی خبریں",topSub:"آج قارئین کی پسندیدہ خبریں",sourceProof:"مصدقہ ذرائع سے اچھی خبریں",reported:"ذریعہ",source:"اصل ذریعہ",representative:"نمائندہ تصویر",illustrative:"علامتی تصویر",photo:"تصویر",rights:"تصویر کا لائسنس",share:"شیئر کریں",like:"پسند",unlike:"ناپسند",privacy:"رازداری",all:"تمام خبریں",footer:"مصدقہ اچھی خبریں، سب کے لیے مفت۔",pending:"اصل انگریزی · ترجمہ زیرِ عمل",machine:"خودکار ترجمہ · ادارتی نظرثانی نہیں ہوئی",original:"اصل ذریعہ دیکھیں",read:"خبر پڑھیں",back:"GoodWorld پر واپس",noTop:"آج ابھی کوئی مقبول خبر نہیں۔",noTopDetails:"آج کسی خبر کو پسند نہیں کیا گیا۔ نئی خبریں دیکھیں۔",browse:"تازہ خبریں دیکھیں",noLatest:"اچھی خبریں جلد آ رہی ہیں۔",noLatestDetails:"ہم صرف مصدقہ خبریں شائع کرتے ہیں۔ بعد میں تازہ کریں۔",refresh:"تازہ کریں",profile:"پروفائل",account:"آپ کا اکاؤنٹ",donate:"عطیہ",editor:"ادارتی",login:"سائن ان",close:"بند",disclosure:"خودکار ترجمے میں غلطیاں ہو سکتی ہیں، خصوصاً طبی اور سائنسی اصطلاحات میں۔ اصل ذریعہ دیکھیں۔",unable:"یہ خبر دستیاب نہیں۔",language:"زبان"},
 ru:{menu:"Меню",label:"Независимые позитивные новости",latest:"Новые",top:"Лучшее за сегодня",latestTitle:"Последние новости",topTitle:"Лучшее за сегодня",latestSub:"Новые хорошие новости со всего мира",topSub:"Истории, понравившиеся читателям сегодня",sourceProof:"Хорошие новости из проверенных источников",reported:"ИСТОЧНИК",source:"Первоисточник",representative:"Иллюстративное фото",illustrative:"Иллюстративное фото",photo:"Фото",rights:"Лицензия на фото",share:"Поделиться",like:"Нравится",unlike:"Убрать лайк",privacy:"Конфиденциальность",all:"Все новости",footer:"Проверенные хорошие новости, доступные бесплатно.",pending:"Английский оригинал · перевод готовится",machine:"Машинный перевод · без редакторской проверки",original:"Открыть первоисточник",read:"Читать новость",back:"Вернуться в GoodWorld",noTop:"Пока нет популярных новостей.",noTopDetails:"Сегодня ещё никто не поставил лайк. Посмотрите новые истории.",browse:"Смотреть новые",noLatest:"Хорошие новости скоро появятся.",noLatestDetails:"Мы публикуем только новости из проверенных источников. Попробуйте обновить страницу.",refresh:"Обновить",profile:"Профиль",account:"Аккаунт и лайки",donate:"Поддержать",editor:"Редакция",login:"Войти",close:"Закрыть",disclosure:"Машинный перевод может содержать ошибки, особенно в медицинских и научных терминах. Проверяйте первоисточник.",unable:"Новость недоступна.",language:"Язык"}
 };
 let lang="en", cache=null,cacheLang="en",seq=0;
 const supported=new Set(LANGS.map(x=>x[0]));
 const currentParam=new URLSearchParams(location.search).get("lang");
 const pathLanguage=/^\/(zh|hi|es|ar|fr|bn|pt|id|ur|ru)\/$/.exec(location.pathname)?.[1]||null;
 function stored(){try{return localStorage.getItem("goodworld:language")}catch{return null}}
 const browserLang=(navigator.language||"en").toLowerCase().split("-")[0];
 lang=supported.has(pathLanguage)?pathLanguage:supported.has(currentParam)?currentParam:supported.has(stored())?stored():supported.has(browserLang)?browserLang:"en";
 function getLang(){return lang}
 function nativeLocale(){return LANGS.find(x=>x[0]===lang)?.[2]||"en-US"}
 function direction(){return lang==="ar"||lang==="ur"?"rtl":"ltr"}
 function t(key){return (DICT[lang]||{})[key]||BASE[key]||key}
 function applyStatic(){
  document.documentElement.lang=lang;
  document.documentElement.dir=direction();
  const selector=document.getElementById("languageSelect");
  if(selector)selector.value=lang;
  document.querySelectorAll("[data-gw-text]").forEach(el=>{el.textContent=t(el.dataset.gwText)});
  document.querySelectorAll("[data-gw-label]").forEach(el=>{el.setAttribute("aria-label",t(el.dataset.gwLabel))});
 }
 async function load(){
  const requested=lang,req=++seq;
  if(requested==="en"){cache=null;cacheLang="en";applyStatic();window.dispatchEvent(new Event("goodworld:translations-loaded"));return}
  try{
   const res=await fetch("/translations/"+encodeURIComponent(requested)+".json",{cache:"no-cache"});
   if(!res.ok)throw Error("Translations are not generated yet");
   const obj=await res.json();
   if(obj.language!==requested||!obj.stories||typeof obj.stories!=="object")throw Error("Invalid translation file");
   if(req!==seq||requested!==lang)return;
   cache=obj.stories;cacheLang=requested;
  }catch{
   if(req!==seq||requested!==lang)return;
   cache=null;cacheLang=requested;
  }
  applyStatic();window.dispatchEvent(new Event("goodworld:translations-loaded"));
 }
 function translated(story){
  if(lang==="en")return null;
  if(!cache||cacheLang!==lang)return null;
  const v=cache[story.id];
  if(!v||v.original_title!==story.title||v.original_summary!==story.summary||v.original_body!==story.body)return null;
  if(typeof v.title!=="string"||typeof v.summary!=="string"||typeof v.body!=="string")return null;
  return v;
 }
 function setLang(next){
  if(!supported.has(next)||next===lang)return;
  lang=next;cache=null;cacheLang=next;
  try{localStorage.setItem("goodworld:language",next)}catch{}
  const url=new URL(location.href);
  if(next==="en")url.searchParams.delete("lang");else url.searchParams.set("lang",next);
  history.replaceState(history.state,"",url.pathname+url.search+url.hash);
  window.GWAnalytics?.track("language_change",{language:next,method:"selector"});
  const isHomepage=location.pathname==="/"||/^\/(zh|hi|es|ar|fr|bn|pt|id|ur|ru)\/$/.test(location.pathname);
  if(isHomepage){
   location.assign(next==="en"?"/":"/"+next+"/");
   return;
  }
  applyStatic();window.dispatchEvent(new Event("goodworld:language-changed"));
  load();
 }
 function init(){
  const el=document.getElementById("languageSelect");
  if(el){
   el.replaceChildren(...LANGS.map(([code,title])=>{
    const option=document.createElement("option");option.value=code;option.textContent=title;option.lang=code;option.dir=code==="ar"||code==="ur"?"rtl":"ltr";return option;
   }));
   el.addEventListener("change",()=>setLang(el.value));
  }
  applyStatic();load();
 }
 window.GW_I18N={LANGS,getLang,locale:nativeLocale,direction,t,translated,setLang,load,applyStatic};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
