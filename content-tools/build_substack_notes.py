#!/usr/bin/env python3
# A month of Substack Notes (From One Root). Substack has no reliable Notes API,
# so this writes a clean, paste-ready markdown file: 30 Notes, one per root,
# hook-first for a reading audience, with a suggested day + the cover image to
# attach. Every 7th Note carries a soft subscribe nudge. Verified content.
import os

D = os.path.dirname(os.path.abspath(__file__))

# (root-key, note text). Cover to attach = content-tools/_reel_covers/cover_<key>.jpg
NOTES = [
("rahma",
 "In Arabic, the word for mercy and the word for the womb come from the same three letters. Rahma. Rahim.\n\n"
 "The Prophet, peace be upon him, taught that Allah created the womb and named it from His own Name, Ar-Rahman.\n\n"
 "Your very first home was named after His mercy. You have never once been anywhere it could not reach you."),
("qalb",
 "The Arabic word for heart, qalb, does not come from a word about love. It comes from qalaba: to turn something over.\n\n"
 "The classical scholars said the heart is called qalb because it never stops turning.\n\n"
 "So if yours keeps swinging between near and far, it is not broken. It is doing the one thing a heart was built to do."),
("fitra",
 "Fitra is usually translated as your natural disposition. The root, fatara, means to split open, the way dawn splits the night. It is also the word for creating something for the very first time.\n\n"
 "Your faith is not something you install. It is something you were made with, and keep returning to."),
("nur",
 "Of every word Allah could have used to describe Himself, He chose light. Allahu nuru as-samawati wal-ard.\n\n"
 "You do not look at light. You look by it. It is the thing that lets you see everything else.\n\n"
 "Guidance works exactly the same way."),
("huda",
 "Before the Qur'an calls itself anything else, it calls itself a guide. Hudan lil-muttaqin.\n\n"
 "Not a rulebook first. A guide, the way a friend who knows the road walks ahead of you in the dark.\n\n"
 "The first thing the Book wants you to know is that you were never meant to find the way alone."),
("kataba",
 "In Arabic, one verb means both to write and to decree. Kataba.\n\n"
 "What Allah ordains is, in the grammar itself, something written.\n\n"
 "The parts of your life you would never have chosen were not accidents. They were written, by the One who already knows how the story ends."),
("khalq",
 "Creation is khalq. Character is khuluq. The same three letters.\n\n"
 "The scholars said they are one word in origin: khalq is the form your eye sees, khuluq the form seen with insight.\n\n"
 "Which means your character is a made thing. And made things can be remade.\n\n"
 "(I spend a month tracing words like this in a journal called From One Root. If it is your language too, subscribe and I will keep sending them.)"),
("dhikr",
 "The old grammarians split dhikr in two: remembering Allah in the heart, and mentioning Him on the tongue.\n\n"
 "In Arabic, remembrance is allowed to be out loud. Under your breath on a commute. In a waiting room.\n\n"
 "And the promise tied to it is simple: in it, hearts find the rest they have been looking for everywhere else."),
("dua",
 "Du'a is not a ritual word. Its root simply means to call someone, the way you would call a name across a house.\n\n"
 "In one single ayah about du'a, Allah uses the root three times, and answers before the sentence is even finished: I am near.\n\n"
 "You are not filing a request. You are calling out, and Someone is already listening."),
("ibadah",
 "The Arabs called a road worn smooth by many feet mu'abbad. It is the same root as 'ibadah, worship.\n\n"
 "Worship is a path: rough the first time, easier the hundredth.\n\n"
 "If it feels like walking on stones right now, keep walking. The feet always come before the smoothness."),
("shukr",
 "The Arabs called an animal shakur when it visibly thrived on very little feed.\n\n"
 "That is the picture inside the word for gratitude: something that turns a little into flourishing.\n\n"
 "If you are grateful, I will surely increase you. Thankfulness is not the receipt for the blessing. It is the seed of the next one."),
("sadaqah",
 "Charity in Arabic, sadaqah, does not come from a word about money. It comes from sidq: truthfulness.\n\n"
 "The Prophet, peace be upon him, said charity is proof.\n\n"
 "When you give, your hand testifies that your heart meant what it said about trusting Allah."),
("taqwa",
 "Taqwa gets translated as fear of Allah. But its root, wiqayah, means a shield.\n\n"
 "The one who has taqwa is not trembling. They are armored, moving through the world with awareness of Him wrapped around them.\n\n"
 "The Qur'an calls it the best thing you can pack for the journey."),
("barakah",
 "The root picture behind barakah is a camel kneeling down to stay.\n\n"
 "Barakah is not more. It is what makes the little you have sit down, settle, and stretch further than it should.\n\n"
 "Some homes have less and hold more. Now you have the word for why.\n\n"
 "(This is the kind of thing I write every week. Subscribe if it is your language too.)"),
("sabr",
 "Sabr is not gritting your teeth until it passes. Its root means to hold, to restrain, to keep something in place.\n\n"
 "Patience is the strength that keeps you standing where you are meant to stand while the storm argues with you.\n\n"
 "And it is the one deed the Qur'an says is rewarded without measure."),
("yusr",
 "The Qur'an does not say ease comes after hardship. It says with. Inna ma'a al-'usri yusra: with the hardship, ease. Same moment, same road.\n\n"
 "Somewhere inside the hardest season you have carried, something was quietly being made easy for you.\n\n"
 "You usually only meet it looking back."),
("tawakkul",
 "A wakil is the person you hand your affairs to because they can do what you cannot.\n\n"
 "Tawakkul is choosing Allah for that role.\n\n"
 "It is not passive. You tie the camel, you do the work, and then you hand over the one part that was never yours to carry: the outcome."),
("sakinah",
 "Sakinah, tranquility, shares a root with maskan: a dwelling. It is calm that moves in and lives with you.\n\n"
 "And in the Qur'an it is always sent down, arriving into hearts mid-storm: in the cave, on the battlefield, exactly where the fear was.\n\n"
 "Peace here is not the absence of the storm. It is a Resident."),
("iman",
 "Iman, faith, and amn, safety, are the same root.\n\n"
 "To believe, in Arabic, is to enter somewhere you are finally safe.\n\n"
 "Belief was never a set of positions you defend. It is a shelter you live in."),
("dunya",
 "This world's own name is a quiet warning. Dunya means the lower one, the nearer one, from the same root as adna, lesser.\n\n"
 "Arabic never calls this life the world. It calls it the near one, the way you would describe a waiting room.\n\n"
 "Beautiful sometimes. Never the destination."),
("rizq",
 "In its classical meaning, rizq is anything that reaches you and benefits you, and the scholars named two kinds: the seen, like food, and the hidden, like knowledge.\n\n"
 "Your rizq includes the friend who came at the right time, the ayah that found you, the sleep that finally came.\n\n"
 "All of it allotted. None of it owed.\n\n"
 "(One root, every week. Subscribe if you want them in your inbox.)"),
("wadud",
 "Arabic has many words for love. For Himself, Allah chose Al-Wadud, from wudd: love that shows.\n\n"
 "Not a feeling stored somewhere unseen. Affection you can point to, arriving in your life as one kindness after another.\n\n"
 "His love for you has evidence. Go looking for it today."),
("latif",
 "Al-Latif holds two meanings Arabic will not separate: utterly gentle, and aware of the most hidden things.\n\n"
 "His gentleness is not generic. He is gentle with you because He sees the weight you never mention, the thing under the thing.\n\n"
 "Should He not know, the ayah asks, when He is the Subtle, the Acquainted."),
("hanan",
 "Hanan is the melting kind of tenderness, the sound in a voice that misses someone.\n\n"
 "The Qur'an says Allah gave it to the young prophet Yahya as a gift from His own presence: tenderness from Us.\n\n"
 "Your softness is not a flaw survival forgot to delete. It is something He gives on purpose, from close by."),
("jamil",
 "When Yaqub, peace be upon him, lost his son, he did not call his patience heavy or bitter. He called it beautiful. Fa sabrun jamil.\n\n"
 "Arabic lets a wound and beauty share one sentence.\n\n"
 "So can a life."),
("karim",
 "Karam is generosity and nobility fused into one word: giving that comes from greatness of soul, not from having extra.\n\n"
 "The Qur'an hangs it on the highest things, the Noble Throne, the Noble Qur'an, and Allah calls Himself Al-Karim.\n\n"
 "When you give beyond what makes sense, you are not being reckless. You are resembling something high."),
("ilm",
 "The scholars who first mapped Arabic noticed that 'alam, the world, sits under the root of 'ilm, knowledge.\n\n"
 "The world is how its Maker is known, the way a signpost points past itself.\n\n"
 "Read that way, every leaf is literature. Study was never separate from worship. The universe is the syllabus."),
("jannah",
 "One root that means to conceal. From it: jannah, the hidden garden. Janin, the child hidden in the womb. Junna, a shield.\n\n"
 "The most precious things in this faith share a grammar of hiddenness.\n\n"
 "What you cannot see is not what is missing. It is what is being kept.\n\n"
 "(I trace one root like this every week. Subscribe to follow along.)"),
("salam",
 "Salam is more than the absence of conflict. Its root means to be whole, intact, unbroken.\n\n"
 "It is the greeting of this faith, a Name of Allah, and the first word the people of Paradise hear.\n\n"
 "When you wish someone salam, you are not just wishing them quiet. You are wishing them wholeness, from the Source of it."),
("ridwan",
 "The Qur'an describes Paradise, the rivers, the gardens, the eternal homes, and then says something startling: and the pleasure of Allah is greater.\n\n"
 "Ridwan, His being pleased with you, outranks Paradise inside Paradise's own description.\n\n"
 "We started thirty roots ago with mercy, your first address. This is where the whole language was walking you: not just to be saved, but to be smiled upon."),
]


