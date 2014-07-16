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

Ipv via ```npm install``` node-serialport te installeren, is er een gecompileerde openWRT package beschikbaar.

node-serialport kan dus geïnstalleerd worden met:

    opkg update
    opkg install node-serialport

### npm install

Kan redelijk wat tijd in beslag nemen. Best zoveel mogelijk op pc 'compilen'/installeren en dan overkopiëren naar de Yun.

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