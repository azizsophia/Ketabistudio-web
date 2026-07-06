# Verified du'a content for the Etsy decks. Qur'anic Arabic pulled from quran.com
# (Uthmani); hadith wording + gradings confirmed via research. Every item HIGH
# confidence EXCEPT deck2 #8 (see ACCURACY_FLAGS). Arabic stored as full strings;
# the renderer line-wraps. For hadith-based Arabic, a human should still eyeball
# harakat against sunnah.com before final publish (sunnah.com was egress-blocked
# during compilation, so wording was verified via search snippets).

DECK1 = [
    {"tag": "FOR WHEN THE WALLS CLOSE IN",
     "arabic": "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَأَعُوذُ بِكَ مِنَ الْعَجْزِ وَالْكَسَلِ، وَأَعُوذُ بِكَ مِنَ الْجُبْنِ وَالْبُخْلِ، وَأَعُوذُ بِكَ مِنْ غَلَبَةِ الدَّيْنِ وَقَهْرِ الرِّجَالِ",
     "translit": "Allahumma inni a'udhu bika minal-hammi wal-hazan, wa a'udhu bika minal-'ajzi wal-kasal, wa a'udhu bika minal-jubni wal-bukhl, wa a'udhu bika min ghalabatid-dayni wa qahrir-rijal",
     "translation": "O Allah, I seek refuge in You from anxiety and grief, from incapacity and laziness, from cowardice and miserliness, and from being overcome by debt and overpowered by men.",
     "source": "Sahih al-Bukhari 6369"},
    {"tag": "WHEN SOMETHING IS TAKEN FROM YOU",
     "arabic": "إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ، اللَّهُمَّ أْجُرْنِي فِي مُصِيبَتِي وَأَخْلِفْ لِي خَيْرًا مِنْهَا",
     "translit": "Inna lillahi wa inna ilayhi raji'un, Allahumma'jurni fi musibati wa akhlif li khayran minha",
     "translation": "To Allah we belong and to Him we return. O Allah, reward me in my affliction and replace it for me with something better.",
     "source": "Sahih Muslim 918"},
    {"tag": "FOR A FRIGHTENED HEART",
     "arabic": "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ",
     "translit": "A'udhu bikalimatil-lahit-tammati min sharri ma khalaq",
     "translation": "I seek refuge in the perfect words of Allah from the evil of what He has created.",
     "source": "Sahih Muslim 2708"},
    {"tag": "WHEN YOUR FAITH FEELS UNSTEADY",
     "arabic": "يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ",
     "translit": "Ya muqallibal-qulubi thabbit qalbi 'ala dinik",
     "translation": "O Turner of hearts, make my heart firm upon Your religion.",
     "source": "Jami' at-Tirmidhi 3522 (hasan)"},
    {"tag": "WHEN YOU HAVE WRONGED YOUR OWN SOUL",
     "arabic": "رَبَّنَا ظَلَمْنَا أَنْفُسَنَا وَإِنْ لَمْ تَغْفِرْ لَنَا وَتَرْحَمْنَا لَنَكُونَنَّ مِنَ الْخَاسِرِينَ",
     "translit": "Rabbana zalamna anfusana wa in lam taghfir lana wa tarhamna lanakunanna minal-khasirin",
     "translation": "Our Lord, we have wronged ourselves, and if You do not forgive us and have mercy on us, we will surely be among the losers.",
     "source": "Qur'an 7:23 (the du'a of Adam)"},
    {"tag": "WHEN THE DARKNESS FEELS LAYERED",
     "arabic": "لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
     "translit": "La ilaha illa Anta subhanaka inni kuntu minaz-zalimin",
     "translation": "There is no god but You; glory be to You. Indeed, I was among the wrongdoers.",
     "source": "Qur'an 21:87 (du'a of Yunus). The Prophet said no distressed person makes it but Allah answers. (Tirmidhi 3505)"},
    {"tag": "WHEN DEBT WEIGHS ON YOU",
     "arabic": "اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ، وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ",
     "translit": "Allahumma-kfini bihalalika 'an haramik, wa aghnini bifadlika 'amman siwak",
     "translation": "O Allah, suffice me with what You have made lawful against what You have made unlawful, and enrich me by Your grace so I need none besides You.",
     "source": "Jami' at-Tirmidhi 3563 (hasan)"},
    {"tag": "WHEN ILLNESS TOUCHES YOU",
     "arabic": "رَبِّ أَنِّي مَسَّنِيَ الضُّرُّ وَأَنْتَ أَرْحَمُ الرَّاحِمِينَ",
     "translit": "Rabbi anni massaniyad-durru wa anta arhamur-rahimin",
     "translation": "My Lord, adversity has truly touched me, and You are the Most Merciful of the merciful.",
     "source": "Qur'an 21:83 (du'a of Ayyub)"},
    {"tag": "WHEN EVERYTHING FEELS TOO HARD",
     "arabic": "اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا، وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا",
     "translit": "Allahumma la sahla illa ma ja'altahu sahla, wa anta taj'alul-hazna idha shi'ta sahla",
     "translation": "O Allah, there is no ease except what You make easy, and You make the difficult, if You will, easy.",
     "source": "Sahih Ibn Hibban 2427 (sahih, al-Albani)"},
    {"tag": "WHEN WORRY STEALS YOUR SLEEP",
     "arabic": "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ غَضَبِهِ وَعِقَابِهِ، وَشَرِّ عِبَادِهِ، وَمِنْ هَمَزَاتِ الشَّيَاطِينِ وَأَنْ يَحْضُرُونِ",
     "translit": "A'udhu bikalimatil-lahit-tammati min ghadabihi wa 'iqabih, wa sharri 'ibadih, wa min hamazatish-shayatini wa an yahdurun",
     "translation": "I seek refuge in the perfect words of Allah from His anger and His punishment, from the evil of His servants, and from the whisperings of the devils and their coming near me.",
     "source": "Sunan Abi Dawud 3893 / Tirmidhi 3528 (hasan)"},
    {"tag": "WHEN YOU MUST LET GO AND TRUST",
     "arabic": "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ",
     "translit": "Hasbunal-lahu wa ni'mal-wakil",
     "translation": "Allah is sufficient for us, and He is the best Disposer of affairs.",
     "source": "Qur'an 3:173"},
    {"tag": "A SHIELD FROM UNSEEN HARM",
     "arabic": "رَبِّ أَعُوذُ بِكَ مِنْ هَمَزَاتِ الشَّيَاطِينِ وَأَعُوذُ بِكَ رَبِّ أَنْ يَحْضُرُونِ",
     "translit": "Rabbi a'udhu bika min hamazatish-shayatin, wa a'udhu bika rabbi an yahdurun",
     "translation": "My Lord, I seek refuge in You from the incitements of the devils, and I seek refuge in You, my Lord, lest they be present with me.",
     "source": "Qur'an 23:97-98"},
    {"tag": "WHEN ANGER RISES IN YOU",
     "arabic": "أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ",
     "translit": "A'udhu billahi minash-shaytanir-rajim",
     "translation": "I seek refuge in Allah from the accursed Satan.",
     "source": "Sahih al-Bukhari 3282 & Sahih Muslim 2610"},
    {"tag": "FOR FEET THAT MUST STAY FIRM",
     "arabic": "رَبَّنَا أَفْرِغْ عَلَيْنَا صَبْرًا وَثَبِّتْ أَقْدَامَنَا وَانْصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ",
     "translit": "Rabbana afrigh 'alayna sabran wa thabbit aqdamana wansurna 'alal-qawmil-kafirin",
     "translation": "Our Lord, pour patience upon us, make our feet firm, and grant us victory over the disbelieving people.",
     "source": "Qur'an 2:250"},
]

# Deck 2 (Morning & Evening Adhkar) — 14 items compiled + verified. Full Arabic in
# the research record; several are long (Ayat al-Kursi, the 3 Quls, Sayyid al-
# Istighfar) and need a long-text card layout. Build after Deck 1 ships.
# ACCURACY_FLAGS:
#   deck2 #8 (Hasbiyallahu... x7): the verse is Qur'an 9:129 (rock solid), but the
#   "recite 7x morning/evening" reward narration (Abu Dawud 5081) is DA'IF (weak).
#   DECISION: keep the verse as a tawakkul card WITHOUT the 7x reward claim, OR
#   swap for Juwayriyah's tasbih (Sahih Muslim 2726). Do not print the weak reward.
