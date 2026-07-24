---
title: Two wrists, one dive
publishDate: 2026-07-23
excerpt: My Garmin and my Shearwater both logged my 101.5 m dive, starting 19 seconds apart, on clocks that disagree about the time zone. Here's how bottomtime decides that two logs are the same dive, so you can do it yourself.
image: '~/assets/images/og-matching-two-dive-computers.png'
draft: false
---

Technical divers wear two computers in case one fails. If one dies 75 m inside a cave or
at 90 m on a wreck, the other can still get you out. Mine are a Garmin Descent Mk3i on my
left wrist and a Shearwater Perdix 2 on my right, and both log everything. So every dive I
do produces two files that describe the same hour underwater and disagree on almost every
detail of the record-keeping: the start time, the duration, and sometimes even how many
dives there were.

[bottomtime](https://github.com/snehankekre/bottomtime)'s job is to work out which logs
are the same physical dive without ever merging them. This post is about how it does that.

## Nobody agrees what time it is

Take my deepest dive, #202, 101.5 m at the Drop Off dive site in Tulamben. The Perdix
says it started at `2025-09-27 11:55:43`. The Garmin says `2025-09-27 03:56:02`. Both are
right.

The Perdix records times from a wall clock and doesn't store a time zone. So 11:55:43 is
Bali local time, stored as if it were UTC. The Garmin records real UTC, and stores the
local offset separately (+480 minutes, which is eight hours). Subtract eight hours from
the Perdix's time and you get 03:55:43 UTC, 19 seconds before the Garmin's start. Those 19
seconds are me pressing a button on each wrist during my surface swim to the entry point.

Subtracting eight hours gives the right answer, but the Shearwater log never says that
eight hours is the number to subtract. So the matcher gets the offset from the other
wrist. For each Shearwater dive, it tries every UTC offset the Garmin logged on dives
close to it in time. All 84 of my matched pairs so far use +480, but the code doesn't
assume that, because when I dive somewhere else, the Garmin will log the new offset.

For each offset it tries, the matcher checks whether the two logs overlap in time for at
least half the length of the shorter one. It also checks that the shorter log isn't
somehow deeper than the longer one. Passing these checks only makes a pair a candidate.
Whether the pair is accepted depends on the depth profiles.

## Matching on the depth profile

Two computers strapped to the same body measure the same curve, and depth over time is
the only channel they both record. (GPS doesn't help. Seawater blocks the signal within a
metre of the surface, so the Garmin gets a position for the entry point and nothing after
it.)

The matcher takes both depth series and places them on a 10-second grid in memory. Then
it slides one series against the other, shifting it anywhere from 300 s earlier to 300 s
later, and scores each shift with normalized cross-correlation. That's a number between
-1 and 1 that measures how closely two curves rise and fall together, where 1 is a
perfect match. The stored samples are never changed. The grid only exists long enough to
compute the score.

Here are the two real series from dive #202. Drag the lag slider and watch the score
change:

<div id="lag-widget" hidden style="border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent); padding: 1rem; margin: 1.5rem 0; font-family: var(--font-mono, monospace); font-size: 0.8rem;">
  <canvas id="lag-profiles"></canvas>
  <canvas id="lag-ncc" style="margin-top: 0.5rem;"></canvas>
  <div style="display: flex; align-items: center; gap: 0.75rem; margin-top: 0.75rem; flex-wrap: wrap;">
    <label for="lag-slider">lag</label>
    <input id="lag-slider" type="range" min="-120" max="120" step="5" value="-120" style="flex: 1; min-width: 10rem; accent-color: var(--accent);" />
    <span id="lag-value" style="min-width: 4ch; text-align: right;">0 s</span>
    <span>NCC <b id="ncc-value">?</b></span>
  </div>
</div>
<script src="/posts/matching-two-dive-computers/widget.js" defer data-astro-rerun></script>

(The widget runs the same grid-and-score code as the matcher, ported to about 40 lines of
JS, on the real logs reduced to the 10 s grid. If it isn't showing, the data file didn't
load, and I'd rather hide the widget than fake it.)

Two things show up as you drag. First, the score peaks at +20 s. Once the whole-hour time
zone offset is removed, my two wrists still disagree by 20 seconds. The matcher stores
that number (`residual_skew_s`) and doesn't correct either series.

Second, the peak is broad. Even at 120 seconds off, this dive still scores above 0.95,
because a deco profile is mostly slow, steady changes in depth. So a high score alone
isn't enough to pick the right partner. The matcher accepts pairs that score at least
0.95, assigns them in order from the highest score down, and has a rule for close calls.
If two Garmin dives both score within 0.02 of each other for the same Shearwater dive,
the matcher refuses to pick one and flags the dive for me to review.

On the full-resolution series, this pair's winning score is 0.99976. The two logs'
durations differ by 43 seconds and their max depths by 0.37 m.

## Then I took it to a pool

Cross-correlation has a weak spot. It measures whether two curves move together, and in a
pool session the depth barely moves. You go 3 m down, stay there, and come up. Once you
normalize a flat line, all that's left is noise.

My worst real case was an afternoon of skills practice on 2025-12-17. The Garmin logged it
as one 113-minute activity with a max depth of 8.2 m, because the Descent keeps recording
through short breaks at the surface. The Perdix starts a new log whenever I'm at the
surface for more than a moment, so it logged eight dives over the same afternoon. Two of
them were 46 and 116 seconds long, too short to pair with anything. The six that could
pair ran from 345 s to 1,382 s. The two deeper drills matched on profile shape, scoring
0.991 and 0.975. The four shallow ones scored as low as 0.559, which is hopeless as a
correlation, even though they were obviously the same water on the same day.

So there's a second way for a pair to be accepted, for this kind of dive. If the logs
overlap almost completely (85% or more) and the median depth difference at the best lag
is 0.75 m or less, the pair is accepted. Two instruments on one body have to agree on
depth even when the profile is too flat to correlate. Thirteen of my 84 matches came in
this way, and all of them were pool sessions and shallow drills.

None of these thresholds comes from theory. I placed them in the gaps between the values I
observed. Pairs accepted on profile shape score between 0.962 and 0.99997, against the
0.95 cutoff. Pairs accepted by the pool rule have depth differences between 0.07 and
0.20 m, against the 0.75 m limit. So each rule has room on both sides.

Duration isn't used as evidence at all. The duration differences range from 1 second to
6,463 seconds (the median is 48 s, but 26 of the 84 pairs differ by more than five
minutes). All of that comes from the Descent recording through surface breaks, and none
of it says whether two logs are the same dive.

## A match is just a row

When a pair is accepted, nothing is merged. The match is a row in a table that records
which Garmin log, which Shearwater log, the clock offset (+28,800 s), the remaining skew,
the score, and which rule accepted it. Both sample series stay exactly as their computers
wrote them.

A canonical dive is then a group of logs joined by these links (in graph terms, a
connected component). That handles the pool afternoon well. It becomes one canonical dive
with seven members, one Garmin log and six Shearwater logs, and the Perdix's six dives
are all still there.

84 matches doesn't mean 84 out of 84. My Shearwater computers have logged 142 dives, and I
can account for all 58 that didn't match. Forty-nine were on days I wasn't wearing the
Garmin at all. Most of those were early confined-water sessions and a CCR (closed-circuit
rebreather) course where my second computer was a Petrel 3 instead. The matcher only
links Garmin logs to Shearwater logs, so days with two Shearwaters stay unlinked, which is
a limitation I haven't needed to fix yet. Eight were bench tests shallower than two
metres or shorter than two minutes. Exactly one, a six-minute bob at 2.5 m during a
surface interval on 2025-12-19, overlapped a real Garmin log and was still rejected by
both rules, which was the right call.

The leftover skews make a small dataset of their own. Across my 84 pairs the median is
+20 s, 53 pairs are within 30 seconds either way, and the worst is +190 s, on a day I
apparently took my time pressing the second button. If I ever want to know how my two
computers' clocks drift apart over months, the numbers are sitting in a table. If I had
corrected the times in place, I would have thrown that record away.

The [verification suite](/posts/verifying-undocumented-bytes) closes the loop. After
alignment, the median depth difference across all 84 matched pairs (the median of each
pair's median) is 0.162 m. When I ask `bottomtime plot` for dive #202, it puts both
profiles on one time axis using the stored offset and skew, without resampling, and the
two lines sit on top of each other.
