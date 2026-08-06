---
title: In macOS Seatbelt, bind and listen are two different permissions
publishDate: 2026-08-06
excerpt: "In the macOS sandbox, network-bind allows bind(), and network-inbound allows listen() and accept(). Under one condition the inbound rule also covers the bind. It took me three days to see this, because my test called both syscalls in one try block and blamed every failure on bind. The kernel had been logging the name of the refused operation the whole time."
image: '~/assets/images/og-seatbelt-loopback.png'
draft: false
---

Seatbelt is the sandbox macOS wraps around a command when you run it with
`sandbox-exec`. It has two rules that look like they cover the same thing.
`network-bind` allows `bind()`, and `network-inbound` allows `listen()` and `accept()`.
They are separate operations that fail at different syscalls. But under one condition,
the second rule quietly does the first rule's job.

I got this wrong twice in three days. First I decided that `network-bind` was ignoring
its own address filter and blocking the bind, and I [wrote that into a source
comment](https://github.com/snehankekre/quickstarted/blob/132d467191f812884b65c8cc7a2cc54e40b3f44f/src/quickstarted/exec/seatbelt.py#L65-L69).
Then I wrote a test, and the test convinced me that `network-bind` allowed nothing at all
and `network-inbound` was doing all the work.

Both conclusions were wrong. I believed the second one for as long as I did because I
had a table of results behind it. My test called `bind()` and `listen()` inside one `try`
block and printed "bind FAILED" whichever of the two the kernel refused, so every row in
that table blamed the wrong syscall. Everything below comes from re-running the tests
with the two calls separated.

## What I needed the sandbox to allow

I maintain [a harness](https://github.com/snehankekre/quickstarted) that runs the
commands from documentation quickstarts inside a sandbox, and records which
documentation pages an agent reads. Quickstarts often end with "start the dev server and
open it". So the sandbox has to let a process listen on loopback, the network interface
for connections that never leave the machine, and connect to itself there. At the same
time it has to stop the process from reaching any documentation website directly.

On macOS the harness uses
[`sandbox-exec`](https://keith.github.io/xcode-man-pages/sandbox-exec.1.html), which runs
a command under a policy you give it as a file, called a profile. Apple's manual calls
the system underneath it [the sandbox
facility](https://keith.github.io/xcode-man-pages/sandbox.7.html), and everyone else
calls it Seatbelt. The tool is marked DEPRECATED in a man page last updated in 2017, and
developers are pointed to [App
Sandbox](https://developer.apple.com/documentation/security/app-sandbox) instead. App
Sandbox is for apps you ship, and I need to wrap whatever command a quickstart tells a
reader to run. Neither man page documents the profile language, so every operation name
below comes from Apple's own profiles in `/System/Library/Sandbox/Profiles/` and from
testing.

Every task that started a server failed. The same tasks passed under the Docker backend,
so the tasks themselves were fine. The failure looked like this:

```
PermissionError: [Errno 1] Operation not permitted
```

My profile had one rule with "bind" in its name, so I widened its filter from
`localhost:*` to `*:*`. I also added inbound and outbound rules for loopback, and shipped
all three changes in [one
commit](https://github.com/snehankekre/quickstarted/commit/c58d43a3d280c93e5cf7f30a3f0f5f4cc76a4b3c).
The tasks passed. But three changes and one passing result can't tell you which change
fixed the problem. I gave the credit to the one I had an explanation for, and I wrote
that explanation into the comment above those lines in the same commit.

## The test that agreed with me

Later I went back to test it properly. I started from a base profile with no network
rules, added rules one combination at a time, and tried to bind each time. The test was
two calls in a row:

```python
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
  s.bind((addr, port))
  s.listen(1)
  print("bind ok")
except Exception as e:
  print("bind FAILED -> %r" % (e,))
```

That produced a clean table. Here are its three rows, re-run today against the same
profiles:

```
bind only        bind FAILED -> PermissionError(1, 'Operation not permitted')
bind + inbound   bind ok
inbound only     bind ok
```

Row one has a `network-bind` rule and fails. Row three has no `network-bind` rule
anywhere in the profile and passes. The conclusion seemed obvious: `network-bind` doesn't
allow a bind, and `network-inbound` does.

I had drafted this post around that conclusion, and nothing I planned to do next would
have changed my mind. Every test I could think of was one I had designed while already
believing it. So before publishing, I went through the draft with the opposite goal. I
assumed every claim in it was wrong and went looking for the reason. The main claim
lasted twenty minutes.

Look at the test again. Nothing in it can tell a refused `bind()` from a refused
`listen()`. Those three rows fit the answer I reached just as well as they fit the
answer that turned out to be true. The table would have looked the same either way, so it
proved nothing. I needed a run where the two explanations predict different output, and I
didn't have one until I split the two calls apart.

## Which rule allows which syscall

With the two calls separated, the result flips:

```
$ sandbox-exec -f bindwild.sb python3 split.py 127.0.0.1 56412
  BIND_OK  LISTEN_FAIL PermissionError(1, 'Operation not permitted')
```

`bind()` succeeded, and the kernel refused `listen()`. Every "denied" cell in my table
that had a `network-bind` rule was really a successful bind followed by a refused listen.

The rules map to syscalls the way their names suggest:

- `network-bind` allows `bind()`.
- `network-inbound` allows `listen()` and `accept()`.

![Two Seatbelt operations above the three syscalls they gate. network-bind sits above bind(); network-inbound spans listen() and accept(). A dashed arrow runs from network-inbound back to network-bind, labelled as propagating down only when the profile has no network-bind rule. A red bracket underneath spans bind() and listen(), marking the span my first probe collapsed into a single result labelled "bind FAILED".](/posts/seatbelt-loopback/rule-syscall-map.svg)

*Three syscalls, two operations, and one bracket over the pair my test couldn't tell
apart. Everything I concluded from that table came from reading a `listen()` denial as a
`bind()` denial.*

A profile with no `network-bind` rule can still bind because, in Seatbelt's hierarchy of
operations, `network-bind` sits underneath `network-inbound`. If the profile has no
`network-bind` rule of its own, a rule written for `network-inbound` applies to
`network-bind` as well. That's what produced row three of my table, the inbound-only
profile that printed `bind ok` with no bind rule anywhere in it. I read that row as proof
that `network-bind` did nothing. What really happened is that the inbound rule stood in
for a bind rule that wasn't there.

When two rules conflict, the one that names the more specific operation wins, wherever it
sits in the file. That's worth knowing because Seatbelt is usually described as
last-rule-wins:

```
(deny network-bind)(allow network-inbound)   -> BIND_FAIL
(allow network-inbound)(deny network-bind)   -> BIND_FAIL
```

The result is the same in both orders.

Apple's own profiles split the two rules the same way. From
`/System/Library/Sandbox/Profiles/com.apple.rpcbind.sb`:

```
;; Allow binding on our ticotsord transport
(allow network-bind (literal "/private/var/run/rpcb.ticotsord"))
;; Allow receiving on our ticotsord transport
(allow network-inbound (literal "/var/run/rpcb.ticotsord") (local tcp) (remote tcp))
```

That's one socket with two rules. The bind rule names the transport and nothing else. The
inbound rule covers the same socket and adds `(local tcp) (remote tcp)`, because
receiving connections needs its own permission, with its own filters. If one operation
covered both syscalls, the second rule would be pointless, and Apple wouldn't have
written it.

## The kernel had been logging the answer

In Python, both denials look the same. A refused `bind()` and a refused `listen()` both
raise `PermissionError(1, 'Operation not permitted')`, and the exception carries nothing
else that tells them apart. That's the layer I was reading, and it's the wrong one. One
level down, the kernel writes the name of the refused operation to the unified log every
time.

Here are two profiles. The first allows only `network-bind`. The second allows
`network-inbound` and denies `network-bind`:

```
$ sandbox-exec -f bindonly.sb python3 split.py 127.0.0.1 57111
BIND_OK  LISTEN_FAIL PermissionError(1, 'Operation not permitted')

$ sandbox-exec -f denybind.sb python3 split.py 127.0.0.1 57112
BIND_FAIL           PermissionError(1, 'Operation not permitted')

$ log show --last 25s --predicate 'eventMessage CONTAINS "deny(1) network"' --style compact
kernel (Sandbox) Sandbox: Python(80245) deny(1) network-inbound local:*:57111
kernel (Sandbox) Sandbox: Python(80246) deny(1) network-bind    local:*:57112
```

Python shows the same error both times, but the log names the operation it refused and
prints the filter it checked. Reading the log needs no special privileges, no changes to
the profile, and no changes to the program you're testing. If I had run it against row
one of my table, it would have printed `network-inbound` next to a test whose own output
said `bind FAILED`, and I would have had the answer that afternoon instead of three days
later.

There's one thing to know before relying on it. The kernel merges identical denial
messages, so five refused `listen()` calls on the same port from one process produce one
log line. A loop that fails every time looks like it failed once. Use a different port
each time if you want to count them.

With the two rules I ended up shipping, the same log query stays silent through a full
bind, listen, accept, and connection on loopback. It prints exactly one line when the
process tries to connect to `1.1.1.1`: `deny(1) network-outbound remote:*:80`.

## The two rules you need

Two rules are enough to run a server on loopback and connect to it:

```
(allow network-inbound (local ip "localhost:*"))
(allow network-outbound (remote ip "localhost:*"))
```

You need the outbound rule too. Without it the server starts, but nothing can connect to
it, including the process that started it:

```
step 1 bind/listen ok on 127.0.0.1:50580
step 2 accept+poll FAILED -> URLError(PermissionError(1, 'Operation not permitted'))
```

Connections to other machines stay blocked under all of these rules. I checked by
connecting to an IP address directly instead of a hostname, because a failed hostname
could just be a DNS failure and wouldn't tell you which rule refused it:

```
raw TCP 1.1.1.1:80 -> refused: PermissionError(1, 'Operation not permitted')
```

Both rules depend on the `localhost` token, which doesn't mean what it looks like.

## What `localhost` means in a filter

`(local ip "localhost:*")` doesn't match one specific address. The host part of the
filter accepts only two values, and the compiler rejects anything else:

```
$ sandbox-exec -f bogus.sb python3 split.py 127.0.0.1 57999
sandbox-exec: host must be * or localhost in network address
```

Here, `localhost` means any address that belongs to this machine, which is wider than
`127.0.0.0/8`. Under an inbound rule that names `localhost`, a process can bind `0.0.0.0`
and the machine's LAN address, because this machine owns those addresses. So the filter
works as designed, but for inbound it doesn't restrict anything, because every address
you can bind belongs to this machine.

The same token does restrict outbound connections, where you can see the difference:

```
-> 192.168.50.1:80    EPERM          (the router, a different host)
-> 192.168.50.205:9   ECONNREFUSED   (this host's LAN address, permitted)
-> 1.1.1.1:80         EPERM
```

The port part filters in both directions. Under `(allow network-inbound (local ip
"localhost:12345"))`, binding port 12345 works and binding port 12346 returns EPERM.

## A demo I should not have trusted either

Once I found that a sandboxed process can bind `0.0.0.0`, I curled its LAN address from
outside the sandbox and got a response. I was ready to write that a sandboxed command can
publish a service to everyone on your network.

```
$ route get 192.168.50.205
   route to: mac
  interface: lo0
```

Traffic to my own LAN address never leaves the machine. My curl went over loopback, and
so did every other client I could run locally. A wildcard listener with the application
firewall turned off is a good reason to expect the service is reachable from the LAN, and
`netstat` shows `tcp4 *.40030 LISTEN`. But I haven't shown it. That needs a second
machine, and I haven't run that test.

## If you are copying these rules

The `(allow network-bind (local ip "*:*"))` line looks like it does nothing, but it's the
rule that allows the bind. You can only delete it safely if the profile has no other bind
rule. In that case the inbound rule applies to the bind instead, and it brings its own
filter with it, including its port restriction. In a profile with an explicit
`(deny network-bind)` or a narrower inbound filter, removing that line breaks the server.

[The comment I wrote above those
lines](https://github.com/snehankekre/quickstarted/blob/132d467191f812884b65c8cc7a2cc54e40b3f44f/src/quickstarted/exec/seatbelt.py#L65-L69)
claims three things: that `network-bind` doesn't match a `localhost:*` filter, that it
quietly refuses the bind, and that all three rules are needed. So I rebuilt the profile
as it was before that commit, and added the three changes back one at a time. This time
the test binds, listens, accepts a connection, and connects to itself:

```
bind localhost:*                        BIND_OK  LISTEN_FAIL
bind localhost:* + inbound              BIND_OK  LISTEN_OK   POLL_FAIL
bind localhost:* + inbound + outbound   BIND_OK  LISTEN_OK   POLL_OK
bind *:*         + inbound + outbound   BIND_OK  LISTEN_OK   POLL_OK
```

The filter I called broken allowed the bind in every row, including the first, where no
other rule in the profile could have allowed it. The inbound rule and the outbound rule
each fixed a real failure. The last two rows are identical, so widening `localhost:*` to
`*:*` did nothing, and the comment explaining why I widened it was explaining a change
that had no effect. Four runs would have told me this before I wrote a word of that
comment. The comment comes out.

## Two things that cost me time

Use a new port on every run. A port still in `TIME_WAIT` from a previous successful run
reports `Address already in use`, and when you already suspect your profile, that looks a
lot like a denial.

When you're working out which syscall the kernel refused, don't put two syscalls in the
same `try` block. I had a table with real numbers in it, and it was measuring something
different from what its column header said. That cost me three days and a wrong source
comment. Both of my wrong answers passed every test I thought to run, because I designed
those tests while believing the thing they were meant to check. Neither one lasted twenty
minutes once I tried to break it on purpose.

All results are from macOS 15.7.3, build 24G419, Darwin 24.6.0. None of this is
documented or promised, so pin your own results to a version and re-check after
upgrades.
