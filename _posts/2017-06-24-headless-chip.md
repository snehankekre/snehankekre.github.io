---
layout: post
title:  "Get C.H.I.P up and running through a CLI"
date:   2017-06-24 12:00:00
categories: c.h.i.p headless mode cli ssh
image: 
        feature: chip.jpg
overlay-alpha: .1
description: Everything you need to know to get C.H.I.P started and running without an external monitor and bluetooth keyboard.
comments: true
published: True
---

I bought [C.H.I.P](https://getchip.com/pages/chip) last summer and stowed it away for a year. Last week I felt like finally putting it to use. Without an external monitor and a bluetooth keyboard, I wanted to figure out if there was a way to remotely login. That still required first configuring it. So I naturally tried to find it in the [documentation](https://docs.getchip.com/chip.html). It contained the very basics but not enough to get CHIP configured with WiFi and other necessities. This post contains everything I did to get CHIP set up -- and more.


## Power Up and Boot
Connect to CHIP from a Mac OS X using a generic micro-USB cable. The Mac would see CHIP as a serial device and also power it. You can feel the board heating up a little and will see the `PWR` LED light turn on next to the USB micro connector.

<figure>
    <img src="{{ site.url }}/images/chip_power.jpg">
    <figcaption>CHIP powered ON</figcaption>
</figure>


## Login and explore
Open up a terminal:
{% highlight python %}
cd /dev/
ls
{% endhighlight %}

You will see listed something like so:
{% highlight python %}
disk2				stderr
disk2s1				stdin
disk2s2				stdout
disk3				systrace
disk3s1				tty
disk3s2				tty.Bluetooth-Incoming-Port
disk4				tty.usbmodem1413 
disk4s1				tty.TomJBL-SPPDev
disk5				tty.UEROLL-LWACP
disk5s1				ttyp0
{% endhighlight %}

To figure out which one of them is CHIP, find USB connected devices:

{% highlight python %}
ls /dev/tty.usb*
{% endhighlight %}

Connect to /dev/tty.usbmodem1413 using screen:

{% highlight python %}
screen /dev/tty.usbmodem1413
{% endhighlight %}

You will now connect to CHIP and be asked to login. The default username and password are both chip.

{% highlight python %}
chip login: chip
Password: chip
{% endhighlight %}



> Questions? Reach out to <snehan@minerva.kgi.edu> 