# Arduino Yun - Sound Detector

Building an internet connected Sound Detector on an Arduino Yun using Node.js


## Hardware installation
Connect your sound system to an analogue pin. If you're using the Arduino microphone connect the VCC-pin to the 3.3V pin (not the 5V, that one's comming from the USB power).

## Software Installation

### Install SFTP server on Arduino Yun

    opkg update
    opkg install openssh-sftp-server

(http://dev.mikamai.com/post/62145565365/how-to-install-an-sftp-server-on-arduino-yun)

### Expand Disk Space to microSD

[http://arduino.cc/en/Tutorial/ExpandingYunDiskSpace](http://arduino.cc/en/Tutorial/ExpandingYunDiskSpace)


### Install Node.js on the Arduino Yun

    opkg update
    opkg install node

### Install node-serialport

Don't install serialport using [npm](https://www.npmjs.org/package/serialport) but use the precompiled version for the Yun:

    opkg update
    opkg install node-serialport

### Install node-socket.io

Don't install socket.io using [npm](https://www.npmjs.org/package/socket.io) but use the precompiled version for the Yun:

    opkg update
    opkg install node-socket.io

### Install other Node.js modules

Try to install other Node.js modules on your computer and then copy them to the Yun. Installing modules on can take up some time.

### Install the node code

Copy the code to ```/www/sd/node-sounddetector/app```

### Disable the console on /dev/ttyATH0

Linux uses the ```/dev/ttyATH0``` serial port as its main console (it displays booting data when you boot the Linux CPU). You have to disable it in order to use this as a communication channel between the Arduino chip and the Linux CPU.

Open ```/etc/inittab``` and comment out the following line:

    ttyATH0::askfirst:/bin/ash --login

Change it to:

    # ttyATH0::askfirst:/bin/ash --login



### Run the code

Run the code at least once on your computer so that a fresh ```public/index.html``` is created. Make sure you copy it to the Yun.

Go to ```/www/sd/node-sounddetector/app``` and run:


    NODE_ENV=production node app


### Startup your node process everytime the Yun starts

Go the OpenWRT control panel of your Yun. Go to ```System```, ```Local Startup``` and add the following line to ```/etc/rc.local``` just before ```exit 0```:

    NODE_ENV=production /usr/bin/node /www/sd/node-sounddetector/app/app.js  1>/www/sd/node-sounddetector/app.log 2>&1 &



## Error fixes

### Error opening terminal: xterm-256color

Execute:

    export TERM=xterm

### FATAL ERROR: Evacuation Allocation failed - process out of memory

Edit ```/usr/bin/node```.

Change:

    NODE_PATH=/usr/lib/node_modules /usr/bin/nodejs --stack_size=1024 --max_old_space_size=20 --max_new_space_size=2048 --max_executable_size=5 --gc_global --gc_interval=100 $@

To:

    NODE_PATH=/usr/lib/node_modules /usr/bin/nodejs $@

Temporarily.

