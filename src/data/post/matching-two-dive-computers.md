---
title: Two wrists, one dive
publishDate: 2026-07-23
excerpt: My Garmin and my Shearwater both logged my 101.5 m dive, 19 seconds apart on clocks that don't agree about what time is. How bottomtime decides two logs are the same dive so you can do it yourself.
image: '~/assets/images/og-matching-two-dive-computers.png'
draft: false
---

Technical divers wear two computers for redundancy. If one dies 75 m inside a cave or
at 90 m on a wreck, and the other can get you out. Mine are
a Garmin Descent Mk3i on the left wrist and a Shearwater Perdix 2 on the right, and they
both log everything. Which means every dive I do produces two files that describe the
same hour underwater and agree on almost nothing administrative. Neither the start time nor the
duration, and sometimes not even how many dives it was.
[bottomtime](https://github.com/snehankekre/bottomtime)'s job is to figure out which
logs are the same physical dive without ever merging them. This post is about how.

## Nobody agrees what time it is

Take my deepest dive, #202, 101.5 m at the Drop Off dive site in Tulamben. The Perdix says it started at
`2025-09-27 11:55:43`. The Garmin says `2025-09-27 03:56:02`. Both are right.

The Perdix logs its epochs on a wall clock with no timezone attached. That 11:55:43 is
Bali time wearing a UTC costume. The Garmin records true UTC and, separately, the local
offset (+480 minutes). Subtract eight hours from the Perdix's number and you get
03:55:43 UTC, 19 seconds before the Garmin's start. Nineteen seconds is me pressing two
buttons on two wrists while I do my surface swim to the entry point.

But "subtract eight hours" was the answer, and the matcher's first problem is that the
Shearwater log never states the question. So it borrows the answer from the other wrist. For each Shearwater dive, try the UTC offsets observed on Garmin dives nearby in
calendar time (all 84 of my matched pairs so far are +480, but the code doesn't assume
that. When I dive somewhere else, the Garmin will have logged the new offset). Under
each candidate offset, look for interval overlap of at least half the shorter log,
with a sanity check that the shorter log isn't somehow deeper than the longer one.

Passing the overlap check only makes a pair a candidate. Acceptance rides on the depth
profiles.

## The depth profile is the fingerprint

Two computers strapped to the same body sample the same physical curve, and depth over
time is the only channel they share. (GPS is no help. Seawater absorbs the signal
within a metre of the surface, so the Garmin has a fix for the entry point and nothing
after it.) The matcher
takes both depth series, lays them on an in-memory 10-second grid, and slides one
against the other across lags of ±300 s, scoring each shift with normalized
cross-correlation. The stored samples are never resampled. The grid exists only long
enough to compute the score.

Here are the two real series from dive #202. Drag the lag and watch the score respond:

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

(The widget runs the same resample-and-correlate code as the matcher, ported to ~40
lines of JS, on the actual logs downsampled to the 10 s grid. If it's not rendering,
the data file didn't load, and hiding beats faking.)

Two things show up while you drag. The score peaks at +20 s. After the
whole-hours offset is removed, the residual disagreement between my two wrists is
20 seconds, and the matcher stores that number (`residual_skew_s`) rather than
correcting either series. And the peak is gentle. Even 120 seconds off, this dive still
scores above 0.95 because a deco profile is mostly slow monotonic segments. That
gentleness is why the acceptance threshold is a greedy 0.95 with an ambiguity rule. If
two candidate Garmin dives score within 0.02 of each other, the matcher refuses to
choose and flags the dive for human review instead.

On the full-resolution series the winning score for this pair is 0.99976, with a
duration disagreement of 43 seconds and a max-depth disagreement of 0.37 m.

## Then I took it to a pool

Cross-correlation has a failure mode. It measures the agreement of *variation*, and a
pool session has almost none. Go 3 m down, stay there, come up. Normalize a flat
line and you get noise.

My worst real case: one afternoon of skills practice on 2025-12-17. The Garmin logged it
as a single 113-minute activity, max depth 8.2 m, because the Descent keeps recording
through surface pauses. The Perdix, which cuts a log whenever I surface for more than a
moment, cut eight logs over the same afternoon, two of them 46-second and 116-second
blips too brief to pair with anything. The six that could pair ran from 345 s to
1,382 s. The two deeper drills matched on profile shape (0.991 and 0.975). The four
shallow ones scored as low as 0.559, hopeless as correlations, while being blatantly
the same water on the same day.

So there's a second acceptance path for this shape of failure. If the interval
overlap is near-total (at least 0.85) and the median absolute depth difference at the
best lag is 0.75 m or less, accept. Two instruments on one body must agree on depth
even when the profile is too boring to correlate. Thirteen of my 84 matches came in
through that door, all of them pool sessions and shallow drills.

None of these thresholds is principled. They're placed in the gaps of the observed
distributions. Profile-accepted pairs score between 0.962 and 0.99997 against the 0.95
bar, and the pool path's observed depth deltas run 0.07 to 0.20 m against the 0.75 m
ceiling, so each rule has room on both sides. Duration is not used as evidence at all.
The deltas run from 1 second to 6,463 seconds (median 48 s, but 26 of the 84 pairs
disagree by more than five minutes), all of it the Descent's surface-pause habit, none
of it saying anything about identity.

## A match is just a row

When a pair is accepted, nothing is merged. The match is a row: which Garmin log, which
Shearwater log, the clock offset (+28,800 s), the residual skew, the score, and which
rule accepted it. Both sample series stay exactly as their computers wrote them.
Canonical dives are then just the connected components of those links, which handles the
pool afternoon gracefully. One canonical dive with seven members, one Garmin log and six
Shearwater logs, nothing pretending the Perdix's six dives didn't happen.

And 84 matches does not mean 84 out of 84. My Shearwater computers have logged 142 dives, and the 58
unmatched ones are all accounted for. Forty-nine happened on days I wasn't
wearing the Garmin at all, mostly early confined-water sessions and a CCR (closed-circuit
rebreather) course where
my second computer was a Petrel 3 instead (the matcher only links Garmin to Shearwater,
so those two-Shearwater days stay unlinked, a limitation I haven't needed to fix yet).
Eight are bench tests under two metres or two minutes. Exactly one, a six-minute
2.5 m bob during a surface interval on 2025-12-19, overlapped a real Garmin log and was
still rejected, correctly, by both rules.

The residual skews are their own small dataset. The median is +20 s across my 84 pairs, 53 of
them within ±30 s, worst case +190 s on a day I apparently took my time pressing the
second button. If I ever want to know how my two computers' crystals drift apart over
months, the numbers are sitting in a table, because correcting a disagreement in place
would have destroyed the record of it.

The [verification suite](/posts/verifying-undocumented-bytes) closes the loop. After
alignment, the median depth disagreement across all 84 matched pairs, median-of-medians,
is 0.162 m. When I ask `bottomtime plot` for dive #202, both profiles land on one time
axis using the stored offset and skew, no resampling, and the two lines sit on top of
each other.
