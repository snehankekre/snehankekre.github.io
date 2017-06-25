---
layout: post
title:  "Get CHIP setup with Tor"
date:   2017-06-24 12:00:00
categories: c.h.i.p headless mode cli ssh tor hidden service
image: 
        feature: chip.jpg
overlay-alpha: .1
description: Everything you need to know to get C.H.I.P started and running without an external monitor and bluetooth keyboard.
comments: true
published: True
---

I bought [CHIP](https://getchip.com/pages/chip) last summer and stowed it away for a year. Last week I felt like finally putting it to use. Without an external monitor and a bluetooth keyboard, I wanted to figure out if there was a way to remotely login. That still required first configuring it. So I naturally tried to find it in the [documentation](https://docs.getchip.com/chip.html). It contained the very basics but not enough to get CHIP configured with WiFi and other necessities. This post contains everything I did to get CHIP set up -- and more.


## Power Up and Boot
Connect to CHIP from a Mac OS X using a generic micro-USB cable. The Mac would see CHIP as a serial device and also power it. You can feel the board heating up a little and will see the `PWR` LED light turn on next to the USB micro connector.

<figure>
    <img src="{{ site.url }}/images/chip_power.jpg">
    <figcaption>CHIP powered ON</figcaption>
</figure>


## Login and explore
Open up a terminal:

{% highlight shell %}
cd /dev/
ls
{% endhighlight %}

You will see listed something like so:

{% highlight shell %}
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

{% highlight shell %}
ls /dev/tty.usb*
{% endhighlight %}

Connect to /dev/tty.usbmodem1413 using screen:

{% highlight shell %}
screen /dev/tty.usbmodem1413
{% endhighlight %}

You will now connect to CHIP and be asked to login. The default username and password are both chip.

{% highlight shell %}
chip login: chip
Password: chip
{% endhighlight %}

The first thing you want to do is change the password to something secure. You can either use a password manager to generate a password with high entropy or use EFF's [diceware method](https://www.eff.org/dice) to make a secure and memorable passphrase.

{% highlight shell %}
chip@chip:~$ passwd
Changing password for chip.
(current) UNIX password: 
Enter new UNIX password: 
Retype new UNIX password:
Password changed

chip@chip:~$ w
 02:22:12 up  2:14,  3 users,  load average: 0.03, 0.03, 0.00
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
chip     :0       :0               23:17   ?xdm?   3:08   0.17s /bin/sh /etc/xd
chip     pts/0    10.112.17.181    02:16    1:40   0.15s  0.12s nano .bash_hist
chip     pts/1    10.112.17.181    02:21    3.00s  0.10s  0.04s w

chip@chip:~$ df -h
Filesystem      Size  Used Avail Use% Mounted on
ubi0:rootfs     3.6G  860M  2.8G  24% /
devtmpfs        213M     0  213M   0% /dev
tmpfs           246M     0  246M   0% /dev/shm
tmpfs           246M  6.7M  239M   3% /run
tmpfs           5.0M  4.0K  5.0M   1% /run/lock
tmpfs           246M     0  246M   0% /sys/fs/cgroup
tmpfs            50M  4.0K   50M   1% /run/user/1000
{% endhighlight %}

## Network and Wifi

Set up CHIP's WiFi:

{% highlight shell %}
chip@chip:~$ export TERM=ansi
chip@chip:~$ sudo nmtui
[sudo] password for chip: 

                                                                                
                           ?Ĵ NetworkManager TUI ??Ŀ                          
                           ?                         ?                          
                           ? Please select an option ?                          
                           ?                         ?                          
                           ? Edit a connection       ?                          
                           ? Activate a connection   ?                          
                           ? Set system hostname     ?                          
                           ?                         ?                          
                           ? Quit                    ?                          
                           ?                         ?                          
                           ?                    <OK> ?                          
                           ?                         ?                          
                           ???????????????????????????                          
                                                        
{% endhighlight %}
Select the Edit a connection option and click <OK>

Now choose select your WiFi network and enter the password.

{% highlight shell %}
               ??????????????????????????????????????????????????Ŀ              
               ?                                                  ?             
               ? ????????????????????????????????????Ŀ           ?              
               ? ? Ethernet                          ? <Add>     ?              
               ? ?   usb0_linklocal                 ? ?           ?             
               ? ? Wi-Fi                            ? ? <Edit...> ?           
               ? ?   Minerva Schools 2.4GHz - SLOW  ? ?           ?             
               ? ?                                  ? ? <Delete>  ?             
               ? ?                                  ? ?           ?             
               ? ?                                  ? ?           ?             
               ? ?                                  ? ?           ?             
               ? ?                                  ? ?           ?             
               ? ?                                  ? ?           ?             
               ? ?                                  ? ?           ?             
               ? ?                                  ? ?           ?             
               ? ?                                  ? ?           ?             
               ? ?                                  ? ?           ?             
               ? ?                                  ? ?           ?             
               ? ?                                   ? <Quit>    ?              
               ? ??????????????????????????????????????           ?             
               ?                                                  ?             
               ????????????????????????????????????????????????????
               
    ????????????????????????????? Edit Connection ????????????????Ŀ??????????Ŀ   
   	?                                                                        ?   
   	?         Profile name Minerva Schools 2.4GHz - SLOW___________          ۳   
   	?               Device XX:XX:XX:XX:XX:XX (wlan0)_______________          ??  
   	?                                                                        ??  
   	? + WI-FI                                                       <Hide>   ?? 
   	? |               SSID Minerva Schools 2.4GHz - SLOW___________          ??  
   	? |               Mode <Client>                                          ??  
   	? |                                                                      ??  
   	? |           Security <WPA & WPA2 Personal>                             ??  
   	? |           Password ******************______________________          ??  
   	? |                    [ ] Show password                                 ??  
   	? |                                                                      ??  
   	? |              BSSID ________________________________________          ??  
   	? | Cloned MAC address ________________________________________          ??  
   	? |                MTU __________ (default)                              ??  
   	? \                                                                      ??  
   	?                                                                        ??  
   	? - IPv4 CONFIGURATION <Automatic>                              <Show>   ??  
   	? - IPv6 CONFIGURATION <Automatic>                              <Show>   ??  
   	?                                                                        ?   
   	???????????????????????????????????????????????????????????????????????????

{% endhighlight %}

To test your connection, try pinging a website:

{% highlight shell %}
chip@chip:~$ ping google.com
PING google.com (172.217.5.110) 56(84) bytes of data.
64 bytes from sfo03s07-in-f110.1e100.net (172.217.5.110): icmp_seq=1 ttl=55 time=19.8 ms
64 bytes from sfo03s07-in-f110.1e100.net (172.217.5.110): icmp_seq=2 ttl=55 time=9.96 ms
64 bytes from sfo03s07-in-f110.1e100.net (172.217.5.110): icmp_seq=3 ttl=55 time=10.5 ms
64 bytes from sfo03s07-in-f110.1e100.net (172.217.5.110): icmp_seq=4 ttl=55 time=50.6 ms
^C
--- google.com ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3003ms
rtt min/avg/max/mdev = 9.962/22.765/50.671/16.578 ms
chip@chip:~$ 
{% endhighlight %}

## Connect to CHIP over SSH

To connect to CHIP via SSH you need the local ip address:

{% highlight shell %}
chip@chip:~$ sudo ifconfig
[sudo] password for chip: 
lo        Link encap:Local Loopback  
          inet addr:127.0.0.1  Mask:255.0.0.0
          inet6 addr: ::1/128 Scope:Host
          UP LOOPBACK RUNNING  MTU:65536  Metric:1
          RX packets:8 errors:0 dropped:0 overruns:0 frame:0
          TX packets:8 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1 
          RX bytes:1104 (1.0 KiB)  TX bytes:1104 (1.0 KiB)

usb0      Link encap:Ethernet  HWaddr 4e:5b:65:5c:bd:04  
          UP BROADCAST MULTICAST  MTU:1500  Metric:1
          RX packets:0 errors:0 dropped:0 overruns:0 frame:0
          TX packets:0 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:0 (0.0 B)  TX bytes:0 (0.0 B)

wlan0     Link encap:Ethernet  HWaddr 38:a2:8c:5e:83:13  
          inet addr:10.112.16.13  Bcast:10.112.17.255  Mask:255.255.254.0
          inet6 addr: fe80::3aa2:8cff:fe5e:8313/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:13751 errors:0 dropped:493 overruns:0 frame:0
          TX packets:4885 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:4239749 (4.0 MiB)  TX bytes:903110 (881.9 KiB)
{% endhighlight %}

Use the inet addr under wlan0 to connect via SSH:

{% highlight shell %}
ssh chip@10.112.16.13
chip@10.112.16.13's password: 

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Sun Jun 25 02:21:33 2017 from XX.XXX.XX.XXXX
chip@chip:~$ 
{% endhighlight %}

## Install and run Tor on CHIP

Tor can be installed on CHIP using Tor's debian [repos](https://www.torproject.org/docs/debian.html.en). Add these two lines to /etc/apt/sources.list:
deb https://deb.torproject.org/torproject.org jessie main
deb-src https://deb.torproject.org/torproject.org jessie main

{% highlight shell %}
chip@chip:~$ nano /etc/apt/sources.list

deb http://ftp.us.debian.org/debian/ jessie main contrib non-free 
deb-src http://ftp.us.debian.org/debian/ jessie main contrib non-free

deb http://security.debian.org/ jessie/updates main contrib non-free 
deb-src http://security.debian.org/ jessie/updates main contrib non-free

deb http://http.debian.net/debian jessie-backports main contrib non-free 
deb-src http://http.debian.net/debian jessie-backports main contrib non-free

deb http://opensource.nextthing.co/chip/debian/repo jessie main

deb https://deb.torproject.org/torproject.org jessie main
deb-src https://deb.torproject.org/torproject.org jessie main
{% endhighlight %}

Then add the GPG key used to sign the packages by running the following commands:

{% highlight shell %}
chip@chip:~$ gpg --keyserver keys.gnupg.net --recv A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89
gpg: requesting key 886DDD89 from hkp server keys.gnupg.net
gpg: key 886DDD89: "deb.torproject.org archive signing key" not changed
gpg: Total number processed: 1
gpg:              unchanged: 1
chip@chip:~$ gpg --export A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89 | sudo apt-key add -
[sudo] password for chip: 
OK
{% endhighlight %}

You can install and run it with the following commands:

{% highlight shell %}
chip@chip:~$ sudo apt-get update
chip@chip:~$ sudo apt-get install tor deb.torproject.org-keyring
chip@chip:~$ tor
{% endhighlight %}

## Creating and configuring a Tor hidden service .onion address

What are Tor hidden services? From the Tor Project [website](https://www.torproject.org/docs/hidden-services.html.en): "Tor makes it possible for users to hide their locations while offering various kinds of services, such as web publishing or an instant messaging server. Using Tor "rendezvous points," other Tor users can connect to these hidden services, each without knowing the other's network identity."

First set up a simple webserver:
{% highlight shell %}
chip@chip:~$ mkdir simple-server
chip@chip:~$ cd simple-server/
chip@chip:~/simple-server$ echo "Hello, This is my Tor hidden service!" > index.html
chip@chip:~/simple-server$ python -m SimpleHTTPServer 8000
Serving HTTP on 0.0.0.0 port 8000 ...
{% endhighlight %}

Now open a new tab and add the following lines to your torrc files located at usr/local/etc/tor/torrc 

{% highlight shell %}
log info file /usr/local/etc/tor/tor.log
# hidden services
HiddenServiceDir /usr/local/etc/tor/hidden_http_service/
HiddenServicePort 80 127.0.0.1:8000
{% endhighlight %}

This will now make your simple server running on localhost:8000 available as a Tor hidden service. Restart Tor so that the changes take effect. Then read the contents of the hostname file for your .onion address:

{% highlight shell %}
chip@chip:~/simple-server$ sudo killall tor
[sudo] password for chip: 
chip@chip:~/simple-server$ tor
chip@chip:~ cat /usr/local/etc/tor/hidden_http_service/hostname
xxxxxxxxxxxxxx.onion
{% endhighlight %}

You can now test your hidden service using curl through Tor:
{% highlight shell %}
chip@chip:~ curl --socks5-hostname 127.0.0.1:9050 xxxxxxxxxxxxxx.onion
Hello, This is my Tor hidden service!
{% endhighlight %}

# Congratulations! You now have CHIP in headless mode running a Tor hidden service.
More: To get [Signal](https://whispersystems.org/) on PocketCHIP read Nathan Freitas' [blog post](https://nathan.freitas.net/2017/02/14/getting-signal-on-a-pocketchip/)

> Questions? Reach out to <snehan@minerva.kgi.edu> 