---
title: My dive computer records 17 channels. Subsurface exports 4.
publishDate: 2026-08-05
excerpt: "Divers blame the interchange formats for losing decompression data. I counted the fields. UDDF has carried GF99 since 2018, DAN's format has carried the deco ceiling since 2006, and there is a version of UDDF that real software writes and that was never published."
image: '~/assets/images/og-lossy-dive-formats.png'
draft: false
---

My Perdix 2 records seventeen channels per sample. The open formats can carry sixteen of
them. [Subsurface](https://subsurface-divelog.org/), the best open-source dive log there is, exports four.

Divers blame the formats for that gap. I did too, [in my own
README](https://github.com/snehankekre/bottomtime/blob/78b0b48057fcf56d8400a61afa84caa3aca012c9/README.md?plain=1#L9).
The gap is in the exporters.

## One dive, seventeen channels

`A823C228#13`, 101.5 metres, 101 minutes, 616 samples, open-circuit trimix. Counting the
columns actually populated for that dive rather than what the schema permits:

depth, temperature, GF99, deco ceiling, time to surface, next stop depth, next stop
time, CNS percent, battery percent, battery voltage, average ppO2, oxygen fraction,
helium fraction, an in-deco flag, a packed status byte, a solenoid fire count, and one
raw oxygen sensor reading.

GF99 is the channel divers assume is trapped in vendor formats. It reads out how close
your leading tissue is to its Bühlmann limit, it lives in byte 25 of Shearwater's sample
record, Shearwater has never documented it, and I spent a fortnight
[proving it was what I thought it was](/posts/verifying-undocumented-bytes).

![Matrix of 17 dive channels against four formats. UDDF 3.2.3 carries 12, DL7 2006 carries 7, the unpublished UDDF 3.3.0 carries 13, and Subsurface's UDDF exporter writes 4. Only the solenoid fire count is absent everywhere.](/posts/lossy-dive-formats/channel-matrix.svg)

*Filled means the format has somewhere to put that channel. The three specifications
between them cover sixteen of the seventeen. The exporter column is the one your data
passes through.*

## UDDF standardised GF99 in 2018

UDDF is the Universal Dive Data Format, an XML schema for dive logs. From
`uddf_3.2.3.xsd`, inside `waypointType`, the per-sample record:

```xml
<xs:element name="gradientfactor" minOccurs="0">
  <xs:complexType><xs:simpleContent>
    <xs:extension base="xs:float">
      <xs:attribute name="tissue" type="xs:int"/>
    </xs:extension>
  </xs:simpleContent></xs:complexType>
</xs:element>
```

A per-sample gradient factor, with an attribute naming which of the sixteen compartments
is leading. My dive computer does not record that attribute. On this field the XML
standard beats the binary format I reverse engineered.

The prose around it is ambiguous. It calls the value "80 % of the maximum tolerated
saturation", which is not how Shearwater defines GF99, and the two quantities agree only
at zero ambient pressure. The usage settles it. Subsurface ships an APD Inspiration log
in its test data where `<gradientfactor>` appears 695 times across nineteen values,
climbing from 0.50 to 0.70, while that dive's `<setgflow>` is 0.50 and its
`<setgfhigh>` is 0.70. A number that walks from the diver's low setting to their high
setting over a dive is a live GF readout.

`<batterychargecondition>`, `<cns>`, `<otu>`, `<decostop>`, `<nodecotime>`, `<setpo2>`,
`<measuredpo2>`, `<heartrate>` and `<tankpressure>` are waypoint children too. Twelve of
my seventeen. `<decostop>` is the next stop, which is a different number from the
current ceiling. UDDF has an element for the first and none for the second.

## DL7 had the ceiling in 2006

UDDF has no ceiling and no status byte. DL7 had both in 2006, twelve years earlier.

DL7 is Divers Alert Network's format, built for Project Dive Exploration. The
specification is a Word document by Petar J. Denoble dated July 2006, and it survives in
the docs directory of an [archived Python library](https://github.com/johnstonskj/PyDL7).
Segment attribute tables, HL7-derived delimiters, coded value tables for computer
identifiers and gas codes.

Its per-sample segment is ZDP. Two of its fields:

```
7 | 6 | NM | O | Current Ceiling | Value
9 |   | ST | O | Warning number  | Warning number(s) in Hex as defined within the
                                   specific Unit. May contain more that one Warning
                                   Number separated by character ^
```

A per-sample deco ceiling, and a per-sample hex warning word whose bits each computer
defines for itself. The second one is a packed status byte under another name. DAN
specified both eight years before my dive computer existed.

UDDF kept growing after 2018. None of the growth is on its website.

## UDDF 3.3.0 was never published. Software writes it anyway.

UDDF 3.2.3, dated 15 November 2018, is the newest published release. A 3.3.0 exists
too, in files people are writing today.

Subsurface's test data contains `dives/test-apd-inspiration.uddf`. It opens
`<uddf version="3.3.0">` and its waypoints carry this:

```xml
<ppo2 ref="o2sensor_c1_1">35000.0</ppo2>
<batteryvoltage ref="battery_c1_1">5.6</batteryvoltage>
<batteryvoltage ref="battery_c1_2">5.7</batteryvoltage>
```

Battery voltage per waypoint, per device, so a rebreather with two controllers records
both. Elsewhere in the same file, `<timetosurface>60.0</timetosurface>`. Individual
oxygen cells get their own values instead of one averaged number.

That revision was never released. The UDDF site lists 3.2.1 as current and serves a
certificate that expired in July 2025 for an unrelated hostname. The schema directory
stops at 3.2.2. Meanwhile commercial dive software writes 3.3.0 files and an
open-source dive log keeps one as a test fixture.

Across all three specifications, sixteen of my seventeen channels have somewhere to go.
The seventeenth is the count of times a rebreather's solenoid fired to inject oxygen,
and nothing has a field for it.

The standard's most recent useful version is a private agreement between vendors. You
find it by reading files.

## Subsurface reads more UDDF than it writes

Subsurface's internal sample structure, `core/sample.h`, holds time, stoptime, ndl, tts,
rbt, depth, stopdepth, temperature, ten cylinder pressures, setpoint, six oxygen sensor
readings plus one computer-reported ppO2, bearing, cns, heartbeat, sac, and an in-deco
flag. That is enough for most of my dive.

Its UDDF exporter is `xslt/uddf-export.xslt`, 773 lines with two waypoint-emitting
branches. Between them they write seven elements: `depth`, `divetime`, `temperature`,
`tankpressure`, `switchmix`, `alarm`, `heading`. The file contains no `xsl:element` and
no dynamic construction, so that list is complete.

Subsurface holds ndl, tts, cns, setpoint, oxygen sensors and heart rate in memory. UDDF
has elements for all of them. The exporter writes none.

Import is a different story. It runs through a second stylesheet,
`xslt/uddf.xslt`, 1050 lines, which handles `alarm`, `heading`, `cns`, `otu`,
`batteryvoltage`, `setgflow`, `setgfhigh`, `scrubber` and `divemode`. It will ingest the
per-cell `<ppo2>` values and battery voltages from a 3.3.0 file that no published schema
describes.

So one project ships a reader that understands the rich half of UDDF and a writer that
emits seven elements of it. Whatever a Subsurface user exports, the next program reads a
thinner dive than Subsurface could have described.

For my 101 metre dive: seventeen recorded, sixteen representable, four written. Depth,
time, temperature, gas.

None of this is a complaint about Subsurface, which is free, excellent, and the reason
most divers have their data at all. That XSLT is old, XSLT is a miserable language to
extend, and UDDF export matters far less to its users than supporting the next computer
over USB. Jef Driesen, who maintains libdivecomputer, is thanked in UDDF's own author
list. These people have done far more for open dive data than I have. The data is
thinner at the end of the chain anyway, and UDDF's authors saw that coming.

## UDDF has a slot for the raw bytes. Nobody fills it.

UDDF has an element called `<dcdump>`: the dive computer's raw memory, bzip2-compressed
and base64-encoded. The rationale:

> Such file can be useful as dive computer data backup; of course the backup usually
> cannot be restored to original device but UDDF software can access it later, i.e. to
> perform another, more complete conversion into UDDF format

Somebody in 2018 had watched this happen often enough to add a place for the original
bytes, so a better decoder could revisit them. It sits under `<divecomputercontrol>`,
beside the log instead of inside it. I have never seen a tool emit one.

That is the design of my own store, which keeps original bytes content-addressed and
treats the decoded database as a rebuildable view. I built it because I thought the
formats had failed me. The formats had done their part. Every program that touches them
implements the subset its author needed that week, that subset becomes the format in
practice, and you learn which subset it was years later, when you finally have a
question.

## The same thing happens outside diving

Dive logs are small enough that you can count every field and read every exporter in an
afternoon. That is the only unusual thing about this case.

RFC 5545 gives calendars six component types and three alarm actions. Google's CalDAV
API supports four of the six and two of the three, and Google's own developer
documentation is where you find that out: "Doesn't support `VTODO` or `VJOURNAL` data",
"Doesn't support the `AUDIO` action". Any format where a committee wrote a large
specification and a few libraries implemented the parts their authors needed works this
way, healthcare records and geospatial data included.

So stop grading a format by its specification. Grade it by what the tools you actually
use will read and write. That intersection is smaller than the spec, smaller than any
single tool's internal model, and you can measure it in an afternoon. Then keep the
original bytes, because the intersection shrinks to whatever two programs happened to
agree on, and it is never the part you will want.

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
