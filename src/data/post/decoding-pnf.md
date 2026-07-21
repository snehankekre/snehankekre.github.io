---
title: The bytes my dive computer keeps to itself
publishDate: 2026-07-21
excerpt: Shearwater Cloud stores every dive as a gzip blob of 32-byte records, then exports a subset of it. GF99, deco ceiling, and battery voltage stay behind. So I decoded the blobs myself.
image: '~/assets/images/og-decoding-pnf.png'
draft: false
---

<link rel="stylesheet" href="/posts/decoding-pnf/pnf.css" />

My [Shearwater Perdix 2](https://shearwater.com/pages/perdix-2-support) computes a number called GF99 every ten seconds of every dive: the
leading tissue's supersaturation as a percentage of its Bühlmann M-value at my current
depth. In plainer words, it says how close my dissolved gas load is to the decompression
model's limit, where 100 means I'm standing on the line. It's one of the most interesting
numbers a dive computer produces, a live readout of how loaded I actually am, and
Shearwater Cloud plots it. But the XML export, the thing
you'd reach for to get your data out, doesn't contain it, and neither does the CSV. Same
for the deco ceiling, the per-sample battery voltage, and the @+5 prediction. The app is
clearly reading them from somewhere.

So I went looking. This post is about what I
found: Shearwater's Petrel Native Format, the 32-byte record stream every Petrel-family
computer logs internally, and the four bytes in it I first mapped by experiment and only
later confirmed against Shearwater's own code. The decoder ships in
[bottomtime](https://github.com/snehankekre/bottomtime), the dive-log store I wrote for
my two-computer logging habit (`pip install bottomtime`).

## Where the real log lives

[Shearwater Cloud](https://shearwater.com/pages/shearwater-cloud)'s desktop app has three export options. XML and CSV are lossy renderings.
The third, "Export Database", writes a SQLite file called `dive_data.db`, and that one
contains the real log. Inside there's a `log_data` table with a BLOB column, one blob per dive,
tagged `sw-pnf`. The blob layout is a 4-byte little-endian length followed by a gzip
stream:

```python
expected = struct.unpack_from("<I", blob, 0)[0]
data = gzip.decompress(blob[4:])
assert len(data) == expected
assert len(data) % 32 == 0
```

For my dive #202 (101.5 m at Drop Off dive site Tulamben, 102 minutes runtime), the blob is 16,388 bytes,
the prefix promises 26,496, and gzip delivers it: 828 records of 32 bytes.
The whole dive which is one record every 10 seconds plus bookkeeping, is compressed smaller than a
photo on your phone. Wow \\(\*o*\)/!

Byte 0 of each record is its type. In that dive the stream looks like this:

| type | meaning | count in dive #202 |
| --- | --- | --- |
| `0x01` | dive sample | 616 |
| `0x10`-`0x19` | opening (config) records | 1 each |
| `0x20`-`0x29` | closing records | 1 each |
| `0x30` | info event | 7 |
| `0x00` | all-zero padding, skipped | 4 |
| `0xFF` | final record (serial, model, firmware) | 1 |
| `0x51`, `0x70`-`0x75`, `0x80`-`0x87`, `0xA0`, `0xA1` | no idea (yet) | 180 |

The opening records carry the dive's configuration: the ten programmed gases, gradient
factor settings, units, water density, atmospheric pressure, sample interval. The
closing records mirror them with end-of-dive state.

The last row is the one I care about. Every record type the decoder doesn't understand
is stored verbatim in the database, per dive, in stream order. Nothing is dropped just
because I can't read it today.

## Standing on libdivecomputer

Luckily, I didn't have to start from scratch. The open-source
[libdivecomputer](https://github.com/libdivecomputer/libdivecomputer) project has
supported Petrel-family computers for years, and its
[`shearwater_predator_parser.c`](https://github.com/libdivecomputer/libdivecomputer/blob/master/src/shearwater_predator_parser.c)
handles PNF explicitly. A comment in the parser notes that relative to the legacy
Predator format "the samples are simply offset by one", because PNF prepends the
record-type byte, and it documents the sample layout: depth in the first two bytes of
a sample, then next stop, TTS, gas fractions, temperature, CNS. Reading that parser is how
I knew what the documented bytes were, and how to check my own mapping against them.

That parser is as close to a public spec as PNF gets. Shearwater does write protocol
documentation, but hands it only to registered developers through
[a formal process](https://shearwater.com/pages/support).
[Subsurface](https://subsurface-divelog.org/) imports the desktop database by
[querying its pre-decoded tables](https://github.com/subsurface/subsurface/blob/master/core/import-shearwater.cpp)
and never opens the blob. So for the undocumented bytes, there was nothing left to look
up.

Lay the documented offsets over a PNF sample record and 23 of its 32 bytes are
accounted for, counting the type byte. The other nine are either padding or they're the
fields the exports omit, and Shearwater Cloud clearly reads *something* more, because
it plots GF99.

## Reading the record, byte by byte

Here is the actual record from the deepest sample of dive #202, the moment the gauge
read 101.5 m. Hover (or tap) any byte:

<div class="pnf-legend">
  <span class="pl pl-doc">documented (libdivecomputer)</span>
  <span class="pl pl-emp">found empirically</span>
  <span class="pl pl-unk">named later, from Shearwater's own DLL</span>
</div>
<div class="pnf-grid">
  <span class="b doc f-type" tabindex="0" data-t="byte 0: record type 0x01 = dive sample">01</span>
  <span class="b doc f-depth" tabindex="0" data-t="bytes 1-2: depth, u16 BE. 0x03F7 = 1015, /10 = 101.5 m">03</span>
  <span class="b doc f-depth" tabindex="0" data-t="bytes 1-2: depth, u16 BE. 0x03F7 = 1015, /10 = 101.5 m">f7</span>
  <span class="b doc f-stop" tabindex="0" data-t="bytes 3-4: next stop depth, u16 BE = 33 m">00</span>
  <span class="b doc f-stop" tabindex="0" data-t="bytes 3-4: next stop depth, u16 BE = 33 m">21</span>
  <span class="b doc f-tts" tabindex="0" data-t="bytes 5-6: time to surface, u16 BE = 53 min">00</span>
  <span class="b doc f-tts" tabindex="0" data-t="bytes 5-6: time to surface, u16 BE = 53 min">35</span>
  <span class="b doc f-ppo2" tabindex="0" data-t="byte 7: average ppO2. 0x79 = 121, /100 = 1.21 ata">79</span>
  <span class="b doc f-o2" tabindex="0" data-t="byte 8: O2 fraction = 11%">0b</span>
  <span class="b doc f-he" tabindex="0" data-t="byte 9: He fraction. 0x3F = 63%">3f</span>
  <span class="b doc f-stoptime" tabindex="0" data-t="byte 10: stop time = 1 min">01</span>
  <span class="b unk f-b11" tabindex="0" data-t="byte 11: battery percent remaining (named in Shearwater's DLL). 0x5B = 91% here">5b</span>
  <span class="b doc f-flags" tabindex="0" data-t="byte 12: status flags. 0x12 = OC mode + external ppO2">12</span>
  <span class="b doc f-s1" tabindex="0" data-t="byte 13: ppO2 sensor 1 raw (0 here, this dive is OC)">00</span>
  <span class="b doc f-temp" tabindex="0" data-t="byte 14: water temperature, signed = 25 C">19</span>
  <span class="b doc f-s2" tabindex="0" data-t="byte 15: ppO2 sensor 2 raw">00</span>
  <span class="b doc f-s3" tabindex="0" data-t="byte 16: ppO2 sensor 3 raw">00</span>
  <span class="b unk f-b17" tabindex="0" data-t="byte 17: battery voltage high byte. Value is (byte17<<8 | byte18)/100; zero here because 1.5 V fits in one byte">00</span>
  <span class="b emp f-batt" tabindex="0" data-t="byte 18: battery voltage low byte. (0x00<<8 | 0x98)/100 = 1.52 V">98</span>
  <span class="b doc f-sp" tabindex="0" data-t="byte 19: CC setpoint (0.70 here; ignored on OC)">46</span>
  <span class="b doc f-tank1" tabindex="0" data-t="bytes 20-21: tank 1 pressure (AI). 0xFFFF = no transmitter">ff</span>
  <span class="b doc f-tank1" tabindex="0" data-t="bytes 20-21: tank 1 pressure (AI). 0xFFFF = no transmitter">ff</span>
  <span class="b doc f-gtr" tabindex="0" data-t="byte 22: gas time remaining. 0xFF = n/a">ff</span>
  <span class="b doc f-cns" tabindex="0" data-t="byte 23: CNS = 4%">04</span>
  <span class="b emp f-ceil" tabindex="0" data-t="byte 24: deco ceiling. 0x1F = 31 m">1f</span>
  <span class="b emp f-gf99" tabindex="0" data-t="byte 25: GF99 on gradient-factor models. 0xFF = not available (tissues still on-gassing). On DCIEM this byte is a safe-ascent-depth fraction instead">ff</span>
  <span class="b emp f-at5" tabindex="0" data-t="bytes 26-27: @+5, u16 BE = 85 min (TTS if I stayed 5 more minutes)">00</span>
  <span class="b emp f-at5" tabindex="0" data-t="bytes 26-27: @+5, u16 BE = 85 min (TTS if I stayed 5 more minutes)">55</span>
  <span class="b doc f-tank0" tabindex="0" data-t="bytes 28-29: tank 0 pressure (AI). 0xFFFF = no transmitter">ff</span>
  <span class="b doc f-tank0" tabindex="0" data-t="bytes 28-29: tank 0 pressure (AI). 0xFFFF = no transmitter">ff</span>
  <span class="b unk f-b30" tabindex="0" data-t="bytes 30-31: surface air consumption (SAC), u16 / 100. Shearwater's constant names it RESPIRATORY_MINUTE_VOLUME. 0xFFFF = n/a; I dive without gas integration">ff</span>
  <span class="b unk f-b30" tabindex="0" data-t="bytes 30-31: surface air consumption (SAC), u16 / 100. Shearwater's constant names it RESPIRATORY_MINUTE_VOLUME. 0xFFFF = n/a; I dive without gas integration">ff</span>
</div>

The documented bytes check out against what my wrist showed at 101.5 m: 11/63 trimix,
TTS 53 minutes, next stop 33 m, CNS 4%, water 25 C. The arithmetic is nothing fancier
than big-endian shorts and a divide by ten.

## The four bytes I had to find myself

Bytes 18, 24, 25 and 26-27 are the ones libdivecomputer doesn't read and the exports
don't include. Mapping them was an empirical process where I had to stare at the values across
hundreds of dives, form a hypothesis, and try to falsify it.

Byte 25 was an interesting light bulb moment. It reads `0xFF` early in a dive, wakes up as tissues load, decays
during long shallow stops, and spikes right at surfacing. That is exactly how GF99 should
behave, and it converges on the `EndGF99` value Shearwater Cloud computes for each dive.
Byte 24 hugs the depth profile from below during deco, always sitting at or just under
the 3 m-quantized stop depth, and zeroes the moment deco clears. That's the ceiling!
Byte 18 matched the XML export's `batteryVoltage` times 100 on every sample I checked.
Bytes 26-27 tracked TTS but ran ahead of it by a sensible margin, which is the @+5
display field, TTS if I stayed five more minutes.

Here's dive #202 with the empirical bytes plotted. Ceiling in red riding under the grey
quantized stop depth and GF99 waking up at the 17-minute mark once the tissues actually
have something to report:

![Depth, stop depth and decoded ceiling for a 101.5 m dive, with GF99 below, showing the 0xFF span during on-gassing](/posts/decoding-pnf/gf99-ceiling.png)

But a curve that behaves right is still circumstantial. Hmm  (╭ರ_•́)..

So I wrote a verification suite that cross-checks every decoded channel, per sample,
against Shearwater's own outputs across all 142 dives on this Perdix, and it deserves
its own post. Short version: the worst
disagreement between my decoder and Shearwater's XML across every shared sample is
0.0000, and byte 25's surfacing value agrees with Cloud's EndGF99 on 142 of 142 dives
within one GF point.

## Then I read Shearwater's own code

I could have stopped at the verification suite. Then a [Reddit comment](https://www.reddit.com/r/AskReverseEngineering/comments/1gq9vth/comment/mbtywtv/?context=3) pointed out that
Shearwater Cloud ships its parser as a .NET assembly, `DiveLogParser.dll`, and that you
can open the class `PetrelNativeLogV14Parser` in a decompiler and read the format
directly. That's a Windows workflow, and I'm on a Mac, but the macOS build of Shearwater
Cloud is a Unity app and it ships the same managed DLL under
`Shearwater Cloud.app/Contents/Resources/Data/Managed/`. It turned out to be real
.NET bytecode which I could read.

The byte offsets are stored as named constants right in the assembly metadata, so I
didn't even need a decompiler. [dnfile](https://github.com/malwarefrank/dnfile), a
pure-Python reader, dumps them straight out. Here is what Shearwater calls the bytes I
had mapped by hand:

```
GF99_OFFSET                = 25
DECOCEILING_OFFSET         = 24
BATTERYVOLTAGE_OFFSET_LSB  = 18
ATPLUSFIVE_1ST_BYTE_OFFSET = 26
```

Four for four, sweet! And three bytes I'd filed under "no idea" got names in the same table.
Byte 11 is `BATTERY_PERCENT_REMAINING`, which is why it sat in the eighties and nineties
and, I checked, never once exceeds 100 across all 32,544 samples. Byte 17 is
`BATTERYVOLTAGE_OFFSET_MSB`: the high byte of a sixteen-bit battery voltage whose low
byte is 18, reading zero only because 1.5 volts never needs the high byte. Bytes 30-31
hold surface air consumption. Shearwater's constant calls it
`RESPIRATORY_MINUTE_VOLUME` but the parse method reads it as SAC and divides by 100.
Either way it's `0xFFFF` for me, since I dive without gas integration.

Decompiling the actual parse method with [ILSpy](https://github.com/icsharpcode/ILSpy)
caught something the that wasn't obvious from the constants alone. Bytes 24 and 25 are ceiling and GF99 only when
the decompression model uses gradient factors:

```csharp
if (headerDecoModel == 3) {   // DCIEM
    byte b = logData[offset + 24];
    float frac = logData[offset + 25] / 100f;
    sample.SafeAscentDepth = b - frac;
} else {                      // GF, VPM-B, VPM-B/GFS
    sample.DecoCeiling = logData[offset + 24];
    sample.Gf99 = logData[offset + 25];
}
```

On a DCIEM dive those two bytes are a safe-ascent depth instead, and my decoder, which
reads byte 25 as GF99 no matter what, would mis-decode it. All 142 of my dives run
gradient factors, so the bug has never fired. My data just never contained the case that breaks my code. 
It's on the fix list now though, found by reading the vendor instead of my own logs lol.

## What's still dark

Even the record types I'd shrugged at earlier were mostly named once I looked. `0x70`-`0x75` are
tissue-loading snapshots, `0x80`-`0x88` are validity bitmaps for the opening and sample
records, `0x60` is a surface ppO2 log. Three types in my dives are still unexplained.
`0x51`, `0xA0`, and `0xA1`.

They stay in the `undecoded_payloads` table (392,959 rows and counting, Garmin's mystery
FIT messages included), verbatim, because the blobs are archived and the decoder is
versioned. When someone works one out, I re-decode from the archive and every past dive
gains the channel, no re-download needed, even if the computer that logged it is long
dead by then. That archive-first design is
its own story.

I wrote all of this up as a standalone
[format specification](https://github.com/snehankekre/pnf/blob/main/SPEC.md), and pulled
the decoder into its own pure-Python package for anyone who wants to read Petrel logs
without the rest of my dive store: [pnf](https://github.com/snehankekre/pnf)
(`pip install pnf`).

The mappings above are validated on a Perdix 2 and a Petrel 3 (the latter driving a
Choptima CCR). Other models in the family may populate these bytes differently. If yours
disagrees, `bottomtime verify` will say so loudly, and I would love the failing
blob: [issues welcome](https://github.com/snehankekre/bottomtime/issues).
