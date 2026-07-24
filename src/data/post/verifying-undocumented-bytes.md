---
title: Proving byte 25
publishDate: 2026-07-22
excerpt: "A reverse-engineered byte is a hypothesis. I wanted mine attacked from every angle before trusting it: the vendor's exports, its own arithmetic, physics, a second computer, and finally its source code."
image: '~/assets/images/og-verifying-undocumented-bytes.png'
draft: false
---

In [the last post](/posts/decoding-pnf) I claimed that byte 25 of a Shearwater dive
sample is GF99 (the live readout of how close your tissue load is to the decompression
model's limit), byte 24 is the deco ceiling, byte 18 is battery voltage, and bytes 26-27
are the @+5 prediction, the time to surface if you stayed five more minutes. Shearwater has never documented any of that. Which means the
claim is exactly as good as the evidence behind it, and "the curve looked right on a few
dives" is the kind of evidence that decodes your tissue loading wrong for a year before
you notice.

So [bottomtime](https://github.com/snehankekre/bottomtime) treats every byte mapping as
a hypothesis and ships a verification suite, `bottomtime verify`, that tries to falsify
all of them against every dive in the store. The suite has four independent oracles, and
a fifth turned up later from outside it. None of them is my own opinion of what a
plausible dive looks like.

## Oracle 1: the vendor's other rendering

Shearwater Cloud can export a dive as XML. The XML is lossy (it's missing the very
channels I had to reverse), but the channels it *does* carry were produced by
Shearwater's own code reading the same native log. That makes it a per-sample answer
key for the documented offsets. If my decoder and their exporter disagree about sample
371's depth, my decoder is the one that's wrong.

The suite pairs each XML file with its dive by start time and compares nine channels
sample by sample:

| XML field | decoded column | tolerance |
| --- | --- | --- |
| `currentDepth` | `depth_m` | 0.051 m |
| `ttsMins` | `tts_min` | 0.001 |
| `firstStopDepth` | `stop_depth_m` | 0.11 m |
| `fractionO2` / `fractionHe` | `o2_pct`, `he_pct` | 0.001 |
| `averagePPO2` | `avg_ppo2` | 0.011 |
| `waterTemp` | `temp_c` | 0.51 C |
| `batteryVoltage` | `battery_v` | 0.011 V |
| `currentNdl` | `ndl_min` | 0.001 |

The tolerances exist because the two renderings round differently. The log stores depth
as decimetres and the XML prints it as a float, so half a decimetre of slack covers the
rounding without covering any real mistake. Byte 18 earns its place here too. The XML's
`batteryVoltage` equals the byte's value divided by 100 on every sample, which is what
promoted it from guess to mapping.

The current run verbatim against my 142 dives with Shearwater dive computers:

```
xml crosscheck: 142 dives, worst deviation 0.0000 at #13[86].depth_m
```

Every shared sample of every dive agrees exactly. The "worst" deviation is a rounding
artifact so small it prints as zero.

## Oracle 2: the vendor's own arithmetic

The XML can't vouch for GF99, since GF99 is one of the fields it omits. But Shearwater
Cloud computes a summary statistic per dive called `EndGF99`, the gradient factor at
surfacing, and stores it in the database next to the raw blob. Shearwater's code
computed that number from the same samples I'm decoding. So if byte 25 really is GF99, then
the maximum of my decoded byte-25 values over the last minutes of a dive should equal
their `EndGF99`.

Across all 142 of my Shearwater dives:

![Scatter of decoded max GF99 near surfacing against Shearwater Cloud's EndGF99 for 142 dives, all points on the diagonal](/posts/verifying-undocumented-bytes/endgf99.png)

The median disagreement is zero. The worst is a single GF point, and it shows up on two
dives. On one, Cloud reads 5 where I read 6. On the other, Cloud's EndGF99 is 0 where my
tail reads 1. Both readings sit at the bottom of the scale, a leading tissue only a few
percent of the way to its Bühlmann limit, so a one-point gap there is the same clean
surfacing counted two ways. I
take the window over the last 60 samples (ten minutes) rather than the literal final
sample because GF99 keeps moving during the last metre of ascent, and Cloud's snapshot
and mine need not land on the same instant.

## Oracle 3: physics

Some checks need no vendor at all. A decoded ceiling that comes out deeper than the
displayed stop depth would be nonsense. Deco stops land only on a 3 m grid (3 m, 6 m,
9 m...), and the stop is the ceiling pushed to the next grid depth at least as deep, so
the decoded ceiling can never sit deeper than the decoded stop. That invariant holds on all
33,773 samples in the store with zero violations. If I had picked the wrong byte for either
field, this is the check that would scream, because an arbitrary byte has no reason to
stay quantized-consistent with its neighbor for a hundred hours of diving.

The `0xFF` sentinel behaves physically too. On my 101.5 m dive, byte 25 reads `0xFF`
from second 10 to second 1050, one contiguous run, and then never again. That span is
the descent and the deep segment. Tissues sit under ambient pressure the whole time, with
no supersaturation to report. The sentinel switches off exactly when the physics says a
gradient factor starts to exist.

## Oracle 4: the other wrist

I log every dive on two computers, a Garmin Descent Mk3i and the Perdix. To my knowledge, they share no
firmware, sensor, nor vendor. After [the matcher](/posts/matching-two-dive-computers) aligns their clocks, both series claim
to describe the same physical body in the same
water column, so their depth channels have to agree. For each of the 84 matched pairs
the suite takes the median absolute depth difference at aligned timestamps:

```
twin agreement: 84 matches, median-of-medians 0.162 m, worst 0.840 m
```

The tolerance scales with depth, max(0.6 m, 4.5% of max depth), because the two
computers convert pressure to depth with their own assumed water density (fresh, salt,
or the EN13319 dive-gauge standard), and those differ by up to about 3%. Sixteen centimetres of median
disagreement between two unrelated instruments is, honestly, better than I expected
from physics that starts with "assume a density".

## What else byte 25 could have been

A byte that merely correlates with GF99 would sail through a sloppy check, so the live
alternatives each needed disproving separately. The strongest was SurfGF, Shearwater's
other gradient number, the same supersaturation recomputed as if I surfaced right now.
The two converge at the moment of surfacing, so the EndGF99 oracle alone can't tell
them apart. The sentinel can. SurfGF is well-defined and climbing through the descent
and bottom phase, which is precisely the 1,040 seconds byte 25 spends reading `0xFF`. CNS, the oxygen-toxicity clock,
was disproven twice. It's already documented at byte 23, and it never decreases during a dive,
while byte 25 decays through every long stop. Timers, counters, and battery-like slow
channels fail the same shape test. GF99 is the only quantity I know of that is
undefined at depth, wakes on ascent, decays at stops, spikes at surfacing, and lands on
Shearwater's own EndGF99 142 times out of 142.

## Oracle 5: the vendor's own source

The four oracles above are behavioral. They judge byte 25 by how it acts. A fifth arrived
later and judges it by construction. Shearwater Cloud ships its parser as a .NET
assembly, `DiveLogParser.dll`, and the macOS app carries the same managed file as the
Windows one, so I could read the class that decodes these records
([the how is in the last post](/posts/decoding-pnf)). It names byte 25 `GF99_OFFSET` and
byte 24 `DECOCEILING_OFFSET`, confirming all four empirical bytes at once.

It also closed the SurfGF question harder than the sentinel did. The parse method only
treats byte 25 as GF99 when the deco model uses gradient factors, and reads it as a
safe-ascent-depth fraction on DCIEM, a decompression model that doesn't use gradient
factors. A generic gradient number like SurfGF would never
get that branch, which pins byte 25 as GF99 in particular and closes the one gap the
behavioral oracles left open. That is the strongest evidence I have, which is why I put
it last. If I'd read the source first, I'd have trusted a name and
skipped the checks that would have caught me decoding the DCIEM case wrong. The source
tells you what the bytes are called. Only the data tells you whether your code is right.

## Byte 11, which no oracle could reach

Byte 11 defeated all four behavioral oracles. It was nonzero in 32,544 of my 33,773
samples, sat between 82 and 94 through the deep dive, and correlated with no exported
field, computed summary, invariant, or second computer. For a long time it stayed raw in an
`extra_json` column, unlabeled, as one of 392,959 undecoded payloads the store keeps
verbatim. The fifth oracle is what finally named it as `BATTERY_PERCENT_REMAINING`. And
because a name in a binary is still a hypothesis, I checked it the same way as the rest,
and the values bound cleanly to 0-100 across every sample, which an arbitrary byte has no
reason to do. While behavior can pin some bytes down, the source has to name the rest, and both
still have to survive the data.

The discipline underneath all of it is that decoded and verified are different states,
and only the checks are allowed to move a byte from one to the other. What I never do is
guess plausibly and move on, because a dive log is the one dataset where
plausible-but-wrong is worse than missing. Nobody re-checks a number that looks right.

## Every trip re-litigates everything

`bottomtime verify` runs against the live store, so every new trip re-litigates every
mapping: 142 dives of XML agreement, 142 EndGF99 convergences, 33,773 invariant samples,
84 twin comparisons, and the counts and foreign keys besides. The empirical bytes are
validated on a Perdix 2 and a Petrel 3 so far. Every mapping that clears the suite is
what the [pnf spec](https://github.com/snehankekre/pnf/blob/main/SPEC.md) writes down and
the `pnf` package (`pip install pnf`) decodes. If your Teric or Nerd 2 populates them
differently, the suite is designed to catch it rather than silently mis-decode, and a
failing blob in [the issue tracker](https://github.com/snehankekre/bottomtime/issues)
is the data I can't generate myself. So please, if you have a Shearwater that disagrees with my mapping, run `bottomtime verify` and
file the blob.
