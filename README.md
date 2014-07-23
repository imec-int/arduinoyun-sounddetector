# Arduino Yun - Sound Detector

Building an internet connected Sound Detector on an Arduino Yun using Node.js


## Notes

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

### other modules

Try to install other modules on your computer and then copy them to the Yun. Installing modules on can take up some time.

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