def build(start_date):
    from datetime import date, timedelta
    y, m, dd = map(int, start_date.split("-"))
    d0 = date(y, m, dd)
    lines = [
        "# From One Root, a month of Substack Notes",
        "",
        "Paste one per day into Substack (Notes tab, or schedule them). Attach the",
        "matching cover image where noted. Post around 8-9am or 7-9pm your time; reply",
        "to a few other Notes each day so the network surfaces yours. Nothing here is",
        "unverified, each is a root from the journal.",
        "",
        "---",
        "",
    ]
    for i, (key, text) in enumerate(NOTES):
        the_date = (d0 + timedelta(days=i)).strftime("%a %b %-d")
        lines.append(f"## Day {i+1} · {the_date} · {key}")
        lines.append(f"*attach: cover_{key}.jpg*")
        lines.append("")
        lines.append(text)
        lines.append("")
        lines.append("---")
        lines.append("")
    out = os.path.join(D, "substack_notes_month.md")
    with open(out, "w") as f:
        f.write("\n".join(lines))
    # sanity checks
    joined = "\n".join(t for _, t in NOTES)
    assert "—" not in joined, "em dash found"
    print(f"WROTE {len(NOTES)} notes -> {out}")
    print("em-dash:", "—" in joined, "| notes:", len(NOTES))
    return out


if __name__ == "__main__":
    import sys
    build(sys.argv[1] if len(sys.argv) > 1 else "2026-07-08")
