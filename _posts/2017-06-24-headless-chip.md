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
Select the `Edit a connection` option and click `<OK>`

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





> Questions? Reach out to <snehan@minerva.kgi.edu> 