---
title: Three ways to get my Perdix 2 into Subsurface. Two of them are broken.
publishDate: 2026-10-24
excerpt: "Subsurface can read a Shearwater Perdix 2 three ways. Opening a current Shearwater Cloud database imports zero dives, importing Cloud's XML export dates every dive 1 January 1970 and makes a 101 minute dive last 1,694 hours, and a Bluetooth download fails on Subsurface builds from before late June 2025. Here's why each one breaks, and the one that works."
image: '~/assets/images/og-perdix-2-into-subsurface.png'
draft: false
---

A reader emailed to ask for a few of my Perdix 2 dives alongside their Subsurface versions.
I had written [a whole post](/posts/lossy-dive-formats) about what Subsurface's UDDF exporter
writes, and I had never put my dives through Subsurface. So I tried, on a Mac with
Subsurface already installed and Shearwater Cloud 2.12.10 holding 146 of my dives.

Subsurface has three ways in for a Shearwater computer: open Shearwater Cloud's database,
import Shearwater Cloud's XML export, or download straight from the computer over Bluetooth.
The first two are broken, for reasons that have nothing to do with each other. The third
works, once you have a build from after June 2025.

## Opening the Shearwater Cloud database imports nothing

Shearwater Cloud keeps everything in a SQLite file called `dive_data.db`, and Subsurface
can open it as a log file. I opened a copy of mine in Subsurface 6.0.5404 and again in
6.0.5771, a nightly from 23 October 2026. Both opened the file, reported no error, and showed
an empty dive list. The window title said `(0 dives)`.

