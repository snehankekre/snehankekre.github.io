---
title: My dive computer records 17 channels. Subsurface exports 4.
publishDate: 2026-08-05
excerpt: "Divers blame the open dive-log formats for losing decompression data. I counted the fields. UDDF has had a field for GF99 since 2018, DAN's DL7 format has had one for the deco ceiling since 2006, and there's an unpublished version of UDDF that real software already writes."
image: '~/assets/images/og-lossy-dive-formats.png'
draft: false
---

My Perdix 2 records seventeen channels in every sample. The open dive-log formats have
fields for sixteen of them. [Subsurface](https://subsurface-divelog.org/), the best
open-source dive log there is, exports four.

Divers blame the formats for that gap. I did too, [in my own
README](https://github.com/snehankekre/bottomtime/blob/78b0b48057fcf56d8400a61afa84caa3aca012c9/README.md?plain=1#L9).
After counting the fields, I think the gap is in the exporters, the programs that write
these formats and leave most of the fields empty.

## One dive, seventeen channels

Here's one dive: `A823C228#13`, 101.5 metres, 101 minutes, 616 samples, breathing
open-circuit trimix. These are the columns that have data for that dive, which is fewer
than the schema allows:

depth, temperature, GF99, deco ceiling, time to surface, next stop depth, next stop
time, CNS percent, battery percent, battery voltage, average ppO2, oxygen fraction,
helium fraction, an in-deco flag, a packed status byte, a solenoid fire count, and one
raw oxygen sensor reading.

GF99 is the channel divers assume is locked inside vendor formats. It shows how close
your leading tissue is to its Bühlmann limit. It lives in byte 25 of Shearwater's sample
record, Shearwater has never documented it, and I spent two weeks
[proving it was what I thought it was](/posts/verifying-undocumented-bytes).

![Matrix of 17 dive channels against four formats. UDDF 3.2.3 carries 12, DL7 2006 carries 7, the unpublished UDDF 3.3.0 carries 13, and Subsurface's UDDF exporter writes 4. Only the solenoid fire count is absent everywhere.](/posts/lossy-dive-formats/channel-matrix.svg)

*Filled means the format has a place to put that channel. Between them, the three
specifications cover sixteen of the seventeen. The exporter column is the one your data
goes through.*

## UDDF added GF99 in 2018

UDDF, the Universal Dive Data Format, is an XML schema for dive logs. This element comes
from `uddf_3.2.3.xsd`, inside `waypointType`, which is the record for one sample:

```xml
<xs:element name="gradientfactor" minOccurs="0">
  <xs:complexType><xs:simpleContent>
    <xs:extension base="xs:float">
      <xs:attribute name="tissue" type="xs:int"/>
    </xs:extension>
  </xs:simpleContent></xs:complexType>
</xs:element>
```

That's a gradient factor for every sample, with an attribute that says which of the
sixteen tissue compartments is leading. My dive computer doesn't record which compartment
is leading, so on this field the XML standard can hold more than the binary format I
reverse engineered.

The description next to the element is unclear. It calls the value "80 % of the maximum
tolerated saturation". That's not how Shearwater defines GF99, and the two quantities only
agree at zero ambient pressure. Real files settle the question. Subsurface includes a log
from an APD Inspiration rebreather in its test data. In that file, `<gradientfactor>`
appears 695 times with nineteen different values, climbing from 0.50 to 0.70. The same
dive has `<setgflow>` set to 0.50 and `<setgfhigh>` set to 0.70. A number that climbs from
the diver's low setting to their high setting over a dive is a live GF readout.

UDDF waypoints can also hold `<batterychargecondition>`, `<cns>`, `<otu>`, `<decostop>`,
`<nodecotime>`, `<setpo2>`, `<measuredpo2>`, `<heartrate>`, and `<tankpressure>`. That
covers twelve of my seventeen channels. `<decostop>` is the next stop, which is a
different number from the current ceiling. UDDF has an element for the next stop and none
for the ceiling.

## DL7 had the ceiling in 2006

UDDF has no ceiling and no status byte. DL7 had both in 2006, twelve years earlier.

DL7 is the format Divers Alert Network (DAN) built for Project Dive Exploration, its study
that collected dive profiles from recreational divers. The specification is a Word
document by Petar J. Denoble dated July 2006, and it survives in the docs folder of an
[archived Python library](https://github.com/johnstonskj/PyDL7). It's made of segments
with attribute tables, it uses delimiters borrowed from HL7 (a healthcare data standard),
and it has code tables for things like dive computer models and gases.

Its per-sample segment is called ZDP. Here are two of its fields:

```
7 | 6 | NM | O | Current Ceiling | Value
9 |   | ST | O | Warning number  | Warning number(s) in Hex as defined within the
                                   specific Unit. May contain more that one Warning
                                   Number separated by character ^
```

The first is a deco ceiling for every sample. The second is a warning word in hex for
every sample, where each dive computer decides what each bit means. That's a packed
status byte under another name. DAN specified both eight years before my dive computer
existed.

UDDF kept changing after 2018, but none of the changes are on its website.

## UDDF 3.3.0 was never published. Software writes it anyway.

The newest published release is UDDF 3.2.3, dated 15 November 2018. But a version 3.3.0
also exists, in files that people are writing today.

Subsurface's test data includes `dives/test-apd-inspiration.uddf`. The file starts with
`<uddf version="3.3.0">`, and its waypoints contain this:

```xml
<ppo2 ref="o2sensor_c1_1">35000.0</ppo2>
<batteryvoltage ref="battery_c1_1">5.6</batteryvoltage>
<batteryvoltage ref="battery_c1_2">5.7</batteryvoltage>
```

That's a battery voltage for every waypoint and every device, so a rebreather with two
controllers records both. Elsewhere in the same file there's
`<timetosurface>60.0</timetosurface>`. Each oxygen sensor also gets its own reading,
instead of one averaged number.

That version was never released. The UDDF site lists 3.2.1 as current, and its HTTPS
certificate expired in July 2025 and was issued for a different hostname. The schema
directory stops at 3.2.2. Meanwhile, commercial dive software writes 3.3.0 files, and an
open-source dive log keeps one as a test file.

Across all three specifications, sixteen of my seventeen channels have a place to go. The
seventeenth is the number of times a rebreather's solenoid fired to inject oxygen, and
none of the formats has a field for it.

So the most recent useful version of the standard is an unpublished agreement between
vendors, and the only way to find it is to read their files.

## Subsurface reads more UDDF than it writes

Subsurface keeps each sample in memory in a structure defined in `core/sample.h`. It
holds time, stoptime, ndl, tts, rbt, depth, stopdepth, temperature, ten cylinder
pressures, setpoint, six oxygen sensor readings plus one ppO2 value reported by the
computer, bearing, cns, heartbeat, sac, and an in-deco flag. That covers most of my dive.

Its UDDF exporter is `xslt/uddf-export.xslt`, a 773-line file with two places that write
waypoints. Between them they write seven elements: `depth`, `divetime`, `temperature`,
`tankpressure`, `switchmix`, `alarm`, and `heading`. The file contains no `xsl:element`
and doesn't build element names on the fly, so that list is complete.

So Subsurface holds ndl, tts, cns, setpoint, oxygen sensors, and heart rate in memory, and
UDDF has elements for all of them, but the exporter writes none of them.

Importing is different. It goes through a second stylesheet, `xslt/uddf.xslt`, which is
1,050 lines long and handles `alarm`, `heading`, `cns`, `otu`, `batteryvoltage`,
`setgflow`, `setgfhigh`, `scrubber`, and `divemode`. It will even read the per-sensor
`<ppo2>` values and battery voltages from a 3.3.0 file that no published schema
describes.

So the same project ships a reader that understands the detailed half of UDDF and a
writer that outputs seven elements of it. Whatever a Subsurface user exports, the next
program gets a thinner dive than Subsurface could have described.

For my 101 metre dive, that's seventeen channels recorded, sixteen that the formats could
carry, and four written: depth, time, temperature, and gas.

None of this is a complaint about Subsurface. It's free, it's excellent, and it's the
reason most divers have their data at all. That XSLT file is old, XSLT is a miserable
language to extend, and UDDF export matters far less to Subsurface's users than
supporting the next dive computer over USB. Jef Driesen, who maintains libdivecomputer,
is thanked in UDDF's own list of authors. These people have done far more for open dive
data than I have. The data still gets thinner at the end of the chain, and UDDF's authors
saw that coming.

## UDDF has a place for the raw bytes. Nobody uses it.

UDDF has an element called `<dcdump>` that holds the dive computer's raw memory,
compressed with bzip2 and encoded as base64. The documentation explains why it's there:

> Such file can be useful as dive computer data backup; of course the backup usually
> cannot be restored to original device but UDDF software can access it later, i.e. to
> perform another, more complete conversion into UDDF format

Someone in 2018 had seen data get lost in conversion often enough to add a place for the
original bytes, so that a better decoder could come back to them later. It sits under
`<divecomputercontrol>`, next to the log instead of inside it. I have never seen a tool
write one.

My own store works the same way. It keeps the original bytes, each file named by the hash
of its contents, and treats the decoded database as a view I can rebuild. I built it
because I thought the formats had failed me. But the formats had done their part. Every
program that uses them implements only the part its author needed at the time. That part
becomes the format in practice, and you only find out which part it was years later, when
you finally have a question that the missing fields would have answered.

## The same thing happens outside diving

Dive logs are small enough that you can count every field and read every exporter in an
afternoon. That's the only unusual thing about this case.

RFC 5545, the calendar standard, defines six component types and three alarm actions.
Google's CalDAV API supports four of the six types and two of the three actions, and
Google's own developer documentation says so: "Doesn't support `VTODO` or `VJOURNAL`
data", "Doesn't support the `AUDIO` action". Any format where a committee wrote a large
specification, and a few libraries implemented the parts their authors needed, works this
way. Healthcare records and geospatial data are two more examples.

So stop judging a format by its specification. Judge it by what the tools you use will
read and write. That overlap is smaller than the spec and smaller than any single tool's
internal model, and you can measure it in an afternoon. Then keep the original bytes,
because the data that survives is whatever two programs happened to agree on, and that's
never the part you'll want.

## Sources

UDDF 3.2.3, the newest published release:

- [The documentation index](https://www.streit.cc/resources/UDDF/v3.2.3/en/index.html),
  dated 15 November 2018
- [`uddf_3.2.3.xsd`](https://www.streit.cc/resources/UDDF/v3.2.3/schema/uddf_3.2.3.xsd),
  the schema itself, which the documentation's own schema chapter does not link
- [`<waypoint>`](https://www.streit.cc/resources/UDDF/v3.2.3/en/waypoint.html),
  [`<gradientfactor>`](https://www.streit.cc/resources/UDDF/v3.2.3/en/gradientfactor.html)
  and [`<dcdump>`](https://www.streit.cc/resources/UDDF/v3.2.3/en/dcdump.html)

DL7:

- [DL7 Standard](https://github.com/johnstonskj/PyDL7/blob/master/docs/reference/dl7-specification.doc),
  Divers Alert Network, Petar J. Denoble, July 2006. A Word file in the archived PyDL7
  repository, which is the only copy I could find.

Subsurface, read at master:

- [`core/sample.h`](https://github.com/subsurface/subsurface/blob/master/core/sample.h),
  what it holds per sample
- [`xslt/uddf-export.xslt`](https://github.com/subsurface/subsurface/blob/master/xslt/uddf-export.xslt),
  what it writes
- [`xslt/uddf.xslt`](https://github.com/subsurface/subsurface/blob/master/xslt/uddf.xslt),
  what it reads
- [`dives/test-apd-inspiration.uddf`](https://github.com/subsurface/subsurface/blob/master/dives/test-apd-inspiration.uddf),
  the UDDF 3.3.0 file

Calendars:

- [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545.txt), the component types in
  sections 3.6.1 to 3.6.6 and the alarm actions in section 3.8.6.1
- [Google's CalDAV API developer guide](https://developers.google.com/workspace/calendar/caldav/v2/guide),
  under Specifications, where the unsupported list lives

Channel counts come from my own store, one query per column across the 616 samples of
`A823C228#13`. The decoder is [bottomtime](https://github.com/snehankekre/bottomtime)
and the format work behind it is [pnf](https://github.com/snehankekre/pnf).
