# Verified name library for "A Name Written Into the Qur'an" prints.
# EVERY entry is source-checked against quran.com / corpus.quran.com before it ships.
#
# TWO HONEST TIERS (never blur them):
#   tier "in"   = the NAME ITSELF appears in the Qur'an (prophets, Maryam, Zayd,
#                 surah names). Copy: "a name Allah placed in the Qur'an."
#   tier "root" = the name's ROOT appears in a cited ayah (we quote that ayah).
#                 Copy: "from the root ___ ... the word Allah uses in ...".
#   We NEVER say a root-tier name "is in the Qur'an." That honesty is the brand.
#
# Fields (all strings; renderer wraps/sizes):
#   tag        header line (tier-appropriate)
#   arabic     the NAME with full harakat (zoom-QC every one)
#   translit   Latin spelling buyers search
#   root_letters  spaced root consonants in Arabic (Amiri), e.g. "ن و ر"
#   root_gloss    plain-English root meaning
#   line1      the emotional/QuranIc bridge line
#   ayah       the quoted ayah (English, in quotes) OR the "placed in" line
#   citation   Surah name + number:ayah
#   verify     internal note: exact source to confirm (not printed)

TAG_IN      = "A Name Allah Placed in the Qur'an"
TAG_ROOT    = "A Name Written Into the Qur'an"
TAG_MEANING = "The Meaning of a Name"  # tier 3: no Qur'anic claim, ever

