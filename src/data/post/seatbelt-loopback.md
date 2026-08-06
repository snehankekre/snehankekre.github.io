---
title: In macOS Seatbelt, bind and listen are two different permissions
publishDate: 2026-08-06
excerpt: "network-bind authorizes bind(). network-inbound authorizes listen() and accept(). One propagates to the other under a condition that took me three days to see, because my probe called both syscalls inside one try block and labelled every failure with the name of the wrong one."
image: '~/assets/images/og-seatbelt-loopback.png'
draft: false
---

Seatbelt is the sandbox macOS puts a command inside when you run it under
`sandbox-exec`. It has two rules that look like they cover the same ground.
`network-bind` authorizes `bind()`. `network-inbound` authorizes `listen()` and
`accept()`. They are
separate operations that fail at different syscalls, and under one condition the second
silently stands in for the first.

I got this wrong twice in three days. First I decided `network-bind` was ignoring its
own address filter and refusing the bind, and I [wrote that into a source
comment](https://github.com/snehankekre/quickstarted/blob/132d467191f812884b65c8cc7a2cc54e40b3f44f/src/quickstarted/exec/seatbelt.py#L65-L69).
Then I wrote a test, and the test convinced me `network-bind` authorized nothing at all
and `network-inbound` was doing the work.

Both readings were wrong, and the second one had a table behind it, which is why I
believed it for as long as I did. My probe called `bind()` and `listen()` inside one
`try` block and printed "bind FAILED" whichever of them the kernel refused, so every
row in that table named the wrong syscall. Everything below is the re-test with the two
calls separated.

## What I needed the sandbox to allow

I maintain [a harness](https://github.com/snehankekre/quickstarted) that runs documented
quickstart commands inside a sandbox and records which documentation pages an agent
reads. Quickstarts frequently end at "start the dev server and open it", so the sandbox
has to let a process listen on loopback and poll itself, while still refusing to reach
any documentation host directly.

On macOS the enforced backend is
[`sandbox-exec`](https://keith.github.io/xcode-man-pages/sandbox-exec.1.html), which
runs a command inside a policy you hand it as a file. Apple's manual calls the machinery
underneath it [the sandbox
facility](https://keith.github.io/xcode-man-pages/sandbox.7.html), and Seatbelt is the
name it goes by everywhere else. The tool is marked DEPRECATED, in a man page last
revised in 2017, and developers are pointed at [App
Sandbox](https://developer.apple.com/documentation/security/app-sandbox) instead. App
Sandbox covers apps you ship. I need to wrap whatever command a quickstart tells a
reader to run. Neither man page documents the profile language, so every operation name
below comes from Apple's own profiles under `/System/Library/Sandbox/Profiles/` and from
testing.

Every task that started a server failed. The same tasks passed under the Docker backend,
so the tasks themselves were fine. The failure looked like this:

```
PermissionError: [Errno 1] Operation not permitted
```

My profile had one rule with "bind" in the name, so I widened its filter from
`localhost:*` to `*:*`, added inbound and outbound rules for loopback, and shipped all
three edits in [one
commit](https://github.com/snehankekre/quickstarted/commit/c58d43a3d280c93e5cf7f30a3f0f5f4cc76a4b3c).
The tasks passed. That left me three changes and a single pass result, which cannot
tell you which of the three did the work. I credited the one I had an explanation for,
and the explanation went into the comment above those lines in the same commit.

## The test that agreed with me

Later I went back to do it properly. One base profile with no network rules, then
append rules one combination at a time and try to bind. The probe was two calls in a
row:

```python
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
  s.bind((addr, port))
  s.listen(1)
  print("bind ok")
except Exception as e:
  print("bind FAILED -> %r" % (e,))
```

That produced a clean table. Profiles carrying only a `network-bind` rule printed
`bind FAILED`. Profiles carrying `network-inbound` printed `bind ok`. A profile with no
`network-bind` rule at all still printed `bind ok`. The conclusion wrote itself:
`network-bind` does not authorize a bind, `network-inbound` does.

Read the probe again. Nothing in it can tell a refused `bind()` from a refused
`listen()`.

## Which rule authorizes which syscall

Separate the two calls and the picture inverts:

```
$ sandbox-exec -f bindwild.sb python3 split.py 127.0.0.1 56412
  BIND_OK  LISTEN_FAIL PermissionError(1, 'Operation not permitted')
```

`bind()` succeeded. `listen()` is what the kernel refused. Every "denied" cell in my
table that had a `network-bind` rule in it was a successful bind followed by a denied
listen.

The rules map to syscalls the way their names suggest:

- `network-bind` authorizes `bind()`.
- `network-inbound` authorizes `listen()` and `accept()`.

![Two Seatbelt operations above the three syscalls they gate. network-bind sits above bind(); network-inbound spans listen() and accept(). A dashed arrow runs from network-inbound back to network-bind, labelled as propagating down only when the profile has no network-bind rule. A red bracket underneath spans bind() and listen(), marking the span my first probe collapsed into a single result labelled "bind FAILED".](/posts/seatbelt-loopback/rule-syscall-map.svg)

*Three syscalls, two operations, and one bracket covering the pair my probe could not
tell apart. Everything I concluded from that table came from reading a `listen()` denial
as a `bind()` denial.*

The reason a profile with no `network-bind` rule can still bind is that `network-bind`
sits underneath `network-inbound` in Seatbelt's operation hierarchy. A rule written on
`network-inbound` propagates down to `network-bind` when the profile has no
`network-bind` rule of its own. That inheritance produced the row I found most
convincing, the one where a profile with no bind rule anywhere in it still printed
`bind ok`. I read that as proof that `network-bind` was doing nothing. It was the
inbound rule standing in for a bind rule that was not there.

Precedence is by specificity rather than by position, which is worth knowing separately
because Seatbelt is usually described as last-rule-wins:

```
(deny network-bind)(allow network-inbound)   -> BIND_FAIL
(allow network-inbound)(deny network-bind)   -> BIND_FAIL
```

Same outcome either way. The rule naming the more specific operation wins no matter
where it sits.

Apple's own profiles use the split exactly this way. From
`/System/Library/Sandbox/Profiles/com.apple.rpcbind.sb`:

```
;; Allow binding on our ticotsord transport
(allow network-bind (literal "/private/var/run/rpcb.ticotsord"))
;; Allow receiving on our ticotsord transport
(allow network-inbound (literal "/var/run/rpcb.ticotsord") (local tcp) (remote tcp))
```

One socket, two rules. The bind rule names the transport and nothing else. The inbound
rule covers that same socket and adds `(local tcp) (remote tcp)`, because receiving is a
separate authorization that takes its own filters. If one operation covered both
syscalls, the second rule would be redundant, and Apple would not have written it.

## The two rules you need

Two rules are enough to serve and poll on loopback:

```
(allow network-inbound (local ip "localhost:*"))
(allow network-outbound (remote ip "localhost:*"))
```

The outbound rule is separately required. Without it the server comes up and nothing can
talk to it, including the process that started it:

```
step 1 bind/listen ok on 127.0.0.1:50580
step 2 accept+poll FAILED -> URLError(PermissionError(1, 'Operation not permitted'))
```

Remote egress stays denied under all of these, which I checked with a raw dial to a
literal IP rather than a hostname, since a hostname failure could be DNS and tells you
nothing about which rule refused:

```
raw TCP 1.1.1.1:80 -> refused: PermissionError(1, 'Operation not permitted')
```

Both rules lean on the `localhost` token, which does not mean what it looks like.

## The filter is stranger than it looks

`(local ip "localhost:*")` is not an address match. The host component accepts two
tokens and the compiler rejects everything else:

```
$ sandbox-exec -f bogus.sb python3 split.py 127.0.0.1 57999
sandbox-exec: host must be * or localhost in network address
```

`localhost` here means "an address belonging to this machine" rather than
`127.0.0.0/8`. Under an inbound rule naming `localhost`, a process can bind `0.0.0.0`
and the machine's LAN address, because those are addresses this host owns. The filter is
doing its job. For inbound it is simply vacuous, since every address you can bind
belongs to this host.

The same token genuinely constrains outbound, where the distinction is observable:

```
-> 192.168.50.1:80    EPERM          (the router, a different host)
-> 192.168.50.205:9   ECONNREFUSED   (this host's LAN address, permitted)
-> 1.1.1.1:80         EPERM
```

The port component does filter on both. Under `(allow network-inbound (local ip
"localhost:12345"))`, binding 12345 works and binding 12346 returns EPERM.

## A demo I should not have trusted either

Having found that a sandboxed process can bind `0.0.0.0`, I curled its LAN address from
outside the sandbox, got a response, and was ready to write that a sandboxed command can
publish a service to everyone on your network.

```
$ route get 192.168.50.205
   route to: mac
  interface: lo0
```

Traffic to my own LAN address never leaves the machine. My curl went over loopback, and
so did every other client I could produce locally. A wildcard listener with the
application firewall off is a real reason to expect LAN exposure, and `netstat` shows
`tcp4 *.40030 LISTEN`. I haven't demonstrated it. Settling it needs a second machine,
which is a test I have not run.

## If you are copying these rules

The `(allow network-bind (local ip "*:*"))` line that looks inert is the rule
authorizing the bind. Deleting it is safe only when the profile has no other bind rule,
because inbound then propagates down and brings its own filter with it, including the
port constraint. In a profile carrying an explicit `(deny network-bind)` or a narrower
inbound filter, removing that line breaks the server.

[The comment I wrote above those
lines](https://github.com/snehankekre/quickstarted/blob/132d467191f812884b65c8cc7a2cc54e40b3f44f/src/quickstarted/exec/seatbelt.py#L65-L69)
claims three things: that `network-bind` does not match a `localhost:*` filter, that it
silently refuses the bind, and that all three rules are needed. The filter matched the
bind without complaint. The call with no rule behind it was `listen()`, which means the
edit that fixed my tasks was the inbound rule, and widening the bind filter from
`localhost:*` to `*:*` bought me nothing. The comment comes out.

## Two things that cost me time

Use a fresh port on every run. A port in `TIME_WAIT` from a previous successful run
reports `Address already in use`, and when you already suspect your policy that reads
exactly like a denial.

Do not let two syscalls share a `try` block when you are working out which one the
kernel refused. I had a table, the table had real numbers in it, and it was measuring
something other than what its column header said. Three days and a source comment came
out of that.

All results are macOS 15.7.3, build 24G419, Darwin 24.6.0. None of this is documented or
promised, so pin your own results to a version and re-check after upgrades.
