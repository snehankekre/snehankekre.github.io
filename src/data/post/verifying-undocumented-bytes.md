---
title: Proving byte 25
publishDate: 2026-07-22
excerpt: "A reverse-engineered byte is only a guess until something checks it. I tested mine every way I could before trusting them: against the vendor's exports, the vendor's own arithmetic, physics, a second dive computer, and finally the vendor's source code."
image: '~/assets/images/og-verifying-undocumented-bytes.png'
draft: false
---

In [the last post](/posts/decoding-pnf) I made four claims about a Shearwater dive
sample. Byte 25 is GF99, the live readout of how close your tissues are to the
decompression model's limit. Byte 24 is the deco ceiling. Byte 18 is battery voltage.
Bytes 26-27 are the @+5 prediction, the time to surface if you stayed five more minutes.

Shearwater has never documented any of that, so each claim is only as good as the
evidence behind it. "The curve looked right on a few dives" is the kind of evidence that
lets you decode your tissue loading wrong for a year before you notice.

So [bottomtime](https://github.com/snehankekre/bottomtime) treats every byte mapping as a
guess to be tested. It ships a verification suite, `bottomtime verify`, that tries to
prove each mapping wrong against every dive in the store. The suite has four independent
oracles. An oracle here is any source that knows the right answer without asking my
decoder. A fifth one turned up later, from outside the suite. None of them is my own
opinion of what a plausible dive looks like.

## Oracle 1: the vendor's XML export

Shearwater Cloud can export a dive as XML. The XML leaves things out, including the very
channels I had to reverse engineer. But the channels it does include came from
Shearwater's own code reading the same native log. That makes the XML an answer key,
sample by sample, for the documented bytes. If my decoder and their exporter disagree
about the depth at sample 371, my decoder is the one that's wrong.

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

The tolerances are there because the two files round differently. The log stores depth
in decimetres and the XML prints it as a decimal number, so allowing half a decimetre
covers the rounding without hiding any real mistake. Byte 18 gets checked here too. On
every sample, the XML's `batteryVoltage` equals byte 18 divided by 100, and that's what
turned byte 18 from a guess into a mapping.

Here's the current run against my 142 dives with Shearwater computers, as printed:

```
xml crosscheck: 142 dives, worst deviation 0.0000 at #13[86].depth_m
```

Every shared sample of every dive agrees. The "worst" difference is a rounding error so
small that it prints as zero.

## Oracle 2: the vendor's own arithmetic

The XML can't check GF99, because GF99 is one of the fields it leaves out. But Shearwater
Cloud computes a summary number for each dive called `EndGF99`, the gradient factor at
surfacing, and stores it in the database next to the raw blob. Shearwater's code computed
that number from the same samples I'm decoding. So if byte 25 is GF99, the highest
byte-25 value in the last minutes of a dive should equal Cloud's `EndGF99`.

Across all 142 of my Shearwater dives:

![Scatter of decoded max GF99 near surfacing against Shearwater Cloud's EndGF99 for 142 dives, all points on the diagonal](/posts/verifying-undocumented-bytes/endgf99.png)

The median difference is zero. The biggest difference is one GF point, and it happens on
two dives. On one, Cloud says 5 and I say 6. On the other, Cloud says 0 and I say 1. Both
are at the very bottom of the scale, where the leading tissue is only a few percent of
the way to its Bühlmann limit, so a one-point gap there is the same clean surfacing read
two slightly different ways. I take the highest value over the last 60 samples (ten
minutes) instead of only the final sample. GF99 keeps moving during the last metre of the
ascent, and Cloud's snapshot and mine may not be taken at the same moment.

## Oracle 3: physics

Some checks don't need the vendor at all. Deco stops only happen at multiples of 3 m
(3 m, 6 m, 9 m, and so on), and the stop the computer shows is the ceiling rounded to the
next multiple of 3 m that's at least as deep. So the decoded ceiling can never be deeper
than the decoded stop. That rule holds on all 33,773 samples in the store, with zero
exceptions. If I had picked the wrong byte for either field, this check would catch it
right away, because a random byte has no reason to stay consistent with the stop depth
for a hundred hours of diving.

The `0xFF` placeholder also behaves the way physics says it should. On my 101.5 m dive,
byte 25 reads `0xFF` from second 10 to second 1050, in one unbroken run, and never again
after that. That span is the descent and the time at depth. During all of it, the gas
pressure in my tissues is below the pressure of the surrounding water, so there's no
supersaturation to report. The placeholder switches off at the moment the physics says a
gradient factor starts to exist.

## Oracle 4: the other wrist

I log every dive on two computers, a Garmin Descent Mk3i and the Perdix. As far as I
know, they share no firmware, no sensors, and no vendor. After
[the matcher](/posts/matching-two-dive-computers) lines up their clocks, both are
describing the same body in the same water, so their depths have to agree. For each of
the 84 matched pairs, the suite takes the median depth difference across the aligned
timestamps, and then reports the median of those 84 medians:

```
twin agreement: 84 matches, median-of-medians 0.162 m, worst 0.840 m
```

The tolerance grows with depth. It's the larger of 0.6 m and 4.5% of the dive's max
depth. That's because each computer converts pressure to depth using its own assumed
water density (fresh water, salt water, or the EN13319 standard for dive gauges), and
those densities differ by up to about 3%. A median difference of sixteen centimetres
between two unrelated instruments is, honestly, better than I expected from a
calculation that starts with "assume a density".

## What else byte 25 could have been

A byte that only correlates with GF99 would pass a sloppy check, so I had to rule out
each realistic alternative on its own. The strongest one was SurfGF, Shearwater's other
gradient number. SurfGF is the same supersaturation, calculated as if I surfaced right
now. GF99 and SurfGF become equal at the moment of surfacing, so the EndGF99 check alone
can't tell them apart.

The `0xFF` placeholder can. SurfGF has a real value that keeps climbing through the
descent and the time at depth, and that's exactly the 1,040 seconds when byte 25 reads
`0xFF`. CNS, the oxygen-toxicity clock, was ruled out twice. It's already documented at
byte 23, and it never goes down during a dive, while byte 25 falls during every long
stop. Timers, counters, and slow-moving values like battery level fail the same shape
test. GF99 is the only quantity I know of that has no value at depth, appears on the
ascent, falls during stops, jumps at surfacing, and matches Shearwater's own EndGF99 142
times out of 142.

## Oracle 5: the vendor's own source code

The four oracles above judge byte 25 by how it behaves. A fifth one arrived later and
judges it by what Shearwater's code says it is. Shearwater Cloud ships its parser as a
.NET assembly, `DiveLogParser.dll`, and the macOS app includes the same file as the
Windows app, so I could read the class that decodes these records
([the last post covers how](/posts/decoding-pnf)). It names byte 25 `GF99_OFFSET` and
byte 24 `DECOCEILING_OFFSET`, and it confirms all four bytes I had found by experiment.

It also settled the SurfGF question more firmly than the placeholder did. The parse
method only treats byte 25 as GF99 when the deco model uses gradient factors. On DCIEM, a
decompression model that doesn't use gradient factors, it reads the byte as part of a
safe-ascent depth. A general gradient number like SurfGF would never get that special
case, so byte 25 has to be GF99 specifically. That closes the one gap the behaviour
checks left open.

It's the strongest evidence I have, and I put it last on purpose. If I'd read the source
first, I would have trusted a name and skipped the checks. The source tells you what the
bytes are called. Only the data tells you whether your code is right.

## Byte 11, which no oracle could reach

Byte 11 got past all four behaviour checks. It was nonzero in 32,544 of my 33,773
samples, it stayed between 82 and 94 through the deep dive, and it didn't line up with
any exported field, computed summary, physical rule, or the second computer. For a long
time it sat unlabelled in an `extra_json` column, one of the 392,959 undecoded payloads
the store keeps byte for byte.

The fifth oracle finally named it: `BATTERY_PERCENT_REMAINING`. A name in a binary is
still only a guess, so I checked it like the rest. Its values stay between 0 and 100 on
every sample, which a random byte has no reason to do. Behaviour can pin down some
bytes, and the source has to name the others, but either way the answer still has to
hold up against the data.

The rule under all of this is that decoded and verified are two different states, and
only the checks can move a byte from one state to the other. I never guess something
plausible and move on, because in a dive log, a plausible wrong number is worse than a
missing one. Nobody re-checks a number that looks right.

## Every trip re-checks everything

`bottomtime verify` runs against the live store, so every new dive trip re-checks every
mapping: XML agreement on 142 dives, EndGF99 on 142 dives, the ceiling rule on 33,773
samples, 84 two-computer comparisons, plus the row counts and foreign keys. So far the
bytes I found by experiment are validated on a Perdix 2 and a Petrel 3. Every mapping
that passes the suite goes into the [pnf spec](https://github.com/snehankekre/pnf/blob/main/SPEC.md),
and the `pnf` package (`pip install pnf`) decodes it.

If your Teric or Nerd 2 fills these bytes differently, the suite is designed to catch
that instead of quietly decoding it wrong. A failing blob in
[the issue tracker](https://github.com/snehankekre/bottomtime/issues) is data I can't
produce myself. So if you have a Shearwater that disagrees with my mapping, please run
`bottomtime verify` and file the blob.
