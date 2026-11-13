# Aloha Training – store listings (en-US)

*12 November 2026 · version 1 · for Google Play Console (en-US) and later App Store Connect*

Target market: USA. Based on the Polish listing (`2026-11-10-karty-sklepowe-pl.md`), rewritten in natural US English –
not a word-for-word translation. Same rules: no „no watch needed” claim until the app records runs (GPS),
no promises of features that are not in the build.

Note: the app shows distances in km and temperature in °C. Until imperial units ship, the copy avoids
specific distances in miles and uses race names (5K, 10K, half marathon, marathon).

---

## Google Play (Android)

**App name (limit 30)**
```
Aloha Training: Running Plan
```

**Short description (limit 80)**
```
A running plan that asks how you feel and adapts your training to your day.
```

**Full description (limit 4000)**
```
Aloha Training is a running plan that asks how you feel – and fits your training to your day, not the other way around.

You have work, family, and the occasional rough night. A rigid training plan doesn't get that: you miss one run, then another, and suddenly it feels like the whole plan fell apart. Aloha Training works differently.

ONE QUESTION BEFORE YOU RUN
"How are you feeling today?" Tap an answer and add a quick note if you like: "short on time", "slept badly", "something hurts". That's it – a few seconds.

A TRAINING PLAN THAT ADAPTS TO YOU
When it makes sense, Aloha suggests a change: a shorter run, an easier pace, or a different day. Always with a short explanation of why. Accept it with one tap or keep your plan as is – it's your call.

RUNNING WITHOUT THE GUILT
A bad day isn't a failure. It's a plan change. Aloha talks like a running coach who's also a good friend: clear, human, and never judgmental.

WHO IT'S FOR
• Beginners: run-walk intervals and a calm path to your first 5K.
• Getting back into running after a break.
• Training plans for a 5K, 10K, half marathon or marathon.
• Running regularly when no two weeks look the same.

WHAT'S INSIDE
• A running plan built around your goal, your level and the days you actually have time.
• A "Today" view and a training calendar.
• Every run broken down step by step.
• Coach tips for each workout.
• An AI coach you can talk to about your training – always within safe training rules.
• Next week's plan built from how this week went.
• Weather-aware tips on the best time to run.
• Light and dark mode.

SAFE BY DESIGN
Every plan change is checked against training rules: gradual load increases, recovery after hard sessions, an easy return after a break. When in doubt, the plan picks the gentler option.

YOUR DATA
No ads. We don't sell your data. Delete your account and data anytime in the app settings.

Aloha Training is not a medical device and does not replace medical advice. If you have health concerns, talk to your doctor before you start training.
```

**Category:** Health & Fitness. **Tags:** running, training, fitness.

---

## App Store (iOS)

The description is the Google Play one with the opening line shortened – App Store search ignores the description,
so it doesn't need repeated keyword phrases. These texts also live in `apps/mobile/store.config.json` (`eas metadata:push`).

**App name (limit 30)**
```
Aloha Training: Running Plan
```

**Subtitle (limit 30)**
```
Training that fits your day
```

**Promotional text (limit 170, can change without review)**
```
A bad day isn't a failure. It's a plan change. Tell Aloha how you feel and it fits today's run to your day. No guilt.
```

**Keywords (limit 100, no spaces after commas; no words repeated from the name and subtitle)**
```
run,runner,beginner,5k,10k,half marathon,marathon,coach,jogging,run walk,workout,fitness,pace,cardio
```

**Category:** primary – Health & Fitness; secondary – Sports.

---

## To do before publishing

- „Weather-aware tips” – the weather card is in the app (location-based); remove the line if the module is off in the release build.
- „Delete your account… in the app settings” – true once the account deletion branch (`claude/nice-bardeen-90ade4`) is released.
- AI coach name „Keanu Biegała” is a Polish pun – consider an English name before the US launch (not mentioned in the copy).
