---
title: ♥ 61 bpm
publishDate: 2026-07-15
excerpt: There is a heart beating on my homepage. It is mine, on an exactly 24 hour delay. Notes on how it works, a Garmin Descent Mk3, a private API, and one honest subtraction.
draft: true
---

There is a small red heart on my homepage now. It beats. The number next to it is my actual
heart rate, and the heart pulses at that frequency: 48 bpm means one thump every 1.25 seconds.
This is a note to myself on how it works and why it exists, written mostly so that
future-me can remember what past-me was thinking.

## the watch

<!-- TODO: replace with a photo of my actual watch: drop it at public/posts/hr/descent-mk3.jpg -->
![Garmin Descent Mk3, 43 mm, carbon gray DLC titanium](/posts/hr/descent-mk3.jpg)

I wear a [Garmin Descent Mk3](https://www.garmin.com/en-US/p/852183/), 43 mm, carbon gray DLC
titanium. I bought it as my primary dive computer, alongside my Shearwater Perdix 2. Two
computers, because technical diving and overhead environments demand redundancy: if a computer
dies at 75 m inside a cave, "surface and fix it" is not on the menu. Since April 2025 it has
been on 400+ dives with me, including to 100 m.

It also never comes off. It tracks my heart rate, sleep score, HRV, steps, calories, and a
dozen other vitals around the clock, and syncs everything to the Garmin Connect app on my
Pixel 9 Pro. My gym and streetlifting sessions get logged on it too. So Garmin already has a
continuous, granular physiological record of my life. The only question was how to get it out.

## the green dot, but visceral

Old messaging apps had the green dot. Facebook Messenger, Gchat before it: a little indicator
that said this person is here right now. I wanted that for my website, but the green dot
always felt like a statement about a socket, not a person. A heartbeat is the least
abstract "online" there is. It is the difference between "his browser has a connection open"
and "he is alive, and here is the proof, updating".

Is it just a number on a page? Sure. But it is my number, from my chest, and that makes it the
most personal thing on the site.

## the ledger, someday

The longer-term idea, when motivation strikes, is a section of this site that shows all of it:
workouts, sleep, HRV, the whole exhaustive record, public. A granular ledger of a life.

I understand what that leaks. All-day heart rate reveals when I sleep and wake. Gaps and
timezone shifts reveal travel. A resting heart rate that jumps 8 bpm flags illness, stress, or
last night's drinks. HRV trends are a decent proxy for mental state. A regular gym schedule
advertises exactly when I am not home. I have sat with all of that and decided I am fine with
it. Consent given, moving on.

## surely someone has done this

My first thought was that this must already exist, and I did not even look before wanting to
build it. Classic. When I did look:

**Twitch streamers do it.** Services like [Pulsoid](https://blog.pulsoid.net/post/garmin-devices-supported-by-pulsoid)
and [HypeRate](https://www.hyperate.io/) put live heart rate overlays on streams, and both
support Garmin watches. They work by having the watch
[broadcast heart rate](https://support.garmin.com/en-US/?faq=Zj1947s6pqAHzBCAhLhrC9) over
BLE/ANT+ to a phone app that relays it to their servers. Two problems for me. Garmin's own
manuals warn that broadcasting decreases battery life, and this watch is my dive computer: I
will not trade dive-day battery for a website widget. And broadcast mode is something you turn
on and stay in range of, which is a job, not a fact about me.

**The browser can speak Bluetooth.** The [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
can read the standard heart rate GATT service directly. Neat trick, wrong shape: it connects
the visitor's browser to a nearby device. My wrist is not near my visitors. It would only ever
work on my own machine, in Chromium, with the watch in broadcast mode. Three strikes.

**Garmin has a real API.** The [Health API](https://developer.garmin.com/gc-developer-program/health-api/)
serves exactly the data I want, but access is gated behind a business application and review.
It is built for companies integrating wearables, not for one person who wants a heart on his
homepage. No.

At this point I did what I should have done first and searched GitHub instead of Google.
Two projects kept coming up on Reddit threads:

- [GarminDB](https://github.com/tcgoetz/GarminDB): downloads your entire Garmin history into a
  local SQLite database, with analysis and plotting. Impressive, and wrong for this. I do not
  need an archive with a schema, I need one day of heart rate as JSON, fresh every day, in CI.
- [python-garminconnect](https://github.com/cyberjunky/python-garminconnect): a Python client
  that speaks the same private API the Garmin Connect app uses. Log in like the app, call the
  same endpoints the app calls. This is the one. It exposes essentially everything I see in
  the app, which also quietly solves the someday-ledger problem: workouts, sleep, HRV, all
  reachable from the same client.

## why it is not live (and why I am fine with that)

Live was never actually on the table, and it took me a minute to accept why:

1. The watch does not stream anywhere by default. All-day heart rate accumulates on the wrist
   and reaches Garmin's servers in batches, whenever the phone syncs. There is no live feed to
   subscribe to without broadcast mode, which I already ruled out.
2. My site is static. Astro, built once, served as files from GitHub Pages. There is no server
   to hold a websocket open, and I like it that way.

So the widget replays yesterday. When you load my homepage at 14:32 your time, you see my
heart rate at 14:32 yesterday, interpolated from real samples. The label says "live". That is
a white lie, and it is my website, so I get to tell it. The rule I hold myself to is that the
lie is precise: the offset is exactly 24 hours, the data is real, and nothing is synthesized
beyond drawing straight lines between measurements.

## the plumbing

The site is Astro, static output, deployed by a GitHub Actions workflow on every push. That
workflow was the whole unlock: if CI builds the site, CI can fetch data right before the
build, and the data ships as a static file like everything else. No server appears at any
point in this story.

### auth, once

python-garminconnect logs in with email and password, then hands back OAuth tokens that are
good for about a year. The password should never reach CI, so the login happens once, locally:

```bash
python3 -m venv .venv
source .venv/bin/activate.fish
pip3 install garminconnect
python3 scripts/garmin_login.py
```

The login script prompts for credentials, handles MFA if asked, saves the token files to
`~/.garminconnect`, and writes the same tokens as one base64 blob for the repo secret:

```bash
gh secret set GARMINTOKENS_BASE64 --repo snehankekre/snehankekre.github.io < ~/.garminconnect.b64
```

Fun detail: Garmin rate-limited my IP during login. Both of the library's mobile login
strategies came back with a `429` ("IP rate limited by Garmin"), and then a fallback strategy
in its chain quietly succeeded anyway. Tokens acquired. CI never logs in at all, it only ever
replays tokens, so the rate limit was a one-time toll.

### the fetch

A small Python script runs in CI before the Astro build. The interesting lines:

```python
garmin = Garmin()
garmin.login(tokens)  # a token dir path, or the base64 blob from the secret

tz = ZoneInfo(os.environ.get("HR_TZ", "Asia/Makassar"))
target = (datetime.now(tz) - timedelta(days=1)).date()

data = garmin.get_heart_rates(target.isoformat())
```

Two things bit me here. First, `garminconnect` 0.3.x accepts either a token directory or the
base64 blob in the same `login()` call (strings longer than 512 chars are treated as blobs),
so the identical script runs on my Mac and in CI. Second, timezones: GitHub runners live in
UTC. At 3 a.m. in Bali it is still yesterday in UTC, so a naive `date.today() - 1` fetches the
wrong day. "Yesterday" has to be computed in my timezone, not the runner's.

The output is `public/hr.json`, about 14 KB:

```json
{"date":"2026-07-13","resting":48,"points":[[1783872000000,56],[1783872120000,56],...]}
```

Roughly 717 samples, one every ~2 minutes, timestamps in absolute epoch milliseconds GMT.
That absoluteness matters later.

The script is not allowed to fail. Watch didn't sync, tokens expired, Garmin down: it logs the
reason and exits 0 without writing the file. The build proceeds, the widget finds no data and
hides. The failure mode is absence, never breakage.

### the pipeline

Two cron triggers on the existing deploy workflow, in UTC: `0 19 * * *` (3 a.m. in Bali, after
the day completes) and `0 4 * * *` (noon, catching late phone syncs). The fetch step installs
a pinned `garminconnect==0.3.6`, runs with the secret in env, and the JSON lands in `public/`,
which Astro copies verbatim into the deploy. Nothing is committed: the repo never accumulates
a year of heartbeat diffs, the data lives only in the built artifact.

### the replay

The browser fetches `/hr.json` and, every 10 seconds, evaluates one target instant:

```js
const bpm = sample(Date.now() - 86_400_000);
```

That subtraction is the entire timezone story. Garmin's timestamps and `Date.now()` are both
absolute epoch milliseconds, so a visitor in Tokyo and a visitor in New York ask the same
question, "what was his heart doing exactly 24 hours ago", and get the same correct answer.
No timezone math survives contact with this design, which is the best thing I can say about
any timezone design.

Garmin samples every ~2 minutes, and a number that jumps once per 2 minutes reads as dead. So
between the two real samples bracketing the target, the widget interpolates linearly:

```js
const f = (t - prev[0]) / (next[0] - prev[0]);   // 0 at prev, 1 at next
return Math.round(prev[1] + f * (next[1] - prev[1]));
```

Ticking every 10 s walks the reading along the chord between measurements: 62, 63, 63, 64,
65. Organic drift, zero invention. Every displayed value lies on a straight line between two
real samples, which is exactly what the Garmin app's own graph draws.

Two guards keep it honest:

- **GAP = 20 minutes.** If the bracketing samples are further apart than that (watch charging,
  off wrist), refusing to interpolate is the difference between smoothing and fabricating.
  Inside a hole, the widget hides rather than inventing three hours of plausible numbers.
- **The midnight wraparound.** The file covers one Bali day, refreshed at 3 a.m. Between
  midnight and the refresh, `now - 24h` points past the end of the data, so:
  `if (t > last) t -= DAY;` replays the same clock time one day earlier instead of vanishing
  nightly. Because it rewinds at most once, it doubles as the staleness guard: if the pipeline
  dies for days, even the rewound target misses the data and the widget hides. At most ~24
  hours of grace, never a week-old number dressed up as current.

### the beat

The pulse is data, not decoration. The script sets a CSS variable and the animation reads it:

```css
.hr-heart {
  animation: hr-beat var(--beat, 1s) ease-out infinite;
}
```

`--beat` is `60/bpm` seconds, so 48 bpm beats slower than 80 bpm, visibly. The keyframes do a
lub-dub double bump because a single scale pulse looked like a notification badge, not a
heart. And `prefers-reduced-motion` turns the animation off entirely, the number still
updates.

## the bill

Total running cost: zero. No server, no third-party relay, no battery impact (the watch syncs
exactly as it did before), no new moving parts except one Python script and two cron lines.
The only maintenance on the horizon is the token expiring in about a year, at which point the
widget silently disappears and I rerun one login script.

Next, someday: the workouts. The same client that fetches heart rate can fetch every
streetlifting session I have ever logged. The ledger wants to exist.
