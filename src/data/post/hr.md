---
title: ♥ 61 bpm
publishDate: 2026-07-15
excerpt: There is a heart beating on my homepage. It is mine, on an exactly 24 hour delay. How it works, from a Garmin Descent Mk3 to one honest subtraction.
draft: true
---

There is a small red heart on my homepage now. It beats. The number next to it is my actual
heart rate, and the heart pulses at that frequency: 48 bpm means one thump every 1.25 seconds,
80 bpm means one every 0.75. I wrote this up not because the world needs another integration
post, but because I wanted to, and because the design ended up containing more interesting
decisions than I expected when I started.

## the watch

<!-- TODO: replace with a photo of my actual watch: drop it at public/posts/hr/descent-mk3.jpg -->
![Garmin Descent Mk3, 43 mm, carbon gray DLC titanium](/posts/hr/descent-mk3.jpg)

I wear a [Garmin Descent Mk3](https://www.garmin.com/en-US/p/852183/), 43 mm, carbon gray DLC
titanium. I bought it as my primary dive computer, alongside my Shearwater Perdix 2, because
technical diving and overhead environments demand redundancy: if a computer dies at 75 m
inside a cave, "surface and fix it" is not on the menu. Since April 2025 it has been on 400+
dives with me, including to 100 m.

It also never comes off. Between dives it tracks my heart rate, sleep score, HRV, steps,
calories, and a dozen other vitals around the clock, and syncs everything to the Garmin
Connect app on my Pixel 9 Pro. My gym and streetlifting sessions get logged on it too. Which
means Garmin already holds a continuous, granular physiological record of my life. The only
question was how to get it out.

## the green dot, but visceral

Old messaging apps had the green dot. Facebook Messenger, Gchat before it: a small indicator
that said this person is here right now. I wanted that for my website, except the green dot
always felt like a statement about a socket, not a person. A heartbeat is the least abstract
"online" there is. It is the difference between "his browser has a connection open" and "he
is alive, and here is the proof, updating". In the end it is just a number on a page, I get
that. But it is my number, from my chest, and that makes it the most personal thing on the
site.

The longer-term idea, when motivation strikes, is a section of this site that shows all of
it: workouts, sleep, HRV, the whole exhaustive record, public. A granular ledger of a life. I
understand what that leaks. All-day heart rate reveals when I sleep and wake. Gaps and
timezone shifts reveal travel. A resting heart rate that jumps 8 bpm flags illness, stress,
or last night's drinks. HRV trends are a decent proxy for mental state, and a regular gym
schedule advertises exactly when I am not home. I have sat with all of that and decided I am
fine with it. Consent given, moving on.

## surely someone has done this

My first thought was that this must already exist, and characteristically I started designing
before I looked. When I finally did look, the trail was well worn. Twitch streamers have been
putting live heart rate on screen for years through services like
[Pulsoid](https://blog.pulsoid.net/post/garmin-devices-supported-by-pulsoid) and
[HypeRate](https://www.hyperate.io/), and both support Garmin watches. They work by putting
the watch into its
[broadcast heart rate](https://support.garmin.com/en-US/?faq=Zj1947s6pqAHzBCAhLhrC9) mode,
where it streams over BLE/ANT+ to a phone app that relays the number to their servers. That
was a dead end for me twice over. Garmin's own manuals warn that broadcasting decreases
battery life, and this watch is my dive computer; I will not trade dive-day battery for a
website widget. And broadcast is a mode you switch on and stay in range of. It is a job,
where I wanted a fact.

The browser itself can speak Bluetooth, which briefly seemed promising. The
[Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) can
read the standard heart rate GATT service directly from a nearby device. Neat trick, wrong
shape: it connects the visitor's browser to a device near the visitor. My wrist is not near
my visitors. It would only ever work on my own machine, in a Chromium browser, with the watch
in the broadcast mode I had already rejected.

Surely then there is a real API. There is: Garmin's
[Health API](https://developer.garmin.com/gc-developer-program/health-api/) serves exactly
this data, and access is gated behind a business application and review. It is built for
companies integrating wearables into products, not for one person who wants a heart on his
homepage.

At this point I did what I should have done first and searched GitHub instead of Google. Two
projects kept surfacing in Reddit threads. [GarminDB](https://github.com/tcgoetz/GarminDB)
downloads your entire Garmin history into a local SQLite database and gives you analysis and
plots on top. Impressive, and wrong for this: I do not need an archive with a schema, I need
one day of heart rate as JSON, fresh every morning, in CI.
[python-garminconnect](https://github.com/cyberjunky/python-garminconnect) is the right
tool: a Python client that speaks the same private API the Garmin Connect app uses. Log in
the way the app logs in, call the endpoints the app calls. It exposes essentially everything
I can see on my phone, which also quietly solves the someday-ledger problem, because
workouts, sleep, and HRV are all reachable from the same client.

## why it is not live

Live was never actually on the table, and it took me a minute to accept why. The watch does
not stream anywhere by default: all-day heart rate accumulates on the wrist and reaches
Garmin's servers in batches, whenever the phone syncs. Without broadcast mode there is no
feed to subscribe to. And my site is static, Astro built once and served as files from GitHub
Pages. There is no server to hold a websocket open, and I like it that way.

So the widget replays yesterday. When you load my homepage at 14:32 your time, you see my
heart rate at 14:32 yesterday, interpolated from real samples. The label says "live". That is
a white lie, and it is my website, so I get to tell it. The rule I hold myself to is that the
lie is precise: the offset is exactly 24 hours, the data is real, and nothing is synthesized
beyond drawing straight lines between measurements.

## auth, once

python-garminconnect logs in with email and password and hands back OAuth tokens good for
about a year. The password should never reach CI, so the login happens exactly once, locally:

```bash
python3 -m venv .venv
source .venv/bin/activate.fish
pip3 install garminconnect
python3 scripts/garmin_login.py
```

The login script prompts for credentials, handles MFA, saves token files to
`~/.garminconnect`, and writes the same tokens as a single base64 blob, which becomes a
repository secret:

```bash
gh secret set GARMINTOKENS_BASE64 --repo snehankekre/snehankekre.github.io < ~/.garminconnect.b64
```

Garmin rate-limited my IP during login. Both of the library's mobile login strategies came
back with a `429` ("IP rate limited by Garmin"), and then a fallback strategy in its chain
quietly succeeded anyway. Tokens acquired. It was a one-time toll: CI never logs in at all,
it only replays tokens, so the login endpoint never sees it again.

## the fetch

A small Python script runs in CI before every build of the site. The heart of it:

```python
garmin = Garmin()
garmin.login(tokens)  # a token dir path, or the base64 blob from the secret

tz = ZoneInfo(os.environ.get("HR_TZ", "Asia/Makassar"))
target = (datetime.now(tz) - timedelta(days=1)).date()

data = garmin.get_heart_rates(target.isoformat())
```

Two details bit me here. `garminconnect` 0.3.x accepts either a token directory or the base64
blob in the same `login()` call (strings longer than 512 characters are treated as blobs), so
the identical script runs on my Mac and in CI. And timezones: GitHub runners live in UTC, and
at 3 a.m. in Bali it is still yesterday in UTC, so a naive `date.today() - 1` fetches the
wrong day. "Yesterday" has to be computed in my timezone, not the runner's.

The output is `public/hr.json`, about 14 KB:

```json
{"date":"2026-07-13","resting":48,"points":[[1783872000000,56],[1783872120000,56],...]}
```

Roughly 717 samples, one every ~2 minutes, timestamps in absolute epoch milliseconds GMT.
That absoluteness matters shortly.

The script is not allowed to fail. Watch didn't sync, tokens expired, Garmin down: it logs
the reason and exits 0 without writing the file. The build proceeds, the widget finds no data
and hides. The failure mode is absence, never breakage. Two cron triggers refresh the deploy,
at 3 a.m. Bali time when the day completes and again at noon to catch a late phone sync, and
the JSON ships inside the static build like any other file. Nothing is committed anywhere;
the repo never accumulates a year of heartbeat diffs.

## the replay

The browser fetches `/hr.json` and, every 10 seconds, evaluates a single target instant:

```js
const bpm = sample(Date.now() - 86_400_000);
```

That subtraction is the entire timezone story. Garmin's timestamps and `Date.now()` are both
absolute epoch milliseconds, so a visitor in Tokyo and a visitor in New York ask the same
question, "what was his heart doing exactly 24 hours ago", and get the same correct answer.
No timezone math survives contact with this design, which is the best thing I can say about
any timezone design.

Garmin samples every ~2 minutes, and a number that changes once per 2 minutes reads as dead.
Real monitors drift. So between the two real samples bracketing the target instant, the
widget reads off the straight line connecting them. Say the target `t` falls at 10:00:50,
between a sample of 62 bpm at 10:00:00 and one of 68 bpm at 10:02:00:

```
68 ┤                      ● next
   │                 ◌  ← reading at t
62 ┤ ● prev
   └─┬─────────┬──────────┬──
   10:00    10:00:50    10:02
```

The fraction of the way across is `f = 50/120 ≈ 0.417`, and the reading is
`62 + 0.417 × (68 − 62) = 64.5`, rounded to 65:

```js
const f = (t - prev[0]) / (next[0] - prev[0]);   // 0 at prev, 1 at next
return Math.round(prev[1] + f * (next[1] - prev[1]));
```

Ticking every 10 seconds walks the reading along that chord: 62, 63, 63, 64, 65. Organic
drift, zero invention. Every displayed value lies on a straight line between two real
measurements, which is exactly what the Garmin app's own daily graph draws.

Interpolation has a hidden assumption, though: that the bracketing samples are adjacent, two
minutes apart. The data has real holes, because sometimes the watch is on a charger. Suppose
it was off my wrist from 14:00 to 17:00. The naive code would take 71 bpm at 14:00 and 58 bpm
at 17:00 and happily "interpolate" three hours of smooth, plausible, entirely invented
readings between them. The guard is a threshold I set at 20 minutes: if the two samples
around the target are further apart than that, the widget refuses to interpolate and hides
instead. Twenty minutes is comfortably wider than Garmin's sampling interval (which stretches
to 5 or 10 minutes in deep sleep), so normal data never trips it, and narrow enough that a
real gap hides the widget quickly rather than presenting a three-hour-old number as current.

The last problem is midnight. The file covers one Bali calendar day and refreshes at 3 a.m.,
so between midnight and the refresh, `now − 24h` points past the end of the data, and the
widget would vanish every single night. One line fixes it:

```js
if (t > last) t -= DAY;  // just past the data? replay the same time, one day earlier
```

A visitor at 1:30 a.m. briefly gets 1:30 a.m. from two days ago instead of nothing, which for
a widget whose entire premise is a replay seems like a fair trade. The elegant part is that
the same line is the staleness guard, because it rewinds at most once. If the pipeline dies
and the file goes stale for days, even the rewound target misses the data and the widget
hides. The wraparound grants at most 24 hours of grace and can never dress up week-old data
as current.

## the beat

The pulse is data, not decoration. The script writes a CSS variable, `--beat`, set to
`60/bpm` seconds, and the animation simply reads it:

```css
.hr-heart {
  animation: hr-beat var(--beat, 1s) ease-out infinite;
}
```

So 48 bpm visibly beats slower than 80 bpm. The keyframes do a lub-dub double bump, because a
single scale pulse looked like a notification badge rather than a heart. And
`prefers-reduced-motion` disables the animation entirely; the number still updates.

## the bill

Total running cost: zero. No server, no third-party relay, no battery impact (the watch
syncs exactly as it did before), no new moving parts beyond one Python script and two cron
lines. The only maintenance on the horizon is the token expiring in about a year, at which
point the widget silently disappears and I rerun one login script.

Next, someday: the workouts. The same client that fetches heart rate can fetch every
streetlifting session I have ever logged. The ledger wants to exist.