NAMES = {
    # ---------- TIER: ROOT (name's root sits inside a cited ayah) ----------
    "noor": {
        "tier": "root", "tag": TAG_ROOT,
        "arabic": "نُور", "translit": "Noor",
        "root_letters": "ن و ر", "root_gloss": "to give light",
        "line1": "a word Allah chose to describe His own light",
        "ayah": "“Allah is the light of the heavens and the earth.”",
        "citation": "Surah An-Nur · 24:35",
        "verify": "24:35 Allahu nuru as-samawati wal-ard",
    },
    "layla": {
        "tier": "root", "tag": TAG_ROOT,
        "arabic": "لَيْلَى", "translit": "Layla",
        "root_letters": "ل ي ل", "root_gloss": "night",
        "line1": "from the word for the night Allah swears by",
        "ayah": "“By the night as it covers,”",
        "citation": "Surah Al-Layl · 92:1",
        "verify": "92:1 wal-layli idha yaghsha",
    },
    "sakina": {
        "tier": "root", "tag": TAG_ROOT,
        "arabic": "سَكِينَة", "translit": "Sakina",
        "root_letters": "س ك ن", "root_gloss": "stillness, tranquility",
        "line1": "the calm Allah sends down into believing hearts",
        "ayah": "“It is He who sent tranquility into the hearts of the believers.”",
        "citation": "Surah Al-Fath · 48:4",
        "verify": "48:4 huwa alladhi anzala as-sakinata fi qulubi al-mu'minin",
    },
    "huda": {
        "tier": "root", "tag": TAG_ROOT,
        "arabic": "هُدَى", "translit": "Huda",
        "root_letters": "ه د ي", "root_gloss": "guidance",
        "line1": "the very first thing Allah calls the Qur'an",
        "ayah": "“A guidance for those conscious of Allah.”",
        "citation": "Surah Al-Baqarah · 2:2",
        "verify": "2:2 hudan lil-muttaqin",
    },
    "yusra": {
        "tier": "root", "tag": TAG_ROOT,
        "arabic": "يُسْرَى", "translit": "Yusra",
        "root_letters": "ي س ر", "root_gloss": "ease",
        "line1": "the ease Allah promises alongside every hardship",
        "ayah": "“Indeed, with hardship comes ease.”",
        "citation": "Surah Ash-Sharh · 94:6",
        "verify": "94:6 inna ma'a al-'usri yusra",
    },
    "iman": {
        "tier": "root", "tag": TAG_ROOT,
        "arabic": "إِيمَان", "translit": "Iman",
        "root_letters": "أ م ن", "root_gloss": "faith, security",
        "line1": "the faith Allah made beloved to the heart",
        "ayah": "“Allah has made faith beloved to you and beautified it in your hearts.”",
        "citation": "Surah Al-Hujurat · 49:7",
        "verify": "49:7 habbaba ilaykumu al-imana wa zayyanahu fi qulubikum",
    },
    "karim": {
        "tier": "root", "tag": TAG_ROOT,
        "arabic": "كَرِيم", "translit": "Karim",
        "root_letters": "ك ر م", "root_gloss": "noble, generous",
        "line1": "a word Allah uses for His own noble throne",
        "ayah": "“So exalted is Allah, the Sovereign, the Truth; Lord of the Noble Throne.”",
        "citation": "Surah Al-Mu'minun · 23:116",
        "verify": "23:116 rabbu al-'arshi al-karim",
    },
    "jamil": {
        "tier": "root", "tag": TAG_ROOT,
        "arabic": "جَمِيل", "translit": "Jamil",
        "root_letters": "ج م ل", "root_gloss": "beauty",
        "line1": "the beautiful patience Yaqub held onto",
        "ayah": "“So patience is most beautiful.”",
        "citation": "Surah Yusuf · 12:18",
        "verify": "12:18 fa-sabrun jamil",
    },
    "hanan": {
        "tier": "root", "tag": TAG_ROOT,
        "arabic": "حَنَان", "translit": "Hanan",
        "root_letters": "ح ن ن", "root_gloss": "tenderness, affection",
        "line1": "the tenderness Allah gave as a gift from Himself",
        "ayah": "“And affection from Us, and purity, and he was conscious of Allah.”",
        "citation": "Surah Maryam · 19:13",
        "verify": "19:13 wa hananan min ladunna wa zakatan",
    },
    "salam": {
        "tier": "root", "tag": TAG_ROOT,
        "arabic": "سَلَام", "translit": "Salam",
        "root_letters": "س ل م", "root_gloss": "peace",
        "line1": "the greeting of the people of Paradise",
        "ayah": "“Their greeting therein will be, ‘Peace.’”",
        "citation": "Surah Ibrahim · 14:23",
        "verify": "14:23 tahiyyatuhum fiha salam",
    },
    "ridwan": {
        "tier": "root", "tag": TAG_ROOT,
        "arabic": "رِضْوَان", "translit": "Ridwan",
        "root_letters": "ر ض و", "root_gloss": "good pleasure, acceptance",
        "line1": "the pleasure of Allah, greater than Paradise itself",
        "ayah": "“And the pleasure of Allah is greater. That is the great attainment.”",
        "citation": "Surah At-Tawbah · 9:72",
        "verify": "9:72 wa ridwanun mina Allahi akbar",
    },
    "aisha": {
        "tier": "root", "tag": TAG_ROOT,
        "arabic": "عَائِشَة", "translit": "Aisha",
        "root_letters": "ع ي ش", "root_gloss": "life, living",
        "line1": "from the word for a pleasing, contented life",
        "ayah": "“He will be in a pleasant life.”",
        "citation": "Surah Al-Qari'ah · 101:7",
        "verify": "101:7 fahuwa fi 'ishatin radiyah",
    },
    "sabr": {
        "tier": "root", "tag": TAG_ROOT,
        "arabic": "صَابِر", "translit": "Sabir",
        "root_letters": "ص ب ر", "root_gloss": "patience, steadfastness",
        "line1": "the patience Allah promises to reward without measure",
        "ayah": "“The patient will be given their reward without measure.”",
        "citation": "Surah Az-Zumar · 39:10",
        "verify": "39:10 innama yuwaffa as-sabiruna ajrahum bighayri hisab",
    },

    # ---------- TIER: IN (the name itself appears in the Qur'an) ----------
    "maryam": {
        "tier": "in", "tag": TAG_IN,
        "arabic": "مَرْيَم", "translit": "Maryam",
        "root_letters": "", "root_gloss": "",
        "line1": "the only woman Allah names in the entire Qur'an",
        "ayah": "“Allah chose you and purified you above the women of the worlds.”",
        "citation": "Surah Ali 'Imran · 3:42",
        "verify": "name is a full surah (19); 3:42 istafaki wa tahharaki",
    },
    "yusuf": {
        "tier": "in", "tag": TAG_IN,
        "arabic": "يُوسُف", "translit": "Yusuf",
        "root_letters": "", "root_gloss": "",
        "line1": "a prophet given a whole surah in his name",
        "ayah": "“We relate to you the best of stories.”",
        "citation": "The opening of Surah Yusuf · 12:3",
        "verify": "name at 12:4; surah 12 titled Yusuf; 12:3 is the surah's opening line (no name) — cited as the opening, not as the naming ayah",
    },
    "ibrahim": {
        "tier": "in", "tag": TAG_IN,
        "arabic": "إِبْرَاهِيم", "translit": "Ibrahim",
        "root_letters": "", "root_gloss": "",
        "line1": "the one Allah Himself took as a close friend",
        "ayah": "“And Allah took Ibrahim as an intimate friend.”",
        "citation": "Surah An-Nisa · 4:125",
        "verify": "4:125 wattakhadha Allahu Ibrahima khalila",
    },
    "yahya": {
        "tier": "in", "tag": TAG_IN,
        "arabic": "يَحْيَى", "translit": "Yahya",
        "root_letters": "", "root_gloss": "",
        "line1": "a name Allah Himself chose, given to no one before",
        "ayah": "“O Zakariya, We give you good tidings of a boy named Yahya, a name We have not given anyone before.”",
        "citation": "Surah Maryam · 19:7",
        "verify": "19:7 lam naj'al lahu min qablu samiyya",
    },
    "zayd": {
        "tier": "in", "tag": TAG_IN,
        "arabic": "زَيْد", "translit": "Zayd",
        "root_letters": "", "root_gloss": "",
        "line1": "the only companion of the Prophet named in the Qur'an",
        "ayah": "“So when Zayd had ended his need of her, We married her to you.”",
        "citation": "Surah Al-Ahzab · 33:37",
        "verify": "33:37 falamma qada Zaydun minha wataran zawwajnakaha",
    },
    "luqman": {
        "tier": "in", "tag": TAG_IN,
        "arabic": "لُقْمَان", "translit": "Luqman",
        "root_letters": "", "root_gloss": "",
        "line1": "the wise man Allah gave a surah and named for wisdom",
        "ayah": "“And We had certainly given Luqman wisdom.”",
        "citation": "Surah Luqman · 31:12",
        "verify": "31:12 wa laqad atayna Luqmana al-hikmah",
    },
    "musa": {
        "tier": "in", "tag": TAG_IN,
        "arabic": "مُوسَى", "translit": "Musa",
        "root_letters": "", "root_gloss": "",
        "line1": "the prophet Allah spoke to directly, named more than any other",
        "ayah": "“And Allah spoke to Musa with [direct] speech.”",
        "citation": "Surah An-Nisa · 4:164",
        "verify": "4:164 wa kallama Allahu Musa taklima",
    },
    "isa": {
        "tier": "in", "tag": TAG_IN,
        "arabic": "عِيسَى", "translit": "Isa",
        "root_letters": "", "root_gloss": "",
        "line1": "the Messiah, honored in this world and the next",
        "ayah": "“His name will be the Messiah, Isa, son of Maryam, honored in this world and the Hereafter.”",
        "citation": "Surah Ali 'Imran · 3:45",
        "verify": "3:45 ismuhu al-masihu 'Isa ibnu Maryama wajihan",
    },
    "sulayman": {
        "tier": "in", "tag": TAG_IN,
        "arabic": "سُلَيْمَان", "translit": "Sulayman",
        "root_letters": "", "root_gloss": "",
        "line1": "the prophet-king given a kingdom like no other after him",
        "ayah": "“And We gave to Dawud, Sulayman. An excellent servant, ever turning back to Allah.”",
        "citation": "Surah Sad · 38:30",
        "verify": "38:30 wa wahabna li-Dawuda Sulaymana ni'ma al-'abd",
    },
    "idris": {
        "tier": "in", "tag": TAG_IN,
        "arabic": "إِدْرِيس", "translit": "Idris",
        "root_letters": "", "root_gloss": "",
        "line1": "a prophet of truth Allah raised to a high station",
        "ayah": "“And mention Idris. Indeed, he was a man of truth, a prophet. And We raised him to a high station.”",
        "citation": "Surah Maryam · 19:56-57",
        "verify": "19:56-57 innahu kana siddiqan nabiyya wa rafa'nahu makanan 'aliyya",
    },
    # ---------- TIER: MEANING (Arabic name, root NOT in the Qur'an) ----------
    # No ayah, no citation, never a Qur'anic claim. Meaning + (verified) heritage
    # note only. This is how we cover any Arabic name honestly (e.g. Aws).
    "aws": {
        "tier": "meaning", "tag": TAG_MEANING,
        "arabic": "أَوْس", "translit": "Aws",
        "root_letters": "أ و س", "root_gloss": "a gift, a bestowal",
        "line1": "carried by one of the Ansar tribes of Madinah",
        "ayah": "", "citation": "",
        "verify": "meaning 'gift/bestowal' (Aws/aws); Banu Aws = one of the two "
                  "Ansar tribes of Madinah (with Khazraj). Root not in Qur'an. "
                  "Confirm meaning + heritage line before ship.",
    },
}

# The first 8 names to render into the listing mockups (highest search volume,
# balanced boy/girl, both tiers represented):
LAUNCH_SET = ["noor", "maryam", "yusuf", "aisha", "ibrahim", "layla", "zayd", "huda"]
