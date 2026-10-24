---
title: The bytes my dive computer keeps to itself
publishDate: 2026-07-21
updateDate: 2026-10-24
excerpt: Shearwater Cloud stores every dive as a compressed blob of 32-byte records, and its export files leave some of the fields out. GF99, the deco ceiling, and battery voltage never make it into the exports. So I decoded the blobs myself.
image: '~/assets/images/og-decoding-pnf.png'
draft: false
---

<link rel="stylesheet" href="/posts/decoding-pnf/pnf.css" />

My [Shearwater Perdix 2](https://shearwater.com/pages/perdix-2-support) computes a number
called GF99 every ten seconds of every dive. It tells me how close the gas dissolved in my
body is to the limit my decompression model allows. At 100, I'm right on the limit.

The model is Bühlmann's. It tracks nitrogen and helium in sixteen imaginary tissues, and
each tissue has a maximum it's allowed to reach at a given depth, called its M-value. GF99
takes the tissue that's closest to its maximum and reports how far its gas pressure is
above the surrounding water pressure, as a percentage of how far above it the M-value
allows. It's one of the most interesting numbers a dive computer produces, because it
shows how loaded I am right now.

Shearwater Cloud, the app that stores my dives, plots GF99. But GF99 isn't in the XML
export, which is the file you'd normally use to get your data out, and it isn't in the
CSV either. Neither are the deco ceiling, the battery voltage at each sample, or the @+5
prediction. The app must be reading them from somewhere.

So I went looking, and this post is about what I found. Every computer in Shearwater's
Petrel family logs its dives internally in a format called Petrel Native Format, or PNF.
It's a stream of 32-byte records, and four bytes in each sample record hold the missing
numbers. I first mapped those bytes by experiment, and only later confirmed them against
Shearwater's code. The decoder ships in
[bottomtime](https://github.com/snehankekre/bottomtime), the dive-log store I wrote
because I dive with two computers (`pip install bottomtime`).

## Where the real log lives

[Shearwater Cloud](https://shearwater.com/pages/shearwater-cloud)'s desktop app has three
export options. XML and CSV both leave data out. The third, "Export Database", writes a
SQLite file called `dive_data.db`, and that file holds the complete log. It has a
`log_data` table with a BLOB column, one blob per dive, each tagged `sw-pnf`. A blob
starts with 4 bytes that give its unzipped length as a little-endian integer, and the rest
is a gzip stream:

```python
expected = struct.unpack_from("<I", blob, 0)[0]
data = gzip.decompress(blob[4:])
assert len(data) == expected
assert len(data) % 32 == 0
```

Take my dive #202, 101.5 m at the Drop Off dive site in Tulamben, 102 minutes long. Its
blob is 16,388 bytes. The first four bytes promise 26,496 bytes once it's unzipped, and
gzip delivers exactly that: 828 records of 32 bytes each. That's one record every 10
seconds plus some bookkeeping, and the whole dive takes up less space than a photo on your
phone. Wow \\(\*o*\)/!

Byte 0 of each record says what type of record it is. Here's what dive #202 contains:

| type | meaning | count in dive #202 |
| --- | --- | --- |
| `0x01` | dive sample | 616 |
| `0x10`-`0x19` | opening (config) records | 1 each |
| `0x20`-`0x29` | closing records | 1 each |
| `0x30` | info event | 7 |
| `0x00` | all-zero padding, skipped | 4 |
| `0xFF` | final record (serial, model, firmware) | 1 |
| `0x51`, `0x70`-`0x75`, `0x80`-`0x87`, `0xA0`, `0xA1` | no idea (yet) | 180 |

The opening records hold the dive's settings: the ten programmed gases, the gradient
factor settings, units, water density, atmospheric pressure, and how often to take a
sample. The closing records repeat the same fields with their values at the end of the
dive.

The last row is the one I care about. The decoder stores every record type it doesn't
understand in the database, byte for byte, per dive, in the order it appeared. It never
throws a record away just because I can't read it yet.

## Standing on libdivecomputer

Luckily, I didn't have to start from scratch.
[libdivecomputer](https://github.com/libdivecomputer/libdivecomputer) is an open-source
library that has read Petrel-family computers for years, and its parser,
[`shearwater_predator_parser.c`](https://github.com/libdivecomputer/libdivecomputer/blob/master/src/shearwater_predator_parser.c),
handles PNF directly. A comment in the parser says that compared with the older Predator
format, "the samples are simply offset by one". That's because PNF adds the record-type
byte at the front. The parser also lays out the sample: depth in the first two bytes,
then next stop, TTS (time to surface), gas fractions, temperature, and CNS. Reading it
told me which bytes were already known, and gave me something to check my mapping
against.

That parser is the closest thing PNF has to a public spec. Shearwater does write protocol
documentation, but it only gives it to registered developers through
[a formal process](https://shearwater.com/pages/support).
[Subsurface](https://subsurface-divelog.org/), the open-source dive log, imports the
desktop database by
[querying the tables Shearwater has already decoded](https://github.com/subsurface/subsurface/blob/master/core/import-shearwater.cpp),
and it never opens the blob. So for the undocumented bytes, there was nothing left to
look up.

*Update, 24 October 2026. In my Shearwater Cloud database, the two tables Subsurface
reads dives and samples from (`dive_logs` and `dive_log_records`) are empty, and every
dive exists only as a blob. Opening that database in Subsurface 6.0.5404 imported zero
dives. Downloading from the Perdix over Bluetooth into Subsurface 6.0.5771 works, because
libdivecomputer reads the computer directly.*

If you lay the known offsets over a PNF sample record, they explain 23 of its 32 bytes,
counting the type byte. The other nine are either padding or the fields the exports leave
out. Shearwater Cloud must read at least some of them, because it plots GF99.

## Reading the record, byte by byte

Here is the real record from the deepest sample of dive #202, when the gauge read
101.5 m. Hover over (or tap) any byte:

<div class="pnf-legend">
  <span class="pl pl-doc">documented (libdivecomputer)</span>
  <span class="pl pl-emp">found empirically</span>
  <span class="pl pl-unk">named later, from Shearwater's DLL</span>
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

The known bytes match what my wrist showed at 101.5 m: 11/63 trimix (11% oxygen, 63%
helium), TTS 53 minutes, next stop 33 m, CNS 4%, and water at 25 C. Decoding them takes
nothing more than reading two-byte big-endian numbers and dividing by ten.

## The four bytes I had to find myself

libdivecomputer doesn't read bytes 18, 24, 25, and 26-27, and the exports don't include
them. To map them, I looked at their values across hundreds of dives, guessed what each
one was, and then tried to prove each guess wrong.

Byte 25 was a light-bulb moment. It reads `0xFF` early in a dive, starts showing a value
as my tissues take on gas, falls during long shallow stops, and jumps right at surfacing.
That's how GF99 should behave. Its value at the end of each dive also lands on the
`EndGF99` number that Shearwater Cloud computes for that dive. Byte 24 follows the depth
during deco and is never deeper than the stop depth, which moves in 3 m steps. It drops to
zero as soon as deco is done. That's the ceiling! Byte 18 equalled the XML export's
`batteryVoltage` times 100 on every sample I checked. Bytes 26-27 followed TTS but stayed
ahead of it by a sensible margin. That's the @+5 field on the display, which shows what my
TTS would be if I stayed five more minutes.

Here's dive #202 with those bytes plotted. The red ceiling line rides just under the grey
stop depth, and GF99 starts showing a value at the 17-minute mark, once the tissues have
something to report:

![Depth, stop depth and decoded ceiling for a 101.5 m dive, with GF99 below, showing the 0xFF span during on-gassing](/posts/decoding-pnf/gf99-ceiling.png)

But a curve that behaves the right way is still only circumstantial evidence. Hmm  (╭ರ_•́)..

So I wrote a verification suite. It checks every decoded channel, sample by sample,
against Shearwater's outputs for all 142 of my Shearwater dives, and it gets
[its own post](/posts/verifying-undocumented-bytes). The short version: across every
sample that both my decoder and Shearwater's XML have, the biggest difference is 0.0000.
And byte 25's value at surfacing matches Cloud's EndGF99 within one GF point on 142 of 142
dives.

## Then I read Shearwater's code

I could have stopped at the verification suite. Then a
[Reddit comment](https://www.reddit.com/r/AskReverseEngineering/comments/1gq9vth/comment/mbtywtv/?context=3)
pointed out that Shearwater Cloud ships its parser as a .NET assembly called
`DiveLogParser.dll`. You can open the class `PetrelNativeLogV14Parser` in a decompiler and
read the format straight out of it. The comment described a Windows workflow, and I'm on a
Mac. But the macOS build of Shearwater Cloud is a Unity app, and it ships the same .NET
DLL under `Shearwater Cloud.app/Contents/Resources/Data/Managed/`. It was real .NET
bytecode, so I could read it.

The byte offsets are stored as named constants in the assembly's metadata, so I didn't
even need a decompiler. [dnfile](https://github.com/malwarefrank/dnfile), a pure-Python
reader for .NET files, prints them out directly. Here's what Shearwater calls the bytes I
had mapped by hand:

```
GF99_OFFSET                = 25
DECOCEILING_OFFSET         = 24
BATTERYVOLTAGE_OFFSET_LSB  = 18
ATPLUSFIVE_1ST_BYTE_OFFSET = 26
```

Four for four, sweet! The same table also named three bytes I had filed under "no idea".
Byte 11 is `BATTERY_PERCENT_REMAINING`. That's why it sat in the eighties and nineties,
and I checked that it never once goes above 100 across all 32,544 samples. Byte 17 is
`BATTERYVOLTAGE_OFFSET_MSB`, the high byte of a 16-bit battery voltage whose low byte is
byte 18. It reads zero only because 1.5 volts never needs the high byte. Bytes 30-31 hold
surface air consumption (SAC). Shearwater's constant calls it `RESPIRATORY_MINUTE_VOLUME`,
but the parse method reads it as SAC and divides by 100. Either way it's `0xFFFF` for me,
because I dive without gas integration.

Decompiling the parse method itself with [ILSpy](https://github.com/icsharpcode/ILSpy)
showed something the constants alone didn't. Bytes 24 and 25 only mean ceiling and GF99
when the decompression model uses gradient factors:

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

DCIEM is a decompression model that doesn't use gradient factors, and on a DCIEM dive
those two bytes hold a safe-ascent depth instead. My decoder reads byte 25 as GF99 no
matter what, so it would decode a DCIEM dive wrong. All 142 of my dives use gradient
factors, so the bug has never fired. My data just never contained the case that breaks my
code. It's on the fix list now, and I found it by reading the vendor's code instead of my
logs lol.

## What I still can't read

Once I looked, most of the record types I'd shrugged at earlier had names too.
`0x70`-`0x75` are snapshots of tissue loading, `0x80`-`0x88` are bitmaps that say which
fields in the opening and sample records are valid, and `0x60` is a log of ppO2 at the
surface. Three types in my dives are still unexplained: `0x51`, `0xA0`, and `0xA1`.

They stay in the `undecoded_payloads` table, byte for byte. That table has 392,959 rows
and counting, including Garmin's mystery FIT messages. I archive the original blobs and
version the decoder, so when someone works out one of these types, I can re-decode from
the archive and every past dive gains the new channel. I don't need to download anything
again, even if the computer that logged the dive is long dead by then. That archive-first
design is its own story.

I wrote all of this up as a standalone
[format specification](https://github.com/snehankekre/pnf/blob/main/SPEC.md). I also
pulled the decoder into its own pure-Python package, [pnf](https://github.com/snehankekre/pnf)
(`pip install pnf`), for anyone who wants to read Petrel logs without the rest of my dive
store.

I've validated these mappings on a Perdix 2 and on a Petrel 3, which was controlling a
Choptima CCR (a closed-circuit rebreather). Other models in the family may fill these
bytes differently. If yours disagrees, `bottomtime verify` will tell you loudly, and I
would love the failing blob. [Issues welcome](https://github.com/snehankekre/bottomtime/issues).
