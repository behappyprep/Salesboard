"use strict";
/* GoodWorld reader UI translations. Editorial news translations are generated
   separately by the offline Argos job and are never guessed in this client. */
(function(){
 const LANGS=[
  ["en","English","en-US"],["zh","中文","zh-CN"],["hi","हिन्दी","hi-IN"],
  ["es","Español","es-ES"],["ar","العربية","ar"],["fr","Français","fr-FR"],
  ["bn","বাংলা","bn-BD"],["pt","Português","pt-BR"],["id","Bahasa Indonesia","id-ID"],
  ["ur","اردو","ur-PK"],["ru","Русский","ru-RU"],
  ["de","Deutsch","de-DE"],["it","Italiano","it-IT"],["pl","Polski","pl-PL"],
  ["nl","Nederlands","nl-NL"],["uk","Українська","uk-UA"],["ro","Română","ro-RO"],
  ["tr","Türkçe","tr-TR"],["ja","日本語","ja-JP"],["ko","한국어","ko-KR"],
  ["bg","Български","bg-BG"],
  ["hr","Hrvatski","hr-HR"],
  ["cs","Čeština","cs-CZ"],
  ["da","Dansk","da-DK"],
  ["et","Eesti","et-EE"],
  ["fi","Suomi","fi-FI"],
  ["el","Ελληνικά","el-GR"],
  ["hu","Magyar","hu-HU"],
  ["ga","Gaeilge","ga-IE"],
  ["lv","Latviešu","lv-LV"],
  ["lt","Lietuvių","lt-LT"],
  ["mt","Malti","mt-MT"],
  ["sk","Slovenčina","sk-SK"],
  ["sl","Slovenščina","sl-SI"],
  ["sv","Svenska","sv-SE"],
  ["sq","Shqip","sq-AL"],
  ["be","Беларуская","be-BY"],
  ["bs","Bosanski","bs-BA"],
  ["is","Íslenska","is-IS"],
  ["mk","Македонски","mk-MK"],
  ["nb","Norsk bokmål","nb-NO"],
  ["sr","Српски","sr-RS"],
  ["ka","ქართული","ka-GE"],
  ["hy","Հայերեն","hy-AM"],
  ["az","Azərbaycanca","az-AZ"],
  ["lb","Lëtzebuergesch","lb-LU"],
  ["fo","Føroyskt","fo-FO"],
  ["nn","Nynorsk","nn-NO"],
  ["cnr","Crnogorski","sr-ME"],
  ["ca","Català","ca-ES"],
  ["eu","Euskara","eu-ES"],
  ["gl","Galego","gl-ES"],
  ["cy","Cymraeg","cy-GB"],
  ["gd","Gàidhlig","gd-GB"],
  ["br","Brezhoneg","br-FR"],
  ["fy","Frysk","fy-NL"],
  ["oc","Occitan","oc-FR"],
  ["se","Davvisámegiella","se-NO"],
  ["rm","Rumantsch","rm-CH"],
  ["sc","Sardu","sc-IT"],
  ["ast","Asturianu","ast-ES"],
  ["co","Corsu","co-FR"],
  ["yi","ייִדיש","yi"],
  ["an","Aragonés","an-ES"],
  ["gv","Gaelg","gv-IM"],
  ["kw","Kernewek","kw-GB"],
  ["hsb","Hornjoserbšćina","hsb-DE"],
  ["dsb","Dolnoserbšćina","dsb-DE"],
  ["rue","Русиньскый","rue"],
  ["csb","Kaszëbsczi","csb-PL"]
 ];
 const EUROPEAN_CODES=new Set(["en","es","fr","pt","ru","de","it","pl","nl","uk","ro","tr","bg","hr","cs","da","et","fi","el","hu","ga","lv","lt","mt","sk","sl","sv","sq","be","bs","is","mk","nb","sr","ka","hy","az","lb","fo","nn","cnr","ca","eu","gl","cy","gd","br","fy","oc","se","rm","sc","ast","co","yi","an","gv","kw","hsb","dsb","rue","csb"]);
 const PUBLISHED_LOCALE_CODES=new Set(["en","zh","hi","es","ar","fr","bn","pt","id","ur","ru","de","pl","uk","it","nl","ro","tr","ja","ko"]);
 const missingLabels={
 bg:"Преводът на новините се подготвя.",hr:"Prijevodi vijesti su u pripremi.",cs:"Překlady zpráv se připravují.",
 da:"Oversættelser af nyheder er under udarbejdelse.",et:"Uudiste tõlked on ettevalmistamisel.",fi:"Uutisten käännökset ovat valmisteilla.",
 el:"Οι μεταφράσεις των ειδήσεων ετοιμάζονται.",hu:"A hírek fordítása folyamatban van.",ga:"Tá aistriúcháin na nuachta á n-ullmhú.",
 lv:"Tiek gatavoti ziņu tulkojumi.",lt:"Rengiami naujienų vertimai.",mt:"It-traduzzjonijiet tal-aħbarijiet qed jitħejjew.",
 sk:"Preklady správ sa pripravujú.",sl:"Prevodi novic se pripravljajo.",sv:"Nyhetsöversättningar förbereds.",
 sq:"Përkthimet e lajmeve janë në përgatitje.",be:"Пераклады навін рыхтуюцца.",bs:"Prijevodi vijesti su u pripremi.",
 is:"Verið er að undirbúa þýðingar frétta.",mk:"Преводите на вестите се подготвуваат.",nb:"Oversettelser av nyhetene er under arbeid.",
 sr:"Преводи вести су у припреми.",ka:"ახალი ამბების თარგმანები მზადდება.",hy:"Լուրերի թարգմանությունները պատրաստվում են։",
 az:"Xəbərlərin tərcümələri hazırlanır.",lb:"D'Iwwersetzunge vun den Noriichte sinn an der Virbereedung.",
 fo:"Tíðindatýðingar verða fyrireikaðar.",nn:"Omsetjingar av nyhendene er under arbeid.",cnr:"Prevodi vijesti su u pripremi.",
 ca:"Les traduccions de les notícies s'estan preparant.",eu:"Albisteen itzulpenak prestatzen ari gara.",
 gl:"Estamos preparando as traducións das noticias.",cy:"Mae cyfieithiadau'r newyddion yn cael eu paratoi.",
 gd:"Tha eadar-theangachaidhean nan naidheachdan gan ullachadh.",br:"Emañ troidigezhioù ar c'heloù o vezañ aozet.",
 fy:"De oersettingen fan it nijs wurde taret.",oc:"Las traduccions de las novèlas son en preparacion.",
 se:"Ođđasiid jorgalusat leat ráhkaduvvomin.",rm:"Las translaziuns da las novitads èn en preparaziun.",
 sc:"Is tradutziones de is novas sunt in preparatzione.",ast:"Les traducciones de les noticies tán preparándose.",
 co:"E traduzzioni di e nutizie sò in preparazione.",yi:"די איבערזעצונגען פֿון די נײַעס ווערן צוגעגרייט.",
 an:"As traduccions d'as noticias se son preparando.",gv:"Ta chyndaaysyn ny naightyn goll er aarley.",
 kw:"Yma treylyansow an nowodhow ow tos yn prys.",hsb:"Přełožki powěsćow so přihotuja.",
 dsb:"Pśełožki powěsćow se pśigótuju.",rue:"Переклады новин ся приготовлюють.",csb:"Tłomaczenia wiôdłów sã przëszëkòwùją."
};
 const BASE={
  menu:"Menu",brandTagline:"Verified good news, every day.",label:"Independent positive news",latest:"Latest",top:"Top",
  latestTitle:"Latest news",topTitle:"Top",
  latestSub:"The newest stories, all in one feed",topSub:"Most liked stories of all time",
  sourceProof:"Good news from verified sources",reported:"REPORTED BY",source:"Original source",
  editorialIllustration:"Editorial illustration",representative:"Representative photo",illustrative:"Illustrative photo",photo:"Photo",
  rights:"Image rights",share:"Share",like:"Like",unlike:"Unlike",privacy:"Privacy",
  all:"All stories",footer:"Positive news, sourced and free to read.",
  pending:"English original · translation pending",machine:"Automatically translated · Not editorially reviewed",
  original:"Read original source",read:"Read story",back:"Back to GoodWorld",
  noTop:"No favorites yet.",
  noTopDetails:"No stories have received a like yet. Explore Latest and like a story to help it reach the Top.",
  browse:"Explore latest stories",noLatest:"Something good is on its way.",
  noLatestDetails:"We only publish sourced, meaningful news. Try refreshing to see what is new.",
  refresh:"Refresh news",profile:"Profile",account:"Your account and likes",
  donate:"Donate",editor:"Editorial",login:"Sign in",close:"Close",
  disclosure:"Machine translation may be inaccurate, especially for medical and scientific terms. Check the original source.",
  unable:"This story is not available.", language:"Language"
 };
 const DICT={
 zh:{editorialIllustration:"编辑插图",brandTagline:"每天都有经过核实的好消息。",menu:"菜单",label:"独立正面新闻",latest:"最新",top:"热门",latestTitle:"最新新闻",topTitle:"最受欢迎",latestSub:"世界各地的最新好消息",topSub:"读者历来最喜爱的故事",sourceProof:"来自可靠来源的好消息",reported:"消息来源",source:"原始来源",representative:"示意照片",illustrative:"示意照片",photo:"照片",rights:"图片许可",share:"分享",like:"喜欢",unlike:"取消喜欢",privacy:"隐私",all:"所有新闻",footer:"有来源的好消息，免费阅读。",pending:"英文原文 · 翻译处理中",machine:"机器翻译 · 未经编辑审核",original:"查看原始来源",read:"阅读新闻",back:"返回 GoodWorld",noTop:"还没有热门故事。",noTopDetails:"还没有故事获得点赞。浏览最新故事，为喜欢的内容点赞。",browse:"浏览最新新闻",noLatest:"好消息即将到来。",noLatestDetails:"我们只发布有可靠来源的新闻。请稍后刷新。",refresh:"刷新",profile:"个人资料",account:"账户和点赞",donate:"捐赠",editor:"编辑",login:"登录",close:"关闭",disclosure:"机器翻译可能不准确，尤其是医学和科学术语。请查阅原始来源。",unable:"暂时无法查看这篇新闻。",language:"语言"},
 hi:{editorialIllustration:"संपादकीय चित्रण",brandTagline:"हर दिन सत्यापित अच्छी खबरें।",menu:"मेनू",label:"स्वतंत्र सकारात्मक समाचार",latest:"ताज़ा",top:"热门",latestTitle:"ताज़ा खबरें",topTitle:"सबसे लोकप्रिय",latestSub:"दुनिया भर की नई सकारात्मक खबरें",topSub:"पाठकों की अब तक की सबसे पसंदीदा खबरें",sourceProof:"विश्वसनीय स्रोतों से अच्छी खबरें",reported:"स्रोत",source:"मूल स्रोत",representative:"प्रतीकात्मक तस्वीर",illustrative:"प्रतीकात्मक तस्वीर",photo:"फ़ोटो",rights:"चित्र लाइसेंस",share:"शेयर करें",like:"पसंद",unlike:"पसंद हटाएँ",privacy:"गोपनीयता",all:"सभी खबरें",footer:"विश्वसनीय स्रोतों से मुफ़्त अच्छी खबरें।",pending:"अंग्रेज़ी मूल · अनुवाद जारी है",machine:"मशीन अनुवाद · संपादकीय समीक्षा नहीं",original:"मूल स्रोत देखें",read:"खबर पढ़ें",back:"GoodWorld पर लौटें",noTop:"अभी कोई पसंदीदा खबर नहीं।",noTopDetails:"अब तक किसी खबर को लाइक नहीं मिला। ताज़ा खबरें देखें और अपनी पसंद बताएं।",browse:"ताज़ा खबरें देखें",noLatest:"अच्छी खबर जल्द आएगी।",noLatestDetails:"हम केवल सत्यापित स्रोतों की खबरें प्रकाशित करते हैं।",refresh:"रीफ़्रेश करें",profile:"प्रोफ़ाइल",account:"खाता और पसंद",donate:"दान करें",editor:"संपादकीय",login:"साइन इन",close:"बंद करें",disclosure:"मशीन अनुवाद में त्रुटियाँ हो सकती हैं, विशेषकर चिकित्सा और विज्ञान में। मूल स्रोत जाँचें।",unable:"यह खबर उपलब्ध नहीं है।",language:"भाषा"},
 es:{editorialIllustration:"Ilustración editorial",brandTagline:"Buenas noticias verificadas, cada día.",menu:"Menú",label:"Noticias positivas independientes",latest:"Últimas",top:"Más populares",latestTitle:"Últimas noticias",topTitle:"Más populares",latestSub:"Las buenas noticias más recientes, en un solo lugar",topSub:"Las historias más apreciadas de todos los tiempos",sourceProof:"Buenas noticias de fuentes verificadas",reported:"FUENTE",source:"Fuente original",representative:"Foto ilustrativa",illustrative:"Foto ilustrativa",photo:"Foto",rights:"Licencia de imagen",share:"Compartir",like:"Me gusta",unlike:"Ya no me gusta",privacy:"Privacidad",all:"Todas las noticias",footer:"Buenas noticias verificadas y gratuitas.",pending:"Original en inglés · traducción pendiente",machine:"Traducción automática · sin revisión editorial",original:"Ver fuente original",read:"Leer noticia",back:"Volver a GoodWorld",noTop:"Todavía no hay favoritas.",noTopDetails:"Ninguna historia ha recibido un me gusta todavía. Explora las últimas noticias y vota por tus favoritas.",browse:"Explorar las últimas",noLatest:"Las buenas noticias están por llegar.",noLatestDetails:"Solo publicamos noticias de fuentes fiables. Actualiza la página más tarde.",refresh:"Actualizar",profile:"Perfil",account:"Tu cuenta y favoritos",donate:"Donar",editor:"Redacción",login:"Iniciar sesión",close:"Cerrar",disclosure:"La traducción automática puede contener errores, especialmente en términos médicos y científicos. Consulta la fuente original.",unable:"Esta noticia no está disponible.",language:"Idioma"},
 ar:{editorialIllustration:"رسم توضيحي تحريري",brandTagline:"أخبار جيدة موثّقة، كل يوم.",menu:"القائمة",label:"أخبار إيجابية مستقلة",latest:"الأحدث",top:"الأكثر إعجاباً",latestTitle:"آخر الأخبار",topTitle:"الأكثر إعجاباً",latestSub:"أحدث الأخبار الإيجابية من أنحاء العالم",topSub:"القصص الأكثر إعجاباً على الإطلاق",sourceProof:"أخبار جيدة من مصادر موثوقة",reported:"المصدر",source:"المصدر الأصلي",representative:"صورة توضيحية",illustrative:"صورة توضيحية",photo:"صورة",rights:"ترخيص الصورة",share:"مشاركة",like:"إعجاب",unlike:"إلغاء الإعجاب",privacy:"الخصوصية",all:"جميع الأخبار",footer:"أخبار إيجابية موثوقة ومجانية.",pending:"الأصل بالإنجليزية · الترجمة قيد الإعداد",machine:"ترجمة آلية · دون مراجعة تحريرية",original:"قراءة المصدر الأصلي",read:"قراءة الخبر",back:"العودة إلى GoodWorld",noTop:"لا توجد قصص مفضلة بعد.",noTopDetails:"لم تحصل أي قصة على إعجاب بعد. تصفح الأخبار الأخيرة وأعجب بما تحب.",browse:"تصفح أحدث الأخبار",noLatest:"أخبار جيدة قادمة قريبًا.",noLatestDetails:"ننشر فقط الأخبار الموثقة. حاول التحديث لاحقًا.",refresh:"تحديث",profile:"الملف الشخصي",account:"حسابك والإعجابات",donate:"تبرع",editor:"التحرير",login:"تسجيل الدخول",close:"إغلاق",disclosure:"قد تحتوي الترجمة الآلية على أخطاء، خصوصًا المصطلحات الطبية والعلمية. راجع المصدر الأصلي.",unable:"هذا الخبر غير متاح.",language:"اللغة"},
 fr:{editorialIllustration:"Illustration éditoriale",brandTagline:"De bonnes nouvelles vérifiées, chaque jour.",menu:"Menu",label:"Actualités positives indépendantes",latest:"Récentes",top:"Top",latestTitle:"Dernières actualités",topTitle:"Les plus appréciées",latestSub:"Les nouvelles positives les plus récentes",topSub:"Les articles les plus aimés de tous les temps",sourceProof:"De bonnes nouvelles de sources vérifiées",reported:"SOURCE",source:"Source originale",representative:"Photo d’illustration",illustrative:"Photo d’illustration",photo:"Photo",rights:"Licence de l’image",share:"Partager",like:"J’aime",unlike:"Je n’aime plus",privacy:"Confidentialité",all:"Tous les articles",footer:"Des bonnes nouvelles vérifiées, accessibles à tous.",pending:"Original en anglais · traduction en attente",machine:"Traduction automatique · non relue",original:"Lire la source originale",read:"Lire l’article",back:"Retour à GoodWorld",noTop:"Pas encore de favoris.",noTopDetails:"Aucun article n’a encore reçu de « J’aime ». Découvrez les dernières nouvelles et choisissez vos préférées.",browse:"Voir les actualités",noLatest:"De bonnes nouvelles arrivent.",noLatestDetails:"Nous publions uniquement des informations sourcées. Réessayez plus tard.",refresh:"Actualiser",profile:"Profil",account:"Compte et favoris",donate:"Faire un don",editor:"Rédaction",login:"Se connecter",close:"Fermer",disclosure:"La traduction automatique peut contenir des erreurs, notamment pour les termes médicaux et scientifiques. Consultez la source originale.",unable:"Cet article est indisponible.",language:"Langue"},
 bn:{editorialIllustration:"সম্পাদকীয় চিত্রণ",brandTagline:"প্রতিদিন যাচাই করা ভালো খবর।",menu:"মেনু",label:"স্বাধীন ইতিবাচক সংবাদ",latest:"সর্বশেষ",top:"জনপ্রিয়",latestTitle:"সর্বশেষ সংবাদ",topTitle:"সবচেয়ে জনপ্রিয়",latestSub:"সারা বিশ্বের সাম্প্রতিক ভালো খবর",topSub:"সর্বকালের সবচেয়ে বেশি পছন্দ করা খবর",sourceProof:"যাচাইকৃত উৎসের ভালো খবর",reported:"সংবাদের উৎস",source:"মূল উৎস",representative:"প্রতিনিধিত্বমূলক ছবি",illustrative:"প্রতীকী ছবি",photo:"ছবি",rights:"ছবির লাইসেন্স",share:"শেয়ার",like:"পছন্দ",unlike:"পছন্দ সরান",privacy:"গোপনীয়তা",all:"সব সংবাদ",footer:"যাচাইকৃত ভালো খবর, সবার জন্য বিনামূল্যে।",pending:"ইংরেজি মূল · অনুবাদ চলছে",machine:"স্বয়ংক্রিয় অনুবাদ · সম্পাদকীয় যাচাই হয়নি",original:"মূল উৎস দেখুন",read:"খবর পড়ুন",back:"GoodWorld-এ ফিরুন",noTop:"এখনো জনপ্রিয় গল্প নেই।",noTopDetails:"এখনো কোনো খবরে লাইক পড়েনি। সর্বশেষ খবর পড়ুন এবং পছন্দের গল্পে লাইক দিন।",browse:"সর্বশেষ খবর দেখুন",noLatest:"ভালো খবর আসছে।",noLatestDetails:"আমরা শুধু যাচাইকৃত খবর প্রকাশ করি। পরে আবার দেখুন।",refresh:"রিফ্রেশ",profile:"প্রোফাইল",account:"আপনার অ্যাকাউন্ট",donate:"অনুদান",editor:"সম্পাদকীয়",login:"সাইন ইন",close:"বন্ধ",disclosure:"স্বয়ংক্রিয় অনুবাদে ত্রুটি থাকতে পারে, বিশেষত চিকিৎসা ও বিজ্ঞান বিষয়ক শব্দে। মূল উৎস যাচাই করুন।",unable:"খবরটি পাওয়া যাচ্ছে না।",language:"ভাষা"},
 pt:{editorialIllustration:"Ilustração editorial",brandTagline:"Boas notícias verificadas, todos os dias.",menu:"Menu",label:"Notícias positivas independentes",latest:"Recentes",top:"Top",latestTitle:"Últimas notícias",topTitle:"Mais populares",latestSub:"As boas notícias mais recentes de todo o mundo",topSub:"As histórias mais curtidas de todos os tempos",sourceProof:"Boas notícias de fontes verificadas",reported:"FONTE",source:"Fonte original",representative:"Foto ilustrativa",illustrative:"Foto ilustrativa",photo:"Foto",rights:"Licença da imagem",share:"Compartilhar",like:"Curtir",unlike:"Descurtir",privacy:"Privacidade",all:"Todas as notícias",footer:"Boas notícias verificadas e gratuitas.",pending:"Original em inglês · tradução pendente",machine:"Tradução automática · sem revisão editorial",original:"Ver fonte original",read:"Ler notícia",back:"Voltar ao GoodWorld",noTop:"Ainda não há favoritas.",noTopDetails:"Nenhuma história recebeu curtidas ainda. Explore as notícias recentes e curta suas favoritas.",browse:"Ver últimas notícias",noLatest:"Boas notícias estão a caminho.",noLatestDetails:"Publicamos apenas notícias de fontes verificadas. Tente atualizar mais tarde.",refresh:"Atualizar",profile:"Perfil",account:"Sua conta e curtidas",donate:"Doar",editor:"Redação",login:"Entrar",close:"Fechar",disclosure:"Traduções automáticas podem conter erros, especialmente em temas médicos e científicos. Consulte a fonte original.",unable:"Esta notícia não está disponível.",language:"Idioma"},
 id:{editorialIllustration:"Ilustrasi editorial",brandTagline:"Kabar baik terverifikasi, setiap hari.",menu:"Menu",label:"Berita positif independen",latest:"Terbaru",top:"Populer",latestTitle:"Berita terbaru",topTitle:"Paling populer",latestSub:"Berita baik terbaru dari seluruh dunia",topSub:"Cerita paling disukai sepanjang masa",sourceProof:"Berita baik dari sumber terverifikasi",reported:"SUMBER",source:"Sumber asli",representative:"Foto ilustrasi",illustrative:"Foto ilustrasi",photo:"Foto",rights:"Lisensi foto",share:"Bagikan",like:"Suka",unlike:"Batal suka",privacy:"Privasi",all:"Semua berita",footer:"Berita baik yang terverifikasi dan gratis.",pending:"Versi asli bahasa Inggris · terjemahan menyusul",machine:"Terjemahan mesin · belum ditinjau redaksi",original:"Baca sumber asli",read:"Baca berita",back:"Kembali ke GoodWorld",noTop:"Belum ada cerita populer.",noTopDetails:"Belum ada berita yang mendapat suka. Jelajahi berita terbaru dan sukai favorit Anda.",browse:"Lihat berita terbaru",noLatest:"Berita baik segera hadir.",noLatestDetails:"Kami hanya menerbitkan berita dengan sumber terverifikasi. Coba lagi nanti.",refresh:"Muat ulang",profile:"Profil",account:"Akun dan suka",donate:"Donasi",editor:"Editorial",login:"Masuk",close:"Tutup",disclosure:"Terjemahan mesin mungkin keliru, terutama istilah medis dan ilmiah. Periksa sumber asli.",unable:"Berita ini tidak tersedia.",language:"Bahasa"},
 ur:{editorialIllustration:"ادارتی تمثیل",brandTagline:"ہر روز تصدیق شدہ اچھی خبریں۔",menu:"مینو",label:"آزاد مثبت خبریں",latest:"تازہ ترین",top:"مقبول ترین",latestTitle:"تازہ ترین خبریں",topTitle:"سب سے مقبول",latestSub:"دنیا بھر سے نئی اچھی خبریں",topSub:"اب تک کی سب سے زیادہ پسند کی گئی خبریں",sourceProof:"مصدقہ ذرائع سے اچھی خبریں",reported:"ذریعہ",source:"اصل ذریعہ",representative:"نمائندہ تصویر",illustrative:"علامتی تصویر",photo:"تصویر",rights:"تصویر کا لائسنس",share:"شیئر کریں",like:"پسند",unlike:"ناپسند",privacy:"رازداری",all:"تمام خبریں",footer:"مصدقہ اچھی خبریں، سب کے لیے مفت۔",pending:"اصل انگریزی · ترجمہ زیرِ عمل",machine:"خودکار ترجمہ · ادارتی نظرثانی نہیں ہوئی",original:"اصل ذریعہ دیکھیں",read:"خبر پڑھیں",back:"GoodWorld پر واپس",noTop:"ابھی کوئی پسندیدہ خبر نہیں۔",noTopDetails:"ابھی کسی خبر کو لائک نہیں ملا۔ نئی خبریں دیکھیں اور اپنی پسندیدہ خبروں کو لائک کریں۔",browse:"تازہ خبریں دیکھیں",noLatest:"اچھی خبریں جلد آ رہی ہیں۔",noLatestDetails:"ہم صرف مصدقہ خبریں شائع کرتے ہیں۔ بعد میں تازہ کریں۔",refresh:"تازہ کریں",profile:"پروفائل",account:"آپ کا اکاؤنٹ",donate:"عطیہ",editor:"ادارتی",login:"سائن ان",close:"بند",disclosure:"خودکار ترجمے میں غلطیاں ہو سکتی ہیں، خصوصاً طبی اور سائنسی اصطلاحات میں۔ اصل ذریعہ دیکھیں۔",unable:"یہ خبر دستیاب نہیں۔",language:"زبان"},
 ru:{editorialIllustration:"Редакционная иллюстрация",brandTagline:"Проверенные хорошие новости каждый день.",menu:"Меню",label:"Независимые позитивные новости",latest:"Новые",top:"Топ",latestTitle:"Последние новости",topTitle:"Топ",latestSub:"Новые хорошие новости со всего мира",topSub:"Самые любимые истории за всё время",sourceProof:"Хорошие новости из проверенных источников",reported:"ИСТОЧНИК",source:"Первоисточник",representative:"Иллюстративное фото",illustrative:"Иллюстративное фото",photo:"Фото",rights:"Лицензия на фото",share:"Поделиться",like:"Нравится",unlike:"Убрать лайк",privacy:"Конфиденциальность",all:"Все новости",footer:"Проверенные хорошие новости, доступные бесплатно.",pending:"Английский оригинал · перевод готовится",machine:"Машинный перевод · без редакторской проверки",original:"Открыть первоисточник",read:"Читать новость",back:"Вернуться в GoodWorld",noTop:"Пока нет популярных историй.",noTopDetails:"Пока ни у одной истории нет лайков. Читайте новые публикации и отмечайте понравившиеся.",browse:"Смотреть новые",noLatest:"Хорошие новости скоро появятся.",noLatestDetails:"Мы публикуем только новости из проверенных источников. Попробуйте обновить страницу.",refresh:"Обновить",profile:"Профиль",account:"Аккаунт и лайки",donate:"Поддержать",editor:"Редакция",login:"Войти",close:"Закрыть",disclosure:"Машинный перевод может содержать ошибки, особенно в медицинских и научных терминах. Проверяйте первоисточник.",unable:"Новость недоступна.",language:"Язык"}
 };

 // New language interface dictionaries. Story translations remain editorially gated.
 Object.assign(DICT,{
 "de": {
  "brandTagline": "Jeden Tag geprüfte gute Nachrichten.",
  "menu": "Menü",
  "label": "Unabhängige positive Nachrichten",
  "latest": "Neu",
  "top": "Top",
  "latestTitle": "Neueste Nachrichten",
  "topTitle": "Beliebteste Geschichten",
  "latestSub": "Die neuesten guten Nachrichten aus aller Welt",
  "topSub": "Die beliebtesten Geschichten aller Zeiten",
  "sourceProof": "Gute Nachrichten aus geprüften Quellen",
  "reported": "BERICHT VON",
  "source": "Originalquelle",
  "editorialIllustration": "Redaktionelle Illustration",
  "representative": "Symbolfoto",
  "illustrative": "Illustrationsfoto",
  "photo": "Foto",
  "rights": "Bildrechte",
  "share": "Teilen",
  "like": "Gefällt mir",
  "unlike": "Gefällt mir nicht mehr",
  "privacy": "Datenschutz",
  "all": "Alle Geschichten",
  "footer": "Positive Nachrichten mit Quellenangaben, kostenlos für alle.",
  "pending": "Englisches Original · Übersetzung folgt",
  "machine": "Automatisch übersetzt · Nicht redaktionell geprüft",
  "original": "Originalquelle lesen",
  "read": "Artikel lesen",
  "back": "Zurück zu GoodWorld",
  "noTop": "Noch keine Favoriten.",
  "noTopDetails": "Noch hat keine Geschichte ein Like erhalten. Entdecke neue Geschichten und markiere deine Favoriten.",
  "browse": "Neueste Nachrichten entdecken",
  "noLatest": "Gute Nachrichten sind unterwegs.",
  "noLatestDetails": "Wir veröffentlichen nur relevante Nachrichten mit Quellenangaben. Bitte später aktualisieren.",
  "refresh": "Aktualisieren",
  "profile": "Profil",
  "account": "Dein Konto und deine Likes",
  "donate": "Spenden",
  "editor": "Redaktion",
  "login": "Anmelden",
  "close": "Schließen",
  "disclosure": "Maschinelle Übersetzungen können ungenau sein, insbesondere bei Medizin und Wissenschaft. Prüfe die Originalquelle.",
  "unable": "Diese Geschichte ist nicht verfügbar.",
  "language": "Sprache"
 },
 "it": {
  "brandTagline": "Buone notizie verificate, ogni giorno.",
  "menu": "Menu",
  "label": "Notizie positive indipendenti",
  "latest": "Novità",
  "top": "Top",
  "latestTitle": "Ultime notizie",
  "topTitle": "Le più apprezzate",
  "latestSub": "Le buone notizie più recenti dal mondo",
  "topSub": "Le storie più amate di sempre",
  "sourceProof": "Buone notizie da fonti verificate",
  "reported": "FONTE",
  "source": "Fonte originale",
  "editorialIllustration": "Illustrazione editoriale",
  "representative": "Foto rappresentativa",
  "illustrative": "Foto illustrativa",
  "photo": "Foto",
  "rights": "Diritti dell'immagine",
  "share": "Condividi",
  "like": "Mi piace",
  "unlike": "Non mi piace più",
  "privacy": "Privacy",
  "all": "Tutte le storie",
  "footer": "Notizie positive con fonti verificate, gratis per tutti.",
  "pending": "Originale in inglese · Traduzione in arrivo",
  "machine": "Traduzione automatica · Non revisionata",
  "original": "Leggi la fonte originale",
  "read": "Leggi la storia",
  "back": "Torna a GoodWorld",
  "noTop": "Ancora nessuna storia preferita.",
  "noTopDetails": "Nessuna storia ha ancora ricevuto un Mi piace. Scopri le ultime notizie e scegli le tue preferite.",
  "browse": "Scopri le ultime notizie",
  "noLatest": "Una bella notizia sta arrivando.",
  "noLatestDetails": "Pubblichiamo solo notizie significative e documentate. Riprova tra poco.",
  "refresh": "Aggiorna",
  "profile": "Profilo",
  "account": "Il tuo account e i tuoi Mi piace",
  "donate": "Dona",
  "editor": "Redazione",
  "login": "Accedi",
  "close": "Chiudi",
  "disclosure": "Le traduzioni automatiche possono essere imprecise, soprattutto per i termini medici e scientifici. Consulta la fonte originale.",
  "unable": "Questa storia non è disponibile.",
  "language": "Lingua"
 },
 "pl": {
  "brandTagline": "Sprawdzone dobre wiadomości każdego dnia.",
  "menu": "Menu",
  "label": "Niezależne pozytywne wiadomości",
  "latest": "Nowe",
  "top": "Top",
  "latestTitle": "Najnowsze wiadomości",
  "topTitle": "Najpopularniejsze",
  "latestSub": "Najnowsze dobre wiadomości ze świata",
  "topSub": "Najbardziej lubiane historie wszech czasów",
  "sourceProof": "Dobre wiadomości ze sprawdzonych źródeł",
  "reported": "ŹRÓDŁO",
  "source": "Oryginalne źródło",
  "editorialIllustration": "Ilustracja redakcyjna",
  "representative": "Zdjęcie poglądowe",
  "illustrative": "Zdjęcie ilustracyjne",
  "photo": "Zdjęcie",
  "rights": "Prawa do zdjęcia",
  "share": "Udostępnij",
  "like": "Lubię to",
  "unlike": "Nie lubię już tego",
  "privacy": "Prywatność",
  "all": "Wszystkie historie",
  "footer": "Dobre wiadomości ze źródłami, bezpłatnie dla wszystkich.",
  "pending": "Oryginał po angielsku · Tłumaczenie w przygotowaniu",
  "machine": "Tłumaczenie automatyczne · Bez weryfikacji redakcji",
  "original": "Przeczytaj oryginalne źródło",
  "read": "Czytaj historię",
  "back": "Wróć do GoodWorld",
  "noTop": "Jeszcze brak ulubionych.",
  "noTopDetails": "Żadna historia nie otrzymała jeszcze polubienia. Przejrzyj najnowsze i wybierz ulubione.",
  "browse": "Odkryj najnowsze historie",
  "noLatest": "Dobre wiadomości już wkrótce.",
  "noLatestDetails": "Publikujemy tylko ważne, potwierdzone wiadomości. Spróbuj odświeżyć stronę.",
  "refresh": "Odśwież",
  "profile": "Profil",
  "account": "Twoje konto i polubienia",
  "donate": "Wesprzyj",
  "editor": "Redakcja",
  "login": "Zaloguj się",
  "close": "Zamknij",
  "disclosure": "Tłumaczenia maszynowe mogą zawierać błędy, zwłaszcza w terminach medycznych i naukowych. Sprawdź oryginalne źródło.",
  "unable": "Ta historia jest niedostępna.",
  "language": "Język"
 },
 "nl": {
  "brandTagline": "Elke dag gecontroleerd goed nieuws.",
  "menu": "Menu",
  "label": "Onafhankelijk positief nieuws",
  "latest": "Nieuw",
  "top": "Top",
  "latestTitle": "Laatste nieuws",
  "topTitle": "Populairste verhalen",
  "latestSub": "Het nieuwste goede nieuws van overal ter wereld",
  "topSub": "De meest gewaardeerde verhalen ooit",
  "sourceProof": "Goed nieuws uit gecontroleerde bronnen",
  "reported": "BRON",
  "source": "Oorspronkelijke bron",
  "editorialIllustration": "Redactionele illustratie",
  "representative": "Representatieve foto",
  "illustrative": "Illustratieve foto",
  "photo": "Foto",
  "rights": "Beeldrechten",
  "share": "Delen",
  "like": "Vind ik leuk",
  "unlike": "Niet meer leuk",
  "privacy": "Privacy",
  "all": "Alle verhalen",
  "footer": "Positief nieuws met bronvermelding, gratis voor iedereen.",
  "pending": "Engels origineel · Vertaling volgt",
  "machine": "Automatisch vertaald · Niet redactioneel gecontroleerd",
  "original": "Lees de oorspronkelijke bron",
  "read": "Lees het verhaal",
  "back": "Terug naar GoodWorld",
  "noTop": "Nog geen favorieten.",
  "noTopDetails": "Er zijn nog geen verhalen geliket. Ontdek het laatste nieuws en kies je favorieten.",
  "browse": "Ontdek het laatste nieuws",
  "noLatest": "Er komt iets moois aan.",
  "noLatestDetails": "We publiceren alleen betrouwbaar nieuws met bronvermelding. Probeer opnieuw te laden.",
  "refresh": "Vernieuwen",
  "profile": "Profiel",
  "account": "Je account en vind-ik-leuks",
  "donate": "Doneren",
  "editor": "Redactie",
  "login": "Inloggen",
  "close": "Sluiten",
  "disclosure": "Automatische vertalingen kunnen onnauwkeurig zijn, vooral bij medische en wetenschappelijke termen. Controleer de oorspronkelijke bron.",
  "unable": "Dit verhaal is niet beschikbaar.",
  "language": "Taal"
 },
 "uk": {
  "brandTagline": "Перевірені хороші новини щодня.",
  "menu": "Меню",
  "label": "Незалежні позитивні новини",
  "latest": "Нові",
  "top": "Топ",
  "latestTitle": "Останні новини",
  "topTitle": "Найпопулярніші історії",
  "latestSub": "Найновіші хороші новини з усього світу",
  "topSub": "Улюблені історії наших читачів",
  "sourceProof": "Хороші новини з перевірених джерел",
  "reported": "ДЖЕРЕЛО",
  "source": "Першоджерело",
  "editorialIllustration": "Редакційна ілюстрація",
  "representative": "Ілюстративне фото",
  "illustrative": "Ілюстрація",
  "photo": "Фото",
  "rights": "Права на зображення",
  "share": "Поділитися",
  "like": "Подобається",
  "unlike": "Більше не подобається",
  "privacy": "Конфіденційність",
  "all": "Усі історії",
  "footer": "Хороші новини з посиланнями на джерела, безкоштовно для всіх.",
  "pending": "Англійський оригінал · Переклад готується",
  "machine": "Автоматичний переклад · Без редакторської перевірки",
  "original": "Читати першоджерело",
  "read": "Читати новину",
  "back": "Назад до GoodWorld",
  "noTop": "Поки немає улюблених історій.",
  "noTopDetails": "Жодна історія ще не отримала вподобань. Перегляньте останні новини та підтримайте улюблені.",
  "browse": "Переглянути останні новини",
  "noLatest": "Хороші новини вже скоро.",
  "noLatestDetails": "Ми публікуємо лише важливі новини з перевірених джерел. Оновіть сторінку пізніше.",
  "refresh": "Оновити",
  "profile": "Профіль",
  "account": "Ваш обліковий запис і вподобання",
  "donate": "Підтримати",
  "editor": "Редакція",
  "login": "Увійти",
  "close": "Закрити",
  "disclosure": "Автоматичні переклади можуть бути неточними, особливо в медицині та науці. Перевіряйте першоджерело.",
  "unable": "Ця історія недоступна.",
  "language": "Мова"
 },
 "ro": {
  "brandTagline": "Vești bune verificate, în fiecare zi.",
  "menu": "Meniu",
  "label": "Știri pozitive independente",
  "latest": "Noi",
  "top": "Top",
  "latestTitle": "Cele mai recente știri",
  "topTitle": "Cele mai apreciate",
  "latestSub": "Cele mai noi vești bune din întreaga lume",
  "topSub": "Poveștile preferate ale cititorilor",
  "sourceProof": "Vești bune din surse verificate",
  "reported": "SURSA",
  "source": "Sursa originală",
  "editorialIllustration": "Ilustrație editorială",
  "representative": "Fotografie reprezentativă",
  "illustrative": "Fotografie ilustrativă",
  "photo": "Fotografie",
  "rights": "Drepturi asupra imaginii",
  "share": "Distribuie",
  "like": "Îmi place",
  "unlike": "Nu-mi mai place",
  "privacy": "Confidențialitate",
  "all": "Toate poveștile",
  "footer": "Știri pozitive din surse verificate, gratuite pentru toți.",
  "pending": "Original în engleză · Traducerea este în curs",
  "machine": "Traducere automată · Neverificată editorial",
  "original": "Citește sursa originală",
  "read": "Citește povestea",
  "back": "Înapoi la GoodWorld",
  "noTop": "Nicio poveste favorită încă.",
  "noTopDetails": "Nicio poveste nu a primit încă aprecieri. Descoperă ultimele știri și alege-ți favoritele.",
  "browse": "Descoperă cele mai noi știri",
  "noLatest": "Veștile bune sunt pe drum.",
  "noLatestDetails": "Publicăm doar știri importante, din surse verificate. Încearcă să reîmprospătezi pagina.",
  "refresh": "Reîmprospătează",
  "profile": "Profil",
  "account": "Contul și aprecierile tale",
  "donate": "Donează",
  "editor": "Redacție",
  "login": "Conectare",
  "close": "Închide",
  "disclosure": "Traducerile automate pot fi inexacte, mai ales în domeniul medical și științific. Verifică sursa originală.",
  "unable": "Această poveste nu este disponibilă.",
  "language": "Limbă"
 },
 "tr": {
  "brandTagline": "Her gün doğrulanmış iyi haberler.",
  "menu": "Menü",
  "label": "Bağımsız olumlu haberler",
  "latest": "Yeni",
  "top": "En iyiler",
  "latestTitle": "Son haberler",
  "topTitle": "En beğenilenler",
  "latestSub": "Dünyanın dört bir yanından en yeni iyi haberler",
  "topSub": "Tüm zamanların en çok beğenilen hikâyeleri",
  "sourceProof": "Doğrulanmış kaynaklardan iyi haberler",
  "reported": "KAYNAK",
  "source": "Orijinal kaynak",
  "editorialIllustration": "Editoryal illüstrasyon",
  "representative": "Temsili fotoğraf",
  "illustrative": "Açıklayıcı fotoğraf",
  "photo": "Fotoğraf",
  "rights": "Görsel hakları",
  "share": "Paylaş",
  "like": "Beğen",
  "unlike": "Beğeniyi kaldır",
  "privacy": "Gizlilik",
  "all": "Tüm hikâyeler",
  "footer": "Kaynakları doğrulanmış iyi haberler, herkes için ücretsiz.",
  "pending": "İngilizce özgün metin · Çeviri hazırlanıyor",
  "machine": "Otomatik çeviri · Editör kontrolünden geçmedi",
  "original": "Orijinal kaynağı oku",
  "read": "Haberi oku",
  "back": "GoodWorld'e dön",
  "noTop": "Henüz favori yok.",
  "noTopDetails": "Henüz hiçbir hikâye beğenilmedi. Yeni haberlere göz atıp beğendiklerini seç.",
  "browse": "Son haberleri keşfet",
  "noLatest": "Güzel haberler yolda.",
  "noLatestDetails": "Yalnızca kaynakları doğrulanmış anlamlı haberler yayımlıyoruz. Daha sonra yenileyin.",
  "refresh": "Yenile",
  "profile": "Profil",
  "account": "Hesabın ve beğenilerin",
  "donate": "Bağış yap",
  "editor": "Editör",
  "login": "Giriş yap",
  "close": "Kapat",
  "disclosure": "Otomatik çeviriler, özellikle tıp ve bilim terimlerinde hatalı olabilir. Orijinal kaynağı kontrol edin.",
  "unable": "Bu hikâye görüntülenemiyor.",
  "language": "Dil"
 },
 "ja": {
  "brandTagline": "確かな明るいニュースを毎日。",
  "menu": "メニュー",
  "label": "独立したポジティブニュース",
  "latest": "新着",
  "top": "人気",
  "latestTitle": "最新ニュース",
  "topTitle": "人気のニュース",
  "latestSub": "世界の新しい明るいニュース",
  "topSub": "これまでに最も支持されたニュース",
  "sourceProof": "信頼できる情報源からの良いニュース",
  "reported": "情報源",
  "source": "元の記事",
  "editorialIllustration": "編集部によるイラスト",
  "representative": "参考写真",
  "illustrative": "イメージ写真",
  "photo": "写真",
  "rights": "画像の権利",
  "share": "共有",
  "like": "いいね",
  "unlike": "いいねを取り消す",
  "privacy": "プライバシー",
  "all": "すべての記事",
  "footer": "出典を明記した明るいニュースを無料でお届けします。",
  "pending": "英語の原文 · 翻訳準備中",
  "machine": "自動翻訳 · 編集部未確認",
  "original": "元の記事を読む",
  "read": "記事を読む",
  "back": "GoodWorldに戻る",
  "noTop": "まだ人気記事はありません。",
  "noTopDetails": "まだ「いいね」が付いた記事はありません。最新ニュースからお気に入りを探してください。",
  "browse": "最新ニュースを見る",
  "noLatest": "良いニュースを準備しています。",
  "noLatestDetails": "情報源を確認できた大切なニュースだけを掲載しています。しばらくして更新してください。",
  "refresh": "更新",
  "profile": "プロフィール",
  "account": "アカウントといいね",
  "donate": "寄付する",
  "editor": "編集部",
  "login": "ログイン",
  "close": "閉じる",
  "disclosure": "機械翻訳には誤りが含まれる可能性があります。特に医療・科学用語は原文をご確認ください。",
  "unable": "この記事は利用できません。",
  "language": "言語"
 },
 "ko": {
  "brandTagline": "매일 검증된 좋은 소식.",
  "menu": "메뉴",
  "label": "독립적인 긍정 뉴스",
  "latest": "최신",
  "top": "인기",
  "latestTitle": "최신 뉴스",
  "topTitle": "인기 뉴스",
  "latestSub": "전 세계의 새로운 좋은 소식",
  "topSub": "독자들이 가장 좋아한 이야기",
  "sourceProof": "검증된 출처의 좋은 소식",
  "reported": "출처",
  "source": "원문 출처",
  "editorialIllustration": "편집 삽화",
  "representative": "참고 사진",
  "illustrative": "설명 사진",
  "photo": "사진",
  "rights": "이미지 사용 권리",
  "share": "공유",
  "like": "좋아요",
  "unlike": "좋아요 취소",
  "privacy": "개인정보 보호",
  "all": "모든 기사",
  "footer": "출처가 확인된 좋은 소식을 누구나 무료로 읽을 수 있습니다.",
  "pending": "영어 원문 · 번역 준비 중",
  "machine": "자동 번역 · 편집 검토 전",
  "original": "원문 보기",
  "read": "기사 읽기",
  "back": "GoodWorld로 돌아가기",
  "noTop": "아직 인기 기사가 없습니다.",
  "noTopDetails": "아직 좋아요를 받은 기사가 없습니다. 최신 뉴스를 둘러보고 마음에 드는 기사를 선택하세요.",
  "browse": "최신 뉴스 살펴보기",
  "noLatest": "좋은 소식을 준비하고 있습니다.",
  "noLatestDetails": "출처가 확인된 의미 있는 소식만 게시합니다. 잠시 후 새로고침해 주세요.",
  "refresh": "새로고침",
  "profile": "프로필",
  "account": "내 계정과 좋아요",
  "donate": "후원하기",
  "editor": "편집",
  "login": "로그인",
  "close": "닫기",
  "disclosure": "자동 번역에는 특히 의학 및 과학 용어에서 오류가 있을 수 있습니다. 원문을 확인해 주세요.",
  "unable": "이 기사를 볼 수 없습니다.",
  "language": "언어"
 }
});

 // Shared UI copy for donations, navigation and informational links.
 Object.assign(BASE,{"supportTitle":"Support GoodWorld.","supportLead":"Good news should be free for everyone.","paypalTitle":"Donate with PayPal","paypalDescription":"Help keep independent positive news free.","paypalButton":"Donate with PayPal","paypalCheckout":"Secure checkout with PayPal. Give once, monthly or yearly.","paypalUnavailable":"PayPal donations are not available yet. You can support us with crypto below.","cryptoTitle":"Donate with cryptocurrency","cryptoDescription":"Choose the asset and network supported by your wallet.","cryptoLabel":"Coin / blockchain network","cryptoWarning":"Send ONLY %ASSET% on %NETWORK%. An incompatible network can cause permanent loss.","cryptoAddress":"Public receiving address","cryptoCopy":"Copy wallet address","cryptoNote":"Network fees may apply. Verify the destination and network carefully. Crypto transfers are generally irreversible.","donationDisclosure":"Contributions are voluntary, give no special access and are not tax-deductible charitable donations.","menuFree":"FREE FOR EVERYONE","menuSupportTitle":"Keep good news free.","menuSupportBody":"GoodWorld is free to explore. If you appreciate our work, help us keep it going.","about":"About","standards":"Editorial standards","credits":"Sources & photo credits","contact":"Contact"});
 for(const [code,values] of Object.entries({"ru":{"supportTitle":"Поддержите GoodWorld.","supportLead":"Хорошие новости должны быть бесплатными для всех.","paypalTitle":"Пожертвовать через PayPal","paypalDescription":"Помогите независимым позитивным новостям оставаться бесплатными.","paypalButton":"Поддержать через PayPal","paypalCheckout":"Безопасная оплата через PayPal. Разово, ежемесячно или ежегодно.","paypalUnavailable":"PayPal пока недоступен. Ниже можно поддержать проект криптовалютой.","cryptoTitle":"Пожертвовать криптовалютой","cryptoDescription":"Выберите монету и сеть, которые поддерживает ваш кошелёк.","cryptoLabel":"Монета / блокчейн","cryptoWarning":"Отправляйте ТОЛЬКО %ASSET% в сети %NETWORK%. При неправильной сети средства можно потерять.","cryptoAddress":"Адрес для получения","cryptoCopy":"Скопировать адрес","cryptoNote":"Возможна комиссия сети. Проверьте адрес и сеть: криптопереводы обычно необратимы.","donationDisclosure":"Пожертвования добровольные, не дают особого доступа и не предполагают налогового вычета.","menuFree":"БЕСПЛАТНО ДЛЯ ВСЕХ","menuSupportTitle":"Сохраним хорошие новости бесплатными.","menuSupportBody":"GoodWorld бесплатен для всех. Если вам нравится проект, поддержите его.","about":"О проекте","standards":"Редакционные стандарты","credits":"Источники и фотографии","contact":"Контакты"},"de":{"supportTitle":"GoodWorld unterstützen.","supportLead":"Gute Nachrichten sollten für alle kostenlos sein.","paypalTitle":"Mit PayPal spenden","paypalDescription":"Hilf mit, unabhängige positive Nachrichten kostenlos zu halten.","paypalButton":"Mit PayPal spenden","paypalCheckout":"Sicher über PayPal bezahlen. Einmalig, monatlich oder jährlich.","paypalUnavailable":"PayPal-Spenden sind noch nicht verfügbar. Unten kannst du Kryptowährungen nutzen.","cryptoTitle":"Mit Kryptowährungen spenden","cryptoDescription":"Wähle den passenden Coin und das richtige Netzwerk.","cryptoLabel":"Coin / Blockchain-Netzwerk","cryptoWarning":"Sende NUR %ASSET% über %NETWORK%. Ein falsches Netzwerk kann zum Verlust führen.","cryptoAddress":"Öffentliche Empfangsadresse","cryptoCopy":"Wallet-Adresse kopieren","cryptoNote":"Netzwerkgebühren können anfallen. Adresse und Netzwerk prüfen. Kryptowährungstransfers sind meist unwiderruflich.","donationDisclosure":"Spenden sind freiwillig, gewähren keinen Sonderzugang und sind nicht steuerlich als gemeinnützige Spenden absetzbar.","menuFree":"FÜR ALLE KOSTENLOS","menuSupportTitle":"Gute Nachrichten kostenlos halten.","menuSupportBody":"GoodWorld ist für alle kostenlos. Wenn dir unsere Arbeit gefällt, unterstütze sie.","about":"Über uns","standards":"Redaktionelle Standards","credits":"Quellen und Bildnachweise","contact":"Kontakt"},"uk":{"supportTitle":"Підтримайте GoodWorld.","supportLead":"Хороші новини мають бути безкоштовними для всіх.","paypalTitle":"Пожертвувати через PayPal","paypalDescription":"Підтримайте незалежні позитивні новини.","paypalButton":"Підтримати через PayPal","paypalCheckout":"Безпечна оплата через PayPal. Разово, щомісяця або щороку.","paypalUnavailable":"PayPal поки недоступний. Нижче можна підтримати нас криптовалютою.","cryptoTitle":"Пожертвувати криптовалютою","cryptoDescription":"Оберіть монету й мережу, які підтримує ваш гаманець.","cryptoLabel":"Монета / блокчейн","cryptoWarning":"Надсилайте ЛИШЕ %ASSET% через %NETWORK%. У разі помилки кошти можна втратити.","cryptoAddress":"Адреса для отримання","cryptoCopy":"Копіювати адресу","cryptoNote":"Можлива комісія мережі. Перевірте адресу та мережу. Криптоперекази зазвичай незворотні.","donationDisclosure":"Пожертви добровільні, не дають особливого доступу й не передбачають податкової пільги.","menuFree":"БЕЗКОШТОВНО ДЛЯ ВСІХ","menuSupportTitle":"Збережімо хороші новини безкоштовними.","menuSupportBody":"GoodWorld безкоштовний. Якщо цінуєте нашу роботу, підтримайте проєкт.","about":"Про нас","standards":"Редакційні стандарти","credits":"Джерела та автори фото","contact":"Контакти"},"fr":{"supportTitle":"Soutenez GoodWorld.","supportLead":"Les bonnes nouvelles devraient être gratuites pour tous.","paypalTitle":"Faire un don avec PayPal","paypalDescription":"Aidez les bonnes nouvelles indépendantes à rester gratuites.","paypalButton":"Faire un don avec PayPal","paypalCheckout":"Paiement sécurisé via PayPal. Une fois, chaque mois ou chaque année.","paypalUnavailable":"Les dons PayPal ne sont pas encore disponibles. Vous pouvez nous aider en cryptomonnaie ci-dessous.","cryptoTitle":"Donner en cryptomonnaie","cryptoDescription":"Choisissez l'actif et le réseau compatibles avec votre portefeuille.","cryptoLabel":"Monnaie / réseau blockchain","cryptoWarning":"Envoyez UNIQUEMENT %ASSET% via %NETWORK%. Une erreur de réseau peut entraîner une perte définitive.","cryptoAddress":"Adresse publique de réception","cryptoCopy":"Copier l'adresse","cryptoNote":"Des frais de réseau peuvent s'appliquer. Vérifiez l'adresse et le réseau. Les transferts crypto sont généralement irréversibles.","donationDisclosure":"Les dons sont volontaires, ne donnent aucun accès spécial et ne sont pas déductibles comme dons caritatifs.","menuFree":"GRATUIT POUR TOUS","menuSupportTitle":"Gardons les bonnes nouvelles gratuites.","menuSupportBody":"GoodWorld est gratuit. Si vous appréciez notre travail, soutenez-le.","about":"À propos","standards":"Charte éditoriale","credits":"Sources et crédits photo","contact":"Contact"},"es":{"supportTitle":"Apoya GoodWorld.","supportLead":"Las buenas noticias deben ser gratuitas para todos.","paypalTitle":"Donar con PayPal","paypalDescription":"Ayuda a mantener gratuitas las noticias positivas independientes.","paypalButton":"Donar con PayPal","paypalCheckout":"Pago seguro por PayPal. Una vez, mensual o anual.","paypalUnavailable":"Las donaciones PayPal todavía no están disponibles. Puedes ayudarnos con criptomonedas abajo.","cryptoTitle":"Donar con criptomonedas","cryptoDescription":"Elige el activo y la red compatibles con tu billetera.","cryptoLabel":"Moneda / red blockchain","cryptoWarning":"Envía SOLO %ASSET% por %NETWORK%. Una red equivocada puede causar pérdidas.","cryptoAddress":"Dirección pública de recepción","cryptoCopy":"Copiar dirección","cryptoNote":"Pueden aplicarse comisiones de red. Comprueba la dirección y la red. Los envíos de criptomonedas suelen ser irreversibles.","donationDisclosure":"Las aportaciones son voluntarias, no dan acceso especial y no son donaciones benéficas deducibles.","menuFree":"GRATIS PARA TODOS","menuSupportTitle":"Mantengamos gratis las buenas noticias.","menuSupportBody":"GoodWorld es gratuito. Si valoras nuestro trabajo, apóyanos.","about":"Acerca de","standards":"Normas editoriales","credits":"Fuentes y créditos fotográficos","contact":"Contacto"},"it":{"supportTitle":"Sostieni GoodWorld.","supportLead":"Le buone notizie dovrebbero essere gratuite per tutti.","paypalTitle":"Dona con PayPal","paypalDescription":"Aiuta a mantenere gratuite le notizie positive indipendenti.","paypalButton":"Dona con PayPal","paypalCheckout":"Pagamento sicuro con PayPal. Una tantum, mensile o annuale.","paypalUnavailable":"Le donazioni PayPal non sono ancora disponibili. Puoi usare le criptovalute qui sotto.","cryptoTitle":"Dona con criptovalute","cryptoDescription":"Scegli la valuta e la rete supportate dal tuo portafoglio.","cryptoLabel":"Moneta / rete blockchain","cryptoWarning":"Invia SOLO %ASSET% tramite %NETWORK%. Una rete errata può causare perdite.","cryptoAddress":"Indirizzo pubblico di ricezione","cryptoCopy":"Copia indirizzo","cryptoNote":"Potrebbero esserci commissioni di rete. Controlla indirizzo e rete. I trasferimenti cripto sono generalmente irreversibili.","donationDisclosure":"Le donazioni sono volontarie, non danno accesso speciale e non sono deducibili come donazioni benefiche.","menuFree":"GRATIS PER TUTTI","menuSupportTitle":"Manteniamo gratuite le buone notizie.","menuSupportBody":"GoodWorld è gratuito. Se apprezzi il progetto, sostienilo.","about":"Chi siamo","standards":"Standard editoriali","credits":"Fonti e crediti foto","contact":"Contatti"},"pl":{"supportTitle":"Wesprzyj GoodWorld.","supportLead":"Dobre wiadomości powinny być bezpłatne dla wszystkich.","paypalTitle":"Wesprzyj przez PayPal","paypalDescription":"Pomóż zachować bezpłatny dostęp do niezależnych dobrych wiadomości.","paypalButton":"Wesprzyj przez PayPal","paypalCheckout":"Bezpieczna płatność przez PayPal. Jednorazowo, miesięcznie lub rocznie.","paypalUnavailable":"Wpłaty przez PayPal nie są jeszcze dostępne. Możesz nas wesprzeć kryptowalutą.","cryptoTitle":"Wpłać kryptowalutę","cryptoDescription":"Wybierz monetę i sieć obsługiwane przez Twój portfel.","cryptoLabel":"Moneta / sieć blockchain","cryptoWarning":"Wysyłaj TYLKO %ASSET% przez %NETWORK%. Niewłaściwa sieć może spowodować utratę środków.","cryptoAddress":"Publiczny adres odbioru","cryptoCopy":"Skopiuj adres","cryptoNote":"Mogą wystąpić opłaty sieciowe. Sprawdź adres i sieć. Przelewy kryptowalut są zwykle nieodwracalne.","donationDisclosure":"Wpłaty są dobrowolne, nie zapewniają specjalnego dostępu i nie uprawniają do odliczeń podatkowych.","menuFree":"ZA DARMO DLA WSZYSTKICH","menuSupportTitle":"Pomóż zachować darmowe dobre wiadomości.","menuSupportBody":"GoodWorld jest bezpłatny. Jeśli doceniasz naszą pracę, wesprzyj ją.","about":"O nas","standards":"Standardy redakcyjne","credits":"Źródła i zdjęcia","contact":"Kontakt"},"nl":{"supportTitle":"Steun GoodWorld.","supportLead":"Goed nieuws moet voor iedereen gratis zijn.","paypalTitle":"Doneren met PayPal","paypalDescription":"Help onafhankelijk positief nieuws gratis te houden.","paypalButton":"Doneren met PayPal","paypalCheckout":"Veilige betaling via PayPal. Eenmalig, maandelijks of jaarlijks.","paypalUnavailable":"PayPal-donaties zijn nog niet beschikbaar. Je kunt hieronder met crypto steunen.","cryptoTitle":"Doneren met cryptovaluta","cryptoDescription":"Kies de juiste munt en het netwerk voor je wallet.","cryptoLabel":"Munt / blockchainnetwerk","cryptoWarning":"Stuur ALLEEN %ASSET% via %NETWORK%. Een verkeerd netwerk kan tot verlies leiden.","cryptoAddress":"Openbaar ontvangstadres","cryptoCopy":"Walletadres kopiëren","cryptoNote":"Er kunnen netwerkkosten zijn. Controleer adres en netwerk. Cryptotransacties zijn meestal onomkeerbaar.","donationDisclosure":"Donaties zijn vrijwillig, bieden geen speciale toegang en zijn niet fiscaal aftrekbaar als liefdadigheidsgift.","menuFree":"GRATIS VOOR IEDEREEN","menuSupportTitle":"Houd goed nieuws gratis.","menuSupportBody":"GoodWorld is gratis. Vind je ons werk waardevol? Steun het project.","about":"Over ons","standards":"Redactionele normen","credits":"Bronnen en fotovermelding","contact":"Contact"},"ro":{"supportTitle":"Susține GoodWorld.","supportLead":"Veștile bune ar trebui să fie gratuite pentru toți.","paypalTitle":"Donează prin PayPal","paypalDescription":"Ajută-ne să păstrăm gratuite știrile pozitive independente.","paypalButton":"Donează prin PayPal","paypalCheckout":"Plată sigură prin PayPal. O singură dată, lunar sau anual.","paypalUnavailable":"Donațiile prin PayPal nu sunt încă disponibile. Poți susține proiectul cu criptomonede.","cryptoTitle":"Donează criptomonede","cryptoDescription":"Alege moneda și rețeaua acceptate de portofelul tău.","cryptoLabel":"Monedă / rețea blockchain","cryptoWarning":"Trimite DOAR %ASSET% prin %NETWORK%. O rețea greșită poate duce la pierderea fondurilor.","cryptoAddress":"Adresă publică de primire","cryptoCopy":"Copiază adresa","cryptoNote":"Se pot aplica taxe de rețea. Verifică adresa și rețeaua. Transferurile crypto sunt de obicei ireversibile.","donationDisclosure":"Donațiile sunt voluntare, nu oferă acces special și nu sunt deductibile ca donații caritabile.","menuFree":"GRATUIT PENTRU TOȚI","menuSupportTitle":"Păstrăm veștile bune gratuite.","menuSupportBody":"GoodWorld este gratuit. Dacă apreciezi munca noastră, susține-ne.","about":"Despre noi","standards":"Standarde editoriale","credits":"Surse și credite foto","contact":"Contact"},"pt":{"supportTitle":"Apoie o GoodWorld.","supportLead":"Boas notícias devem ser gratuitas para todos.","paypalTitle":"Doe com PayPal","paypalDescription":"Ajude a manter gratuitas as notícias positivas independentes.","paypalButton":"Doe com PayPal","paypalCheckout":"Pagamento seguro pelo PayPal. Uma vez, mensalmente ou anualmente.","paypalUnavailable":"As doações pelo PayPal ainda não estão disponíveis. Você pode nos apoiar com criptomoedas abaixo.","cryptoTitle":"Doe com criptomoedas","cryptoDescription":"Escolha o ativo e a rede aceitos pela sua carteira.","cryptoLabel":"Moeda / rede blockchain","cryptoWarning":"Envie APENAS %ASSET% pela rede %NETWORK%. A rede errada pode causar perda permanente.","cryptoAddress":"Endereço público de recebimento","cryptoCopy":"Copiar endereço","cryptoNote":"Pode haver taxas de rede. Confira endereço e rede. Transferências cripto geralmente são irreversíveis.","donationDisclosure":"As contribuições são voluntárias, não dão acesso especial e não são doações beneficentes dedutíveis.","menuFree":"GRÁTIS PARA TODOS","menuSupportTitle":"Mantenha as boas notícias gratuitas.","menuSupportBody":"GoodWorld é gratuito. Se gosta do nosso trabalho, apoie-o.","about":"Sobre nós","standards":"Padrões editoriais","credits":"Fontes e créditos das fotos","contact":"Contato"},"tr":{"supportTitle":"GoodWorld'ü destekleyin.","supportLead":"İyi haberler herkes için ücretsiz olmalı.","paypalTitle":"PayPal ile bağış yapın","paypalDescription":"Bağımsız olumlu haberlerin ücretsiz kalmasını destekleyin.","paypalButton":"PayPal ile bağış yapın","paypalCheckout":"PayPal ile güvenli ödeme. Tek seferlik, aylık veya yıllık.","paypalUnavailable":"PayPal bağışları henüz kullanılamıyor. Aşağıdan kripto ile destek verebilirsiniz.","cryptoTitle":"Kripto para ile bağış yapın","cryptoDescription":"Cüzdanınızın desteklediği varlık ve ağı seçin.","cryptoLabel":"Coin / blokzincir ağı","cryptoWarning":"YALNIZCA %ASSET% varlığını %NETWORK% ağı üzerinden gönderin. Yanlış ağda fonlar kaybolabilir.","cryptoAddress":"Herkese açık alıcı adresi","cryptoCopy":"Cüzdan adresini kopyala","cryptoNote":"Ağ ücretleri uygulanabilir. Adresi ve ağı kontrol edin. Kripto transferleri genellikle geri alınamaz.","donationDisclosure":"Bağışlar gönüllüdür, özel erişim sağlamaz ve vergi indirimi sağlayan hayır bağışları değildir.","menuFree":"HERKES İÇİN ÜCRETSİZ","menuSupportTitle":"İyi haberleri ücretsiz tutalım.","menuSupportBody":"GoodWorld ücretsizdir. Çalışmalarımızı beğeniyorsanız destek olun.","about":"Hakkımızda","standards":"Yayın ilkeleri","credits":"Kaynaklar ve fotoğraf bilgileri","contact":"İletişim"}}))Object.assign(DICT[code]||(DICT[code]={}),values);

 // Donation and support UI for the remaining international reader locales.
 for(const [code,values] of Object.entries({"zh":{"supportTitle":"支持 GoodWorld。","supportLead":"好消息应该向所有人免费开放。","paypalTitle":"通过 PayPal 捐助","paypalDescription":"帮助独立的正面新闻继续免费提供。","paypalButton":"通过 PayPal 捐助","paypalCheckout":"通过 PayPal 安全支付，可选择单次、每月或每年捐助。","paypalUnavailable":"PayPal 捐助暂不可用。您仍可使用下方的加密货币方式支持我们。","cryptoTitle":"使用加密货币捐助","cryptoDescription":"请选择您的钱包支持的币种及网络。","cryptoLabel":"币种 / 区块链网络","cryptoWarning":"仅通过 %NETWORK% 网络发送 %ASSET%。使用错误的网络可能导致资产永久丢失。","cryptoAddress":"公开收款地址","cryptoCopy":"复制钱包地址","cryptoNote":"可能产生网络手续费。请仔细核对地址和网络。加密货币转账通常不可撤销。","donationDisclosure":"捐助完全自愿，不提供特殊访问权限，也不属于可享受税务减免的慈善捐款。","menuFree":"对所有人免费","menuSupportTitle":"让好消息继续免费传播。","menuSupportBody":"GoodWorld 对所有人免费开放。如果您认可我们的工作，欢迎支持。","about":"关于我们","standards":"编辑规范","credits":"新闻来源与图片署名","contact":"联系我们"},"hi":{"supportTitle":"GoodWorld का समर्थन करें।","supportLead":"अच्छी खबरें सभी के लिए निःशुल्क होनी चाहिए।","paypalTitle":"PayPal से दान करें","paypalDescription":"स्वतंत्र सकारात्मक समाचारों को निःशुल्क रखने में मदद करें।","paypalButton":"PayPal से दान करें","paypalCheckout":"PayPal पर सुरक्षित भुगतान करें। एक बार, हर महीने या हर साल दान कर सकते हैं।","paypalUnavailable":"PayPal से दान अभी उपलब्ध नहीं है। आप नीचे क्रिप्टोकरेंसी से सहयोग कर सकते हैं।","cryptoTitle":"क्रिप्टोकरेंसी से दान करें","cryptoDescription":"अपने वॉलेट के अनुकूल कॉइन और नेटवर्क चुनें।","cryptoLabel":"कॉइन / ब्लॉकचेन नेटवर्क","cryptoWarning":"केवल %NETWORK% नेटवर्क पर %ASSET% भेजें। गलत नेटवर्क से धन हमेशा के लिए खो सकता है।","cryptoAddress":"प्राप्ति का सार्वजनिक पता","cryptoCopy":"वॉलेट पता कॉपी करें","cryptoNote":"नेटवर्क शुल्क लग सकता है। पता और नेटवर्क ध्यान से जाँचें। क्रिप्टो लेनदेन सामान्यतः वापस नहीं होते।","donationDisclosure":"दान स्वैच्छिक हैं, विशेष पहुँच नहीं देते और कर में कटौती योग्य धर्मार्थ दान नहीं हैं।","menuFree":"सभी के लिए निःशुल्क","menuSupportTitle":"अच्छी खबरें निःशुल्क रखें।","menuSupportBody":"GoodWorld सभी के लिए निःशुल्क है। अगर आपको हमारा काम पसंद है, तो सहयोग करें।","about":"हमारे बारे में","standards":"संपादकीय मानक","credits":"स्रोत और फ़ोटो श्रेय","contact":"संपर्क"},"ar":{"supportTitle":"ادعم GoodWorld.","supportLead":"ينبغي أن تبقى الأخبار الجيدة مجانية للجميع.","paypalTitle":"تبرّع عبر PayPal","paypalDescription":"ساعدنا في إبقاء الأخبار الإيجابية المستقلة مجانية.","paypalButton":"تبرّع عبر PayPal","paypalCheckout":"دفع آمن عبر PayPal. يمكنك التبرع مرة واحدة أو شهريًا أو سنويًا.","paypalUnavailable":"التبرع عبر PayPal غير متاح حاليًا. يمكنك دعمنا بالعملات الرقمية أدناه.","cryptoTitle":"تبرّع بالعملات الرقمية","cryptoDescription":"اختر العملة والشبكة اللتين تدعمهما محفظتك.","cryptoLabel":"العملة / شبكة البلوك تشين","cryptoWarning":"أرسل %ASSET% فقط عبر شبكة %NETWORK%. قد يؤدي استخدام شبكة خاطئة إلى فقدان الأموال نهائيًا.","cryptoAddress":"عنوان الاستلام العام","cryptoCopy":"نسخ عنوان المحفظة","cryptoNote":"قد تُفرض رسوم شبكة. تحقق من العنوان والشبكة بعناية. تحويلات العملات الرقمية غير قابلة للاسترداد عادةً.","donationDisclosure":"التبرعات طوعية ولا تمنح وصولًا خاصًا وليست تبرعات خيرية معفاة من الضرائب.","menuFree":"مجاني للجميع","menuSupportTitle":"لنبقِ الأخبار الجيدة مجانية.","menuSupportBody":"GoodWorld مجاني للجميع. إذا قدّرت عملنا، فيمكنك دعمنا.","about":"من نحن","standards":"المعايير التحريرية","credits":"المصادر وحقوق الصور","contact":"اتصل بنا"},"bn":{"supportTitle":"GoodWorld-কে সহায়তা করুন।","supportLead":"ভালো খবর সবার জন্য বিনামূল্যে থাকা উচিত।","paypalTitle":"PayPal দিয়ে অনুদান দিন","paypalDescription":"স্বাধীন ইতিবাচক সংবাদ বিনামূল্যে রাখতে সাহায্য করুন।","paypalButton":"PayPal দিয়ে অনুদান দিন","paypalCheckout":"PayPal-এ নিরাপদ অর্থপ্রদান। একবার, মাসিক বা বার্ষিক অনুদান দিতে পারেন।","paypalUnavailable":"PayPal-এ অনুদান এখনো চালু হয়নি। নিচে ক্রিপ্টোকারেন্সির মাধ্যমে সহায়তা করতে পারেন।","cryptoTitle":"ক্রিপ্টোকারেন্সিতে অনুদান দিন","cryptoDescription":"আপনার ওয়ালেট সমর্থন করে এমন মুদ্রা ও নেটওয়ার্ক বেছে নিন।","cryptoLabel":"মুদ্রা / ব্লকচেইন নেটওয়ার্ক","cryptoWarning":"শুধু %NETWORK% নেটওয়ার্কে %ASSET% পাঠান। ভুল নেটওয়ার্কে অর্থ স্থায়ীভাবে হারিয়ে যেতে পারে।","cryptoAddress":"প্রাপক ওয়ালেটের ঠিকানা","cryptoCopy":"ওয়ালেটের ঠিকানা কপি করুন","cryptoNote":"নেটওয়ার্ক ফি লাগতে পারে। ঠিকানা ও নেটওয়ার্ক যাচাই করুন। ক্রিপ্টো লেনদেন সাধারণত ফেরানো যায় না।","donationDisclosure":"অনুদান সম্পূর্ণ স্বেচ্ছামূলক, বিশেষ সুবিধা দেয় না এবং করছাড়যোগ্য দাতব্য অনুদান নয়।","menuFree":"সবার জন্য বিনামূল্যে","menuSupportTitle":"ভালো খবর বিনামূল্যে রাখুন।","menuSupportBody":"GoodWorld সবার জন্য বিনামূল্যে। আমাদের কাজ ভালো লাগলে সহায়তা করুন।","about":"আমাদের সম্পর্কে","standards":"সম্পাদকীয় নীতিমালা","credits":"সূত্র ও ছবির স্বত্ব","contact":"যোগাযোগ"},"id":{"supportTitle":"Dukung GoodWorld.","supportLead":"Kabar baik seharusnya gratis untuk semua orang.","paypalTitle":"Donasi melalui PayPal","paypalDescription":"Bantu agar berita positif independen tetap gratis.","paypalButton":"Donasi melalui PayPal","paypalCheckout":"Pembayaran aman melalui PayPal. Donasi sekali, bulanan, atau tahunan.","paypalUnavailable":"Donasi PayPal belum tersedia. Anda masih dapat mendukung kami dengan kripto di bawah.","cryptoTitle":"Donasi dengan mata uang kripto","cryptoDescription":"Pilih aset dan jaringan yang didukung dompet Anda.","cryptoLabel":"Koin / jaringan blockchain","cryptoWarning":"Kirim HANYA %ASSET% melalui %NETWORK%. Salah jaringan dapat menyebabkan kehilangan dana secara permanen.","cryptoAddress":"Alamat penerima publik","cryptoCopy":"Salin alamat dompet","cryptoNote":"Biaya jaringan mungkin berlaku. Periksa alamat dan jaringan. Transfer kripto biasanya tidak dapat dibatalkan.","donationDisclosure":"Donasi bersifat sukarela, tidak memberikan akses khusus, dan bukan sumbangan amal yang dapat dikurangkan dari pajak.","menuFree":"GRATIS UNTUK SEMUA","menuSupportTitle":"Jaga agar kabar baik tetap gratis.","menuSupportBody":"GoodWorld gratis untuk semua. Jika menghargai pekerjaan kami, Anda dapat mendukungnya.","about":"Tentang kami","standards":"Standar redaksi","credits":"Sumber dan kredit foto","contact":"Kontak"},"ur":{"supportTitle":"GoodWorld کی مدد کریں۔","supportLead":"اچھی خبریں سب کے لیے مفت ہونی چاہئیں۔","paypalTitle":"PayPal سے عطیہ دیں","paypalDescription":"آزاد مثبت خبروں کو مفت رکھنے میں ہماری مدد کریں۔","paypalButton":"PayPal سے عطیہ دیں","paypalCheckout":"PayPal پر محفوظ ادائیگی۔ ایک بار، ماہانہ یا سالانہ عطیہ دے سکتے ہیں۔","paypalUnavailable":"PayPal سے عطیات ابھی دستیاب نہیں۔ آپ نیچے کرپٹو کرنسی سے مدد کر سکتے ہیں۔","cryptoTitle":"کرپٹو کرنسی سے عطیہ دیں","cryptoDescription":"اپنے والیٹ کے مطابق کرنسی اور نیٹ ورک منتخب کریں۔","cryptoLabel":"کرنسی / بلاک چین نیٹ ورک","cryptoWarning":"صرف %NETWORK% نیٹ ورک پر %ASSET% بھیجیں۔ غلط نیٹ ورک کے استعمال سے رقم ہمیشہ کے لیے ضائع ہو سکتی ہے۔","cryptoAddress":"وصولی کا عوامی پتہ","cryptoCopy":"والیٹ کا پتہ کاپی کریں","cryptoNote":"نیٹ ورک فیس لاگو ہو سکتی ہے۔ پتہ اور نیٹ ورک اچھی طرح چیک کریں۔ کرپٹو منتقلی عموماً واپس نہیں ہو سکتی۔","donationDisclosure":"عطیات رضاکارانہ ہیں، خصوصی رسائی نہیں دیتے اور ٹیکس میں کٹوتی کے قابل خیراتی عطیات نہیں ہیں۔","menuFree":"سب کے لیے مفت","menuSupportTitle":"اچھی خبریں مفت رکھیں۔","menuSupportBody":"GoodWorld سب کے لیے مفت ہے۔ اگر آپ کو ہمارا کام پسند ہے تو مدد کریں۔","about":"ہمارے بارے میں","standards":"ادارتی معیارات","credits":"ذرائع اور تصاویر کا کریڈٹ","contact":"رابطہ"},"ja":{"supportTitle":"GoodWorld を応援する。","supportLead":"良いニュースは誰でも無料で読めるべきです。","paypalTitle":"PayPal で寄付","paypalDescription":"独立した前向きなニュースを無料で届け続けるためにご協力ください。","paypalButton":"PayPal で寄付","paypalCheckout":"PayPal で安全に決済できます。1回限り・毎月・毎年の寄付を選べます。","paypalUnavailable":"PayPal での寄付は現在利用できません。以下の暗号資産で応援できます。","cryptoTitle":"暗号資産で寄付","cryptoDescription":"ウォレットが対応する通貨とネットワークを選んでください。","cryptoLabel":"通貨 / ブロックチェーンネットワーク","cryptoWarning":"%ASSET% は %NETWORK% ネットワークでのみ送金してください。誤ったネットワークでは資産を失うおそれがあります。","cryptoAddress":"受取用公開アドレス","cryptoCopy":"アドレスをコピー","cryptoNote":"ネットワーク手数料がかかる場合があります。送金先とネットワークを確認してください。通常、送金は取り消せません。","donationDisclosure":"寄付は任意で、特別なアクセス権は付与されず、税控除の対象となる慈善寄付ではありません。","menuFree":"誰でも無料","menuSupportTitle":"良いニュースを無料で届け続ける。","menuSupportBody":"GoodWorld は誰でも無料です。活動に共感いただけたら、ぜひ応援してください。","about":"GoodWorld について","standards":"編集方針","credits":"情報源と写真のクレジット","contact":"お問い合わせ"},"ko":{"supportTitle":"GoodWorld 후원하기.","supportLead":"좋은 소식은 누구나 무료로 읽을 수 있어야 합니다.","paypalTitle":"PayPal로 후원","paypalDescription":"독립적인 긍정 뉴스를 무료로 제공할 수 있도록 도와주세요.","paypalButton":"PayPal로 후원","paypalCheckout":"PayPal에서 안전하게 결제하세요. 일회성, 월간 또는 연간 후원을 선택할 수 있습니다.","paypalUnavailable":"현재 PayPal 후원을 이용할 수 없습니다. 아래에서 암호화폐로 후원할 수 있습니다.","cryptoTitle":"암호화폐로 후원","cryptoDescription":"지갑에서 지원하는 코인과 네트워크를 선택하세요.","cryptoLabel":"코인 / 블록체인 네트워크","cryptoWarning":"%ASSET%는 %NETWORK% 네트워크로만 보내세요. 잘못된 네트워크로 보내면 자산을 영구적으로 잃을 수 있습니다.","cryptoAddress":"공개 수신 주소","cryptoCopy":"지갑 주소 복사","cryptoNote":"네트워크 수수료가 발생할 수 있습니다. 주소와 네트워크를 확인하세요. 암호화폐 전송은 일반적으로 취소할 수 없습니다.","donationDisclosure":"후원은 자발적이며 특별 이용 권한을 제공하지 않고 세금 공제 대상 자선 기부가 아닙니다.","menuFree":"모두에게 무료","menuSupportTitle":"좋은 뉴스를 무료로 유지해 주세요.","menuSupportBody":"GoodWorld는 누구나 무료입니다. 저희 활동에 공감하신다면 후원해 주세요.","about":"소개","standards":"편집 기준","credits":"출처 및 사진 크레딧","contact":"문의"}}))Object.assign(DICT[code]||(DICT[code]={}),values);
 let lang="en", cache=null,cacheLang="en",categoryLabels={},seq=0;
 const supported=new Set(LANGS.map(x=>x[0]));
 const currentParam=new URLSearchParams(location.search).get("lang");
 const pathLanguage=/^\/(zh|hi|es|ar|fr|bn|pt|id|ur|ru|de|it|pl|nl|uk|ro|tr|ja|ko)\/$/.exec(location.pathname)?.[1]||null;
 function stored(){try{return localStorage.getItem("goodworld:language")}catch{return null}}
 const browserLang=(navigator.language||"en").toLowerCase().split("-")[0];
 lang=supported.has(pathLanguage)?pathLanguage:supported.has(currentParam)?currentParam:supported.has(stored())?stored():supported.has(browserLang)?browserLang:"en";
 function getLang(){return lang}
 function nativeLocale(){return LANGS.find(x=>x[0]===lang)?.[2]||"en-US"}
 function direction(){return ["ar","ur","yi"].includes(lang)?"rtl":"ltr"}
 function t(key){return (DICT[lang]||{})[key]||BASE[key]||key}
 function applyStatic(){
  document.documentElement.lang=lang;
  document.documentElement.dir=direction();
  const selector=document.getElementById("languageSelect");
  if(selector)selector.value=lang;
  const code=document.getElementById("languageCode");
  if(code)code.textContent=lang.toUpperCase();
  document.querySelectorAll("[data-gw-text]").forEach(el=>{el.textContent=t(el.dataset.gwText)});
  document.querySelectorAll("[data-gw-label]").forEach(el=>{el.setAttribute("aria-label",t(el.dataset.gwLabel))});
 }
 async function load(){
  const requested=lang,req=++seq;
  if(requested==="en"){cache=null;cacheLang="en";categoryLabels={};applyStatic();window.dispatchEvent(new Event("goodworld:translations-loaded"));return}
  try{
   const res=await fetch("/translations/"+encodeURIComponent(requested)+".json",{cache:"no-cache"});
   if(!res.ok)throw Error("Translations are not generated yet");
   const obj=await res.json();
   if(obj.language!==requested||!obj.stories||typeof obj.stories!=="object")throw Error("Invalid translation file");
   if(req!==seq||requested!==lang)return;
   cache=obj.stories;cacheLang=requested;categoryLabels=obj.category_labels||{};
  }catch{
   if(req!==seq||requested!==lang)return;
   cache=null;cacheLang=requested;categoryLabels={};
  }
  applyStatic();window.dispatchEvent(new Event("goodworld:translations-loaded"));
 }
 function categoryName(category){return categoryLabels?.[category]||category}
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
  lang=next;cache=null;cacheLang=next;categoryLabels={};
  try{localStorage.setItem("goodworld:language",next)}catch{}
  const url=new URL(location.href);
  if(next==="en")url.searchParams.delete("lang");else url.searchParams.set("lang",next);
  history.replaceState(history.state,"",url.pathname+url.search+url.hash);
  window.GWAnalytics?.track("language_change",{language:next,method:"selector"});
  const isHomepage=location.pathname==="/"||/^\/(zh|hi|es|ar|fr|bn|pt|id|ur|ru|de|it|pl|nl|uk|ro|tr|ja|ko)\/$/.test(location.pathname);
  if(isHomepage){
   location.assign(next==="en"?"/":PUBLISHED_LOCALE_CODES.has(next)?"/"+next+"/":"/?lang="+encodeURIComponent(next));
   return;
  }
  applyStatic();window.dispatchEvent(new Event("goodworld:language-changed"));
  load();
 }
 function init(){
  const el=document.getElementById("languageSelect");
  if(el){
   const europe=document.createElement("optgroup");
   europe.label="Europe";
   const other=document.createElement("optgroup");
   other.label="Worldwide";
   for(const [code,title] of LANGS){
    const option=document.createElement("option");option.value=code;option.textContent=title;option.lang=code;
    option.dir=code==="ar"||code==="ur"||code==="yi"?"rtl":"ltr";
    (EUROPEAN_CODES.has(code)?europe:other).appendChild(option);
   }
   el.replaceChildren(europe,other);
   el.addEventListener("change",()=>setLang(el.value));
  }
  applyStatic();load();
 }
 window.GW_I18N={LANGS,getLang,locale:nativeLocale,direction,t,translated,categoryName,setLang,load,applyStatic,missingTranslationLabel:()=>missingLabels[lang]||t("pending")};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