Subsurface reads that database with SQL. It gets the list of dives by joining
`dive_details` to `dive_logs` ([line 501](https://github.com/subsurface/subsurface/blob/5e7b0241f6f17283a487c0d721da7dc15df4afbc/core/import-shearwater.cpp#L501)),
and the samples from `dive_log_records` ([line 346](https://github.com/subsurface/subsurface/blob/5e7b0241f6f17283a487c0d721da7dc15df4afbc/core/import-shearwater.cpp#L346)).
Here is what my database holds:

| table | rows |
| --- | --- |
| `dive_details` | 146 |
| `log_data` | 146 |
| `dive_logs` | 0 |
| `dive_log_records` | 0 |

The two tables Subsurface needs are empty. Cloud keeps each dive whole in `log_data`, as a
compressed blob of the records the computer wrote, and decodes it when it needs to show you
something. With no rows to join, Subsurface's query returns no dives, and it says nothing
because nothing went wrong from its point of view.

This is known. A user reported it [in September 2023](https://github.com/subsurface/subsurface/issues/3958)
with Shearwater Cloud 2.10, and a maintainer reproduced it with their logs: "the import
'succeeds' without an error message, but no dives are imported." An
[April 2026 issue](https://github.com/subsurface/subsurface/issues/4788) found the same empty
tables and proposed reading the blobs in `log_data` instead, which is the format I decode with
[pnf](https://github.com/snehankekre/pnf). It's still open.

## Importing Cloud's XML export dates every dive 1 January 1970

Shearwater Cloud can export a dive as XML, and Subsurface imports that with a stylesheet,
`xslt/shearwater.xslt`. I imported four exports. Subsurface loaded all four, at the right
depths, and listed every one as starting on 1 January 1970. The 101 minute dive was listed
as 1694:27 long. That column is hours and minutes.

Three separate things go wrong, and Cloud's code shows all three. The macOS app is built
with Unity, and its exporter is a .NET class, `ShearwaterXMLExporter`, which decompiles
cleanly. The relevant lines are these:

```csharp
startDate = divelog.DiveLogDetails.DiveDate.ToString(),
maxTime = diveLogFooter.DiveTimeInSeconds,
currentTime = (int)UnitConverter.SecondsToMs(diveLogSample.TimeSinceStartInSeconds),
```

**The date.** `DateTime.ToString()` with no format string uses whatever date format the
computer's region setting asks for. My Mac's region is India, so my exports say
`27-09-2025 11:55:43`. Subsurface's date template
([`convertDate`](https://github.com/subsurface/subsurface/blob/5e7b0241f6f17283a487c0d721da7dc15df4afbc/xslt/commonTemplates.xsl#L248))
expects an English month name, `Jan` to `Dec`, as the second word. Given my format, it
produces `date="--"`, and Subsurface shows that as the start of 1970. Someone with a
different region setting would get a different string from the same code, so no single
parser can read these dates reliably.

**The sample times.** Cloud writes each sample's time in milliseconds. In 2020, after
noticing that Cloud's exports had moved to milliseconds, Subsurface added
[a check](https://github.com/subsurface/subsurface/commit/dbf7fa89a27d9a6a721eceb056209d9ec7b22dec)
whose commit message is honest about it: "Taking a wild guess, that this logic should suffice
for us to be able to import old and newer XML logs. (Assuming that if the timestamp for the
first sample is more than 100, timestamps are in milliseconds, otherwise in seconds.)" In all
142 of my exports, the first sample's time is 0. So the check decides the file is in seconds,
the sample at 10,000 ms becomes 10,000 seconds, and every time in the dive is 1,000 times too
large. That's how a 101 minute dive becomes 1,694 hours. The stylesheet also
[labels `maxTime` as minutes](https://github.com/subsurface/subsurface/blob/5e7b0241f6f17283a487c0d721da7dc15df4afbc/xslt/shearwater.xslt#L60),
so the dive's header duration reads `6087 min`, when Cloud wrote it in seconds.

**The encoding.** Every export starts with `<?xml version="1.0" encoding="utf-16"?>`, and
every byte after it is UTF-8. The exporter serialises into a .NET `StringWriter`, which
always reports UTF-16, and then saves the string with `File.WriteAllText`, which writes UTF-8.
On macOS, libxml prints "Document labelled UTF-16 but has UTF-8 content" and carries on.
[A Fedora user's import failed outright](https://github.com/subsurface/subsurface/issues/4671)
because of it.

A maintainer closed that Fedora issue on 17 October 2026 as a Shearwater bug, and mentioned
the date problem too: "Shearwater appears to have changed date/time encoding in their exporter
without bumping the format version, which causes wrong dates/durations even after the encoding
is fixed". The export does still say `version="3"`. The date and encoding defects are
Shearwater's to fix. The first-sample check and the `maxTime` label are Subsurface bugs. The
sample times would come out right on these files if the check looked at the second sample
instead of the first.

## Bluetooth works, after June 2025

Subsurface's third route is the one most divers use. It downloads straight from the computer
over Bluetooth, through libdivecomputer, which decodes the computer's records itself and
never touches Shearwater Cloud.

On 6.0.5404, it failed. The Perdix showed up in the scan, and my download attempts ended
with "Unable to open" and a red banner saying "Timeout while trying to connect". I turned on
the libdivecomputer log, and on one attempt it showed the connection had worked. Subsurface
asked the Perdix for its serial number and got `A823C228`. Then it asked for the firmware
version:

```
Read: size=22, data=010001FF10006280115631303220436C6173736963C0
ERROR: Unexpected packet size (12 bytes).
ERROR: Failed to read the firmware version.
```

The bytes `5631303220436C6173736963` spell `V102 Classic`. That's 12 characters, and this
build only had room for 11. Shearwater's firmware went from version 99 to version 100 in
2025, the string grew by a digit, and every Perdix 2 that updated stopped downloading into
Subsurface.

[A Perdix 2 owner reported it](https://github.com/subsurface/subsurface/issues/4537) on
15 June 2025. Jef Driesen, who maintains libdivecomputer,
[explained it](https://github.com/subsurface/subsurface/issues/4537#issuecomment-2987476495):
"The firmware version is reported as the string "V100 Classic". Because the version jumped
to V100, this string became one digit longer than previous versions." His
[fix](https://github.com/libdivecomputer/libdivecomputer/commit/50fe02f96f40c431698cc89e5451cf87545ec69f)
accepts a variable length, and a fixed Subsurface build was out on 20 June. My 6.0.5404 was
built on 10 June, ten days too early. The reporter also found that after the failed firmware
read, the Perdix was left in a "Wait Cmnd" state where every further attempt timed out until
they restarted its Bluetooth mode, which would explain the banner I kept seeing.

On [6.0.5771](https://github.com/subsurface/nightly-builds/releases/tag/v6.0.5771-CICD-release),
the download went through first time and brought in every dive on the Perdix, 127 logs. My
Garmin Descent Mk3i went in from a folder of its FIT files, because the macOS build has no
MTP support for reading the watch over USB. Subsurface merged 70 dives that both computers
logged into single dives with two computers, which you can switch between on the dive's
page.

## What arrives

The Bluetooth download keeps depth, temperature, NDL, time to surface, the next stop, CNS,
the in-deco flag, and on rebreather dives the setpoint. It drops GF99, the computer's
deco ceiling, @+5, battery level, average ppO2, and the tissue loadings the Perdix
[writes into its log every four minutes](/posts/shearwater-tissue-snapshots), because
libdivecomputer doesn't decode them. Subsurface calculates a ceiling and GF from the depth
profile instead.

If you have a Perdix 2 on current firmware and want your dives in Subsurface, download them
over Bluetooth with a build from after 20 June 2025. Shearwater Cloud's database and its XML
export won't get you there today. The complete record of every dive is in Cloud's `log_data`
blobs, and the open issue about reading them could use someone who has already decoded them.

## Sources

Subsurface, at commit [`5e7b024`](https://github.com/subsurface/subsurface/tree/5e7b0241f6f17283a487c0d721da7dc15df4afbc):

- [`core/import-shearwater.cpp`](https://github.com/subsurface/subsurface/blob/5e7b0241f6f17283a487c0d721da7dc15df4afbc/core/import-shearwater.cpp),
  the Shearwater Cloud database importer
- [`xslt/shearwater.xslt`](https://github.com/subsurface/subsurface/blob/5e7b0241f6f17283a487c0d721da7dc15df4afbc/xslt/shearwater.xslt#L63-L72),
  the XML importer and its milliseconds check
- [`xslt/commonTemplates.xsl`](https://github.com/subsurface/subsurface/blob/5e7b0241f6f17283a487c0d721da7dc15df4afbc/xslt/commonTemplates.xsl#L248-L285),
  the date template

Issues: [#3958](https://github.com/subsurface/subsurface/issues/3958) and
[#4788](https://github.com/subsurface/subsurface/issues/4788) (empty database tables),
[#4671](https://github.com/subsurface/subsurface/issues/4671) (XML encoding and dates),
[#4537](https://github.com/subsurface/subsurface/issues/4537) (firmware V100 over Bluetooth).

Shearwater Cloud 2.12.10 for macOS, `ShearwaterXMLExporter` in `Assembly-CSharp.dll`,
decompiled with ILSpy. Everything else comes from my Cloud database and the
libdivecomputer log of my Bluetooth download, on 24 October 2026.
