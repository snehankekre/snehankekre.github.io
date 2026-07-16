---
title: My homepage has a pulse
publishDate: 2026-07-16
excerpt: There's a small red heart on my homepage now, beating at my actual heart rate with an exactly 24 hour delay. How I get the data out of my Garmin, and where the white lie is.
draft: false
---

There is a small red heart on my homepage now that beats. The number next to it is my actual
heart rate, and the heart pulses at that frequency: 48 bpm means one thump every 1.25 seconds,
80 bpm means one every 0.75. I wrote this up because I wanted to, and because the design ended 
up containing more interesting decisions than I expected.

## The watch

I wear a [Garmin Descent Mk3i](https://www.garmin.com/en-US/p/852217/), 43 mm, carbon gray DLC
titanium. I bought it as my primary dive computer, alongside my Shearwater Perdix 2, because you
need redundancy in technical diving and overhead environments like caves and wrecks. If a computer dies 
at 75 m inside a cave, you can't just surface and charge it. Cave divers have backups for their backups.
Since April 2025 it has been on 400+ dives with me, including to 100 m.

I don't take it off unless I'm charging it or showering. Between dives it tracks my heart 
rate, sleep score, HRV, steps, calories, and a dozen other vitals around the clock, and syncs 
everything to the [Garmin Connect app](https://www.garmin.co.id/products/apps/garmin-connect-mobile/) 
on my Pixel 9 Pro. My gym and streetlifting sessions get logged on it too. Which means Garmin already 
holds a continuous, granular physiological record of my life. I just needed the data out of Garmin and onto my homepage.

## A more personal "online" status indicator

Old messaging apps had the green dot. Facebook Messenger, Gchat before it: a small indicator
that said this person is here right now. I remember seeing it in HexChat in 2012, before I
moved to Irssi. I wanted that for this site, except the green dot always felt like a statement about a socket 
instead of a person. A heartbeat is the least abstract "online" there is. It's the difference 
between "his browser has a connection open" and "he is alive, and here is the proof". In the end
it's just a number on a page, I get that. But it is my number, from my chest, and that makes it 
the most personal thing on the site. It might be a little cringe to a lot of you, but I like the idea :P.

The longer-term goal, when I get around to it, is a section of this site that shows a granular ledger of
my life made public: workouts, sleep, HRV, calories burned, steps walked, etc. I
understand what that leaks. All-day heart rate reveals when I sleep and wake. Gaps and
timezone shifts reveal travel. A resting heart rate that jumps 8 bpm flags illness, stress,
or last night's drinks. HRV trends are a decent proxy for mental state, and a regular gym
schedule advertises exactly when I am not home. I have sat with all of that and decided I am
fine with it. I consent to it, and if you have a problem with it, that is your problem, not mine ¯\\_(ツ)_/¯.

## Surely someone has done this. Yup, they have.

My first thought was that this must already exist, and I was right. Twitch streamers have been
putting live heart rate on screen for years through services like
[Pulsoid](https://blog.pulsoid.net/post/garmin-devices-supported-by-pulsoid) and
[HypeRate](https://www.hyperate.io/), and both support Garmin watches. They work by putting
the wearable into its
[broadcast heart rate](https://support.garmin.com/en-US/?faq=Zj1947s6pqAHzBCAhLhrC9) mode,
where it streams over BLE/ANT+ to a phone app that relays the number to their servers. Seemed
promising at first, but it was a deadend for me. Garmin's manuals warn that broadcasting decreases
battery life, and this watch is my dive computer. I'm not going to trade dive-day battery for a
website widget. And broadcast is a mode you switch on and stay in range of. Seems like too much
of a chore to me. Plus, I like that I charge the watch once a week and it lasts for 10 days. 
I don't want to charge it every night just to keep a widget alive.

The browser itself can speak Bluetooth, which briefly seemed promising. The
[Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) can
read the standard heart rate GATT service directly from a nearby device. Still a no-go because
it connects the visitor's browser to a device near the visitor. It would only ever work on my own machine, 
in a Chromium browser, with the watch in the broadcast mode.

Surely then there is a real API. There is: Garmin's
[Health API](https://developer.garmin.com/gc-developer-program/health-api/) serves
this data, BUT access is gated behind a business application and review. It is built for
companies integrating wearables into products. What about a guy who wants a heart on his
homepage? Fahhhh (╯'□')╯︵ ┻━┻.

At this point I did what I should have done first and searched GitHub and Reddit. Two
projects kept surfacing in Reddit threads. [GarminDB](https://github.com/tcgoetz/GarminDB)
downloads your entire Garmin history into a local SQLite database and gives you analysis and
plots on top. Cool, but wrong for this. An archive with a schema seems like overkill... I probably just want
one day of heart rate as JSON every morning.
[python-garminconnect](https://github.com/cyberjunky/python-garminconnect) is the right
tool because it is a Python client that speaks the same private API the Garmin Connect app uses. 
It lets you log in the way the app does and calls the same endpoints as the app. It exposes essentially everything
I can see on my phone, which incidentally solves the someday-in-the-future-project problem, because
workouts, sleep, and HRV are all reachable from the same client. Nice, thank you [@cyberjunky](https://github.com/cyberjunky)!

## Why not live?

Live was never actually on the table, but I didn't know that at the start. The watch does
not stream anywhere by default: all-day heart rate accumulates on the wrist and reaches
Garmin's servers in batches, whenever the watch↔phone sync happens. Without broadcast mode there is no
feed to subscribe to. And my site is static, Astro built once and served as files from GitHub
Pages. There's no server to hold a websocket open, so even if the watch did stream, I didn't figure out
a way to relay it to visitors. The only option is to fetch the data once a day and replay it.

So the compromise is that the widget replays yesterday. When you load my homepage at 14:32 your time, you see my
heart rate at 14:32 yesterday, interpolated from real samples. The "live" label is a white lie, 
but it's mine to tell. But at least the lie is precise: the offset is exactly 24 hours, 
the data is real, and nothing is made up beyond drawing straight lines between measurements.

## A one-time login (for a year)

`python-garminconnect` logs in with an email and password, but what it hands back is a pair of
OAuth tokens. The OAuth1 token is the long-lived one, good
for about a year. The OAuth2 token is what actually authorizes API calls, and it expires
after a few hours. The library signs every request with the OAuth2 token, and whenever that
one expires, it uses the OAuth1 token to generate a fresh one behind the scenes (my limited understanding). So my creds
get typed once on my laptop, and never go anywhere near CI. CI only holds
tokens which refresh themselves for a year.

The one-time part looks like this:

```bash
python3 -m venv .venv
source .venv/bin/activate.fish
pip3 install garminconnect
python3 scripts/garmin_login.py
```

[`garmin_login.py`](https://github.com/snehankekre/snehankekre.github.io/blob/27b39defb12186efca3312041d83dd2e4e1d7c5f/scripts/garmin_login.py)
is a short script that prompts for credentials and handles the token plumbing. The
interesting part:

```python
garmin = Garmin(email=email, password=password, return_on_mfa=True)
status, client_state = garmin.login()
if status == "needs_mfa":
    mfa = input("MFA code: ")
    garmin.resume_login(client_state, mfa)

garmin.client.dump(str(tokendir))            # token files -> ~/.garminconnect
b64_path.write_text(garmin.client.dumps())   # same tokens, one base64 string
```

`return_on_mfa=True` makes the library pause and hand control back instead of dying when
Garmin asks for a two-factor code, and `resume_login` finishes the handshake with whatever I
type. At the end the tokens land in two forms: as files in `~/.garminconnect` for local runs,
and as a single base64 blob (`client.dumps()` serializes the whole token store into one
string) that becomes a GitHub Actions secret:

```bash
gh secret set GARMINTOKENS_BASE64 --repo snehankekre/snehankekre.github.io < ~/.garminconnect.b64
```

I had problems with the login. Garmin rate-limited my IP mid-attempt, even though I rotated through Mullvad's servers. The library tries a
chain of login strategies, and the first two (`mobile+cffi`, then `mobile+requests`) both
came back with a `429` ("IP rate limited by Garmin"). Thankfully the library's fallback strategy further down the chain succeeded.
It was a one-time toll either way: CI never logs in at all, it only replays tokens, so the login endpoint never sees it again.

## Fetching yesterday, every morning

My site uses Astro, built and deployed to GitHub Pages by an Actions workflow. I figured if CI builds the site, CI can fetch data right before the
build, and the data would ship as a static file like everything else. So there's a small Python
script, [`fetch_hr.py`](https://github.com/snehankekre/snehankekre.github.io/blob/27b39defb12186efca3312041d83dd2e4e1d7c5f/scripts/fetch_hr.py),
that runs before every build. The heart of it:

```python
tokens = (
    os.environ.get("GARMINTOKENS_BASE64", "").strip()
    or os.environ.get("GARMINTOKENS", "~/.garminconnect")
)
garmin = Garmin()
garmin.login(tokens)

tz = ZoneInfo(os.environ.get("HR_TZ", "Asia/Makassar"))
target = (datetime.now(tz) - timedelta(days=1)).date()

data = garmin.get_heart_rates(target.isoformat())
points = [
    [ts, bpm]
    for ts, bpm in (data.get("heartRateValues") or [])
    if bpm is not None
]
```

`garminconnect` 0.3.x accepts either a token directory or the base64 blob in the same `login()` 
call: any string longer than 512 characters is treated as a blob, anything shorter as a path.
Which means the identical script runs on my Mac (reading `~/.garminconnect`) and in CI 
(reading the secret), with no branching on my side.

The timezone part was a little tricky for me to figure out. It would have silently served wrong data. GitHub runners
live in UTC. My 3 a.m. Bali cron fires at 19:00 UTC, which is still the *previous* day in
UTC. So on Wednesday 3 a.m. my time, a naive `date.today() - timedelta(days=1)` on the runner
computes Monday, and I'd be replaying a two-day-old heart. "Yesterday" has to be computed in
the timezone where my wrist lives, hence `HR_TZ=Asia/Makassar`, passed in from the workflow
so it's a one-line change next time I move.

The `if bpm is not None` filter matters too because whenever the watch is off my wrist, Garmin
records nulls rather than nothing, and I want holes in the data to *look like holes* (more on
that below). What survives gets written to `public/hr.json`, about 14 KB:

```json
{"date":"2026-07-13","resting":48,"points":[[1783872000000,56],[1783872120000,56],...]}
```

Roughly 717 samples, one every ~2 minutes, timestamps in absolute epoch milliseconds GMT.
That absoluteness matters later on.

**A note on that 2 minute cadence, because it confused me:** it is not how often the watch
measures. The optical sensor [samples multiple times per second, all day](https://www.garmin.com/en-US/blog/health/garmin-smartwatches-measure-heart-rate-every-second/),
and Garmin's official [Health API](https://developer.garmin.com/gc-developer-program/health-api/)
(the gated one) serves all-day heart rate as 15 second representative samples. The 2 minute
series is what the Connect app's daily chart endpoint aggregates down to, and since that is
the endpoint `python-garminconnect` reads, that is what I get. If I ever want finer than
2 minute resolution without Health API access, there is a path I may look into: recorded
activities (dives, gym sessions) are stored as FIT files with 1 second samples, and
`python-garminconnect` can download those too. But for now 2 minutes is plenty for a heartbeat widget.

The other rule I gave the script: it is not allowed to fail. The entire body runs inside one
try/except that ends like this:

```python
except Exception as e:  # never break the build
    print(f"hr fetch skipped: {type(e).__name__}: {e}")
return 0
```

If the watch didn't sync, tokens expired, or Garmin is down, it logs the reason, exits 0, and writes
nothing. The build proceeds, the widget finds no data and hides.

The [workflow side](https://github.com/snehankekre/snehankekre.github.io/blob/27b39defb12186efca3312041d83dd2e4e1d7c5f/.github/workflows/deploy.yml#L7-L11)
is two cron triggers and one step in front of the Astro build:

```yaml
schedule:
  # 03:00 in Bali, once the day is complete,
  # and 12:00 to catch a late phone sync.
  - cron: '0 19 * * *'
  - cron: '0 4 * * *'
```

```yaml
- name: Fetch heart-rate data
  env:
    GARMINTOKENS_BASE64: ${{ secrets.GARMINTOKENS_BASE64 }}
    HR_TZ: Asia/Makassar
  run: |
    pip install --quiet garminconnect==0.3.6
    python scripts/fetch_hr.py
```

The version is pinned to `0.3.6` because this is an unofficial client of a private API: I
validated the token handling and response shapes against that exact version, and I'd rather
a future breaking change fail loudly than drift silently. The JSON lands in
`public/`, Astro copies `public/` verbatim into the build, and GitHub Pages serves it like
any other file. I don't have to commit anything: `public/hr.json` is gitignored, so the repo
doesn't accumulate a year of heartbeat diffs, and the data lives only inside the deployed
artifact.

## Replaying it exactly 24 hours later

The [client side](https://github.com/snehankekre/snehankekre.github.io/blob/27b39defb12186efca3312041d83dd2e4e1d7c5f/src/pages/index.astro#L520-L570)
is maybe 40 lines of vanilla JS inlined in the page. The browser fetches `/hr.json` and,
every 10 seconds, evaluates a single target instant:

```js
const bpm = sample(Date.now() - 86_400_000);
```

That subtraction is why the epoch-milliseconds detail from earlier mattered.
Garmin's timestamps and `Date.now()` are both absolute GMT milliseconds, so a
visitor in Tokyo and a visitor in New York ask the same question, "what was his heart doing
exactly 24 hours ago", and get the same correct answer.

Here's `sample()` in full (the repo version has TypeScript annotations, trimmed here):

```js
const first = pts[0][0];
const last = pts[pts.length - 1][0];
const DAY = 86_400_000;
const GAP = 20 * 60 * 1000; // holes wider than this are "no signal"

const sample = (t) => {
  if (t > last) t -= DAY; // just past the data day (pre-refresh); replay it
  if (t < first - GAP || t > last + GAP) return null;
  let prev = null;
  let next = null;
  for (const p of pts) {
    if (p[0] <= t) prev = p;
    else { next = p; break; }
  }
  if (!prev) return next && next[0] - t <= GAP ? next[1] : null;
  if (!next || next[0] - prev[0] > GAP) return t - prev[0] <= GAP ? prev[1] : null;
  const f = (t - prev[0]) / (next[0] - prev[0]);
  return Math.round(prev[1] + f * (next[1] - prev[1]));
};
```

Yeah, I know that's a O(n) linear scan to find the bracketing pair. It's 717 points once every 10
seconds. But a binary search here would be cleverness with no payoff.

Garmin samples every ~2 minutes, and a number that changes once per 2 minutes reads as dead. It would be
boring from a visitor's perspective, and it would be boring from my perspective too: I want to see the
widget move. So between the two real samples bracketing the target instant, the
widget reads off the straight line connecting them. Say the target `t` falls at 10:00:50,
between a sample of 62 bpm at 10:00:00 and one of 68 bpm at 10:02:00:

```
68 ┤                      ● next
   │          ◌ ← reading at t
62 ┤ ● prev
   └─┬────────┬───────────┬──
   10:00  10:00:50      10:02
```

The fraction of the way across is `f = 50/120 ≈ 0.417`, and the reading is
`62 + 0.417 × (68 − 62) = 64.5`, rounded to 65:

```js
const f = (t - prev[0]) / (next[0] - prev[0]);   // 0 at prev, 1 at next
return Math.round(prev[1] + f * (next[1] - prev[1]));
```

Ticking every 10 seconds walks the reading along that chord: 62, 63, 63, 64, 65. 
Every displayed value lies on a straight line between two real
measurements, which is what I gathered Garmin app's own daily graph draws.s

But interpolation has a hidden assumption that the bracketing samples are adjacent, two
minutes apart. The data has real holes because sometimes the watch is on a charger or on my sink
while I shower, and Garmin records nulls instead of nothing. Suppose
it was off my wrist from 14:00 to 17:00. The naive code would take 71 bpm at 14:00 and 58 bpm
at 17:00 and happily "interpolate" three hours of smooth, plausible, entirely invented
readings between them. The guard is a threshold I set at 20 minutes. So if the two samples
around the target are further apart than that, the widget refuses to interpolate and hides
instead. Twenty minutes is comfortably wider than the data's normal cadence. I checked a full
day of my own data: 715 of 716 consecutive samples were exactly 2 minutes apart, through the
night included, and the one exception was an 8 minute gap at 09:20 that was almost certainly
my shower. So ordinary data never trips the guard, and it's narrow enough that a real gap
hides the widget quickly rather than presenting a three-hour-old number as current.

The last problem is midnight. The file covers one Bali calendar day and refreshes at 3 a.m.,
so between midnight and the refresh, `now − 24h` points past the end of the data, and the
widget would vanish every single night. It ends up being a one-line fix in the same place as the staleness guard:

```js
if (t > last) t -= DAY;  // just past the data? replay the same time, one day earlier
```

A visitor at 1:30 a.m. briefly gets 1:30 a.m. from two days ago instead of nothing, which for
a widget whose entire premise is a replay seems like a fair trade. The part I like is that
the same line is the staleness guard, because it rewinds at most once. If the pipeline dies
and the file goes stale for days, even the rewound target misses the data and the widget
hides. The wraparound grants at most 24 hours of grace and can never dress up week-old data
as current.

I decided to hide the widget on failure rather than show a stale number. The widget's markup ships with the
`hidden` attribute already on it, and only a successful fetch plus a valid sample removes it.
Failed fetch, empty file, stale data, hole in the samples all result in the widget staying hidden.

## Making it beat

The pulse is a CSS animation that scales the heart glyph up and down at the same frequency as the data. 
Every tick, the script writes the reading into the DOM and sets a CSS custom property to the beat interval, `60/bpm` seconds:

```js
bpmEl.textContent = String(bpm);
heartEl.style.setProperty('--beat', `${(60 / bpm).toFixed(3)}s`);
```

The [animation](https://github.com/snehankekre/snehankekre.github.io/blob/27b39defb12186efca3312041d83dd2e4e1d7c5f/src/pages/index.astro#L685-L701)
just reads that variable, so the heart on the page beats at whatever rate the data says.
48 bpm visibly beats slower than 80:

```css
.hr-heart {
  display: inline-block;
  color: var(--accent);
  transform-origin: 50% 60%;
  animation: hr-beat var(--beat, 1s) ease-out infinite;
}
@keyframes hr-beat {
  0%        { transform: scale(1); }
  14%       { transform: scale(1.32); }
  28%       { transform: scale(1); }
  42%       { transform: scale(1.18); }
  56%, 100% { transform: scale(1); }
}
```

The keyframes mirror the [systolic/diastolic cycle](https://en.wikipedia.org/wiki/Cardiac_cycle)
where you see a big bump, then a smaller one, then rest for the remainder of
the cycle, because a single symmetric scale pulse looked like a notification badge rather
than a heart. `transform-origin: 50% 60%` makes the glyph swell from its visual center
instead of its bounding-box center, which for ♥ are not the same place. And
`prefers-reduced-motion` disables the animation entirely; the number still updates for anyone
who has asked their OS for less motion.

## What does this cost me? Nothing, really.

There's no server (besides GitHub Pages), no third-party relay, and no hit to the watch battery, since it syncs
exactly like it did before. I wear the watch, it syncs to my phone, and the phone syncs to Garmin's servers. The added
difference is that CI fetches the data from Garmin's servers once a day and ships it to the site.
The whole thing is one Python script, two cron lines, and some JS. The only upkeep I expect is the 
tokens expiring in about a year, at which point the heart will quietly vanish from my homepage and I'll rerun the login script.
I've asked Google Assistant to remind me in 11 months :D.

Someday, when I get around to it, I'll add the workouts and the rest of the ledger. The same
client that fetches my heart rate can fetch every gym and streetlifting session I've ever
logged, so most of the plumbing here carries over. And because activities come down as FIT
files with 1 second samples, the workouts section could be far more granular than the all-day
series ever was. Until then, you get my heartbeat exactly 24 hours late. 
