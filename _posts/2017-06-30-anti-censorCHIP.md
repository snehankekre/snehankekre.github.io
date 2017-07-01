---
layout: post
title:  "Introducing Anti-CensorCHIP"
date:   2017-06-30 12:00:00
categories: chip ooni anti-censorchip censorship surveillance tor onion hidden service ooniprobe
image: 
        feature: OONI.png
description: Configure OONI on C.H.I.P to test your network for signs of censorship and surveillance.
comments: False
overlay-alpha: .1
published: True
---

The [Open Observatory of Network Interference (OONI)](https://ooni.torproject.org) is a free software project under the [Tor Project](https://torproject.org) which aims to detect internet censorship and signs of network tampering. OONI shares observations and data about the nature, methods, and prevalence of censorship and network tampering around the world, through the use of open methodologies and FLOSS tools.

ooniprobe is a program that users can run to probe their network and to collect data for the OONI project. Are you interested in testing your network for censorship and traffic manipulation? Do you want to collect data to share with others, so that you and others can better understand your network? If so, please read this document to learn how to install and run ooniprobe.

OONI's testing methodology measures:

{% highlight shell %}
- Blocking of websites
- Blocking of instant messaging apps
- Blocking of censorship circumvention tools (Tor, VPN, Psiphon, Lantern)
- Detection of middle boxes proxy technologies that could be responsible for censorship and/or surveillance
- Speed and network performance tests (NDT)
{% endhighlight %}

## Explore OONI Data and Reports

OONI has been monitoring internet censorship around the world since 2012. Explore OONI [data](https://explorer.ooni.torproject.org/) and browse countries to find the one you want to investigate measurements for.

<figure>
    <img src="{{ site.url }}/images/ooni-explorer-map.png">
</figure>


Read OONI reports of censorship in [Egypt](https://ooni.torproject.org/post/egypt-censors/), [Indonesia](https://ooni.torproject.org/post/indonesia-internet-censorship/), [Thailand](https://ooni.torproject.org/post/thailand-internet-censorship/), [Malaysia](https://ooni.torproject.org/post/malaysia-report/), [Kenya](https://ooni.torproject.org/post/kenya-study/), [Gambia](https://ooni.torproject.org/post/gambia-internet-shutdown/), [Turkey](https://ooni.torproject.org/post/turkey-internet-access-disruption/), [Ethiopia](https://ooni.torproject.org/post/ethiopia-internet-shutdown-amidst-recent-protests/), [Brazil](https://ooni.torproject.org/post/brazil-whatsapp-block/), [Greece](https://ooni.torproject.org/post/eeep-greek-censorship/), and [Palestine](https://ooni.torproject.org/post/hadara-palestine/). 


## Supported platforms

OONI can currently be installed on OS X, Linux, Raspberry Pi, IOS, and Android.

<figure>
    <img src="{{ site.url }}/images/install-ooni.png">
    <figcaption>Install OONI</figcaption>
</figure>

## Why install ooniprobe on CHIP?

Lepidopter, a distribution of ooniprobe for Raspberry Pi platforms, was developed to deploy plug-and-play, cheap devices that keep tabs on censorship. 

The rest of this blog is devoted to configuring ooniprobe on [C.H.I.P](https://getchip.com/pages/chip), the world's first $9 computer. 

CHIP contains a 1GHz R8 processor, 4GB of high speed storage, 512Mb of RAM, built-in WiFi B/G/N, and a flavor of Debian available under the name CHIP Operating System. As such, it is cheap and sufficiently powerful and robust enough to run ooniprobe. 

I will not attempt to automate network measurement collection as Lepidopter does, but will provide a guide to configure ooniprobe on CHIP (anti-censorCHIP). 

In a later blog I hope to describe a plug-and-play of version ooniprobe so as to enable users to contribute to the collection of network measurements consistently across time, without having to manually run ooniprobe from CHIP, regardless of their technical skills.

Before you start installing and running ooniprobe, I urge you to read the [**risks**](https://ooni.torproject.org/about/risks/) involved. Read it once more.

## Installing Tor on CHIP

To get configure WiFi, install Tor on CHIP, and connect over SSH, read my previous blog [post](https://snehankekre.github.io/headless-chip).

## Installing ooniprobe on CHIP

**Step 1:** Log into CHIP either over a USB serial connection or SSH

{% highlight shell %}
screen /dev/tty.usbmodemXXXX
chip login: chip
Password: chip
{% endhighlight %}


**Step 2** Configure the torproject repository by typing the following:

{% highlight shell %}
gpg --keyserver keys.gnupg.net --recv A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89
gpg --export A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89 | sudo apt-key add -
echo 'deb http://deb.torproject.org/torproject.org jessie main' | sudo tee /etc/apt/sources.list.d/ooniprobe.list
sudo apt-get update
{% endhighlight %}


**Step 3** Type the following to install ooniprobe:

{% highlight shell %}
sudo apt-get install ooniprobe deb.torproject.org-keyring
{% endhighlight %}

**Step 4:** Type the following to install dependencies:

{% highlight shell %}
sudo apt-get install -y build-essential libdumbnet-dev libpcap-dev libgeoip-dev libffi-dev python-dev python-pip tor libssl-dev obfs4proxy tcpdump
sudo wget https://raw.githubusercontent.com/TheTorProject/ooni-probe/master/scripts/
sudo pip install pyopenssl --upgrade
sudo pip install pyasn1 --upgrade
sudo pip install txsocksx --upgrade
{% endhighlight %}

**Step 5:** Using ooniprobe:

**Net test** is a set of measurements to assess what kind of internet censorship is occurring.

**Decks** are collections of ooniprobe nettests with some associated inputs.

{% highlight shell %}
mkdir my_decks
oonideckgen -o my_decks/
ooniprobe -i /home/chip/web-full.yaml
{% endhighlight %}

![alt text](https://raw.githubusercontent.com/snehankekre/snehankekre.github.io/master/images/running-ooniprobe.gif "Running ooniprobe")

If you have SSH configured over a Tor Hidden Service, you are now ready to deploy Anti-censorCHIP to overtly or covertly to monitor your network for signs of censorship and tampering.

## Get Involved With OONI

**Community**:

Join OONI in IRC [#ooni on OFTC](ircs://irc.oftc.net:6697/#ooni) or on the [ooni-talk](https://lists.torproject.org/cgi-bin/mailman/listinfo/ooni-talk) and [ooni-dev](https://lists.torproject.org/cgi-bin/mailman/listinfo/ooni-dev) mailing lists to discuss the project, what you've learned from measurements and ways you can help out.

If you are contributing regular ooniprobe measurements be sure to also subscribe to [ooni-operators](https://lists.torproject.org/cgi-bin/mailman/listinfo/ooni-operators) for important updates.

**Partnerships**:

Interested in exploring internet censorship? Learn about OONI's [partnership program](https://ooni.torproject.org/get-involved/partnership-program/).

**Submit URLs for testing**:

Help OONI detect censorship by submitting URLs for testing! Learn more [here](https://ooni.torproject.org/get-involved/contribute-test-lists).

**Code and developer documentation**:

OONI source code is available on [github](https://github.com/TheTorProject/ooni-probe) and mirrored on [Tor Project git](https://gitweb.torproject.org/ooni-probe.git). If you have code you would like to contribute you should open a [pull request](https://github.com/TheTorProject/ooni-probe/compare) or [file an issue](https://github.com/TheTorProject/ooni-probe/issues/new).

If you are interested in hacking on OONI or writing your own nettests you should look at the [developer documentation](https://ooni.torproject.org/docs/).

> Questions? Reach out to <snehan@minerva.kgi.edu>


