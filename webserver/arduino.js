// interface that talks to arduino using the serial port

var events = require('events');
var util = require('util');
var serialport = require('serialport');
var SerialPort = serialport.SerialPort;

// find serial ports:
// serialport.list(function (err, ports) {
//   ports.forEach(function(port) {
//     console.log(port.comName);
//     console.log(port.pnpId);
//     console.log(port.manufacturer);
//   });
// });
// return;


var serialportname = '/dev/ttyATH0';
if( process.env.NODE_ENV != 'production' ){
	var serialportname = '/dev/cu.usbmodemfa131'; // for debugging on local machine
}


// Serial:

// my own parser (waits for 3 times 255):
function ownparser () {
	var data = new Buffer(0);

	return function (emitter, buffer){
		// console.log('rawbuffer', buffer);

		data = Buffer.concat([data, buffer]);

		var checkfornewmessage = false;
		if(data.length > 0)
			checkfornewmessage = true;

		while(checkfornewmessage){
			checkfornewmessage = false;

			var startByteCounter = 0;
			var newMessageInTheMaking = false;
			for (var i = 0; i < data.length; i++) {
				if(data[i] == 255){
					startByteCounter++;
				}else{
					// first byte that's not 255 comes in
					// check if we have 3 start bytes:
					if(startByteCounter >=3){
						// good, this must a new message
						newMessageInTheMaking = true;
						break; // stop looking for other bytes:
					}else{
						// to bad, only 2 or less bytes where 255:
						startByteCounter = 0;
					}
				}
			}

			if(!newMessageInTheMaking) return; //wait some more until we have more bytes


			// find first occurrence of 255:
			var firstOccurenceOf255 = null;
			for (var i = 0; i < data.length; i++) {
				if(data[i] == 255){
					firstOccurenceOf255 = i;
					break;
				}
			}

			// cut of all data before this firstOccurenceOf255:
			data = data.slice(firstOccurenceOf255);

			// check if byte 4 is not 255:
			while(data[3] == 255){
				// cut off the buffer so that byte 4 is not 255:
				data = data.slice(1);
			}


			// now check for type of message:
			// 1 = soundstate
			// 2 = soundlevel
			// 3 = incomming settings

			var out;

			if( data[3] == 1 ){

				// console.log('should be soundstate');
				// we expect 2 more bytes to follow (so that's 6 bytes in total):
				if(data.length < 6) return; // wait for more bytes
				out = data.slice(0, 6);
				data = data.slice(6);

			} else if( data[3] == 2 ){

				// console.log('should be soundlevel');
				// we expect 3 more bytes to follow (so that's 7 bytes in total):
				if(data.length < 7) return; // wait for more bytes
				out = data.slice(0, 7);
				data = data.slice(7);

			} else if( data[3] == 3 ){

				// console.log('should be incomming settings');
				// we expect 9 more bytes to follow (so that's 13 bytes in total):
				if(data.length < 13) return; // wait for more bytes
				out = data.slice(0, 13);
				data = data.slice(13);

			}

			// emit those 6,7 or 13 bytes:
			emitter.emit('data', out);

			if(data.length>0){
				checkfornewmessage = true;
			}
		}
	};
}



Arduino = function(options){
	events.EventEmitter.call(this);
	return this;
}

util.inherits(Arduino, events.EventEmitter);

// 'public' functions:

Arduino.prototype.connect = function (channelid) {
	var self = this;

	this.sp = new SerialPort(serialportname, {
		parser: ownparser(),
		baudrate: 9600
	});

	serialport.on("error", function (err) {
		console.log(err);
	});

	this.sp.on("open", function () {
		console.log('serialport is open');
	});

	this.sp.on('data', function (data) {
		// console.log('data', data);
		if(data === undefined) return;
		if(!data[3]) return;

		if(data[3] == 1){
			return parseSoundState(data);
		}

		if(data[3] == 2){
			return parseSoundLevel(data);
		}

		if(data[3] == 3){
			return parseSettings(data);
		}
	});

	this.sp.on("close", function () {
		console.log('serialport closed');
	});

	function parseSoundLevel (data) {
		var soundlevel = {
			channel: data[4],
			value: data.readUInt16BE(5) // last two bytes are a 16bit integer encoded big endian
		};
		self.emit("soundlevelChanged", soundlevel);
	}

	function parseSoundState (data) {
		var state = {
			channel: data[4],
			soundstate: (data[5] == 1) // boolean, true or false
		};
		self.emit("soundstateChanged", state);
	}

	function parseSettings (data) {
		var channel = {
			id: data[4],
			silenceThreshold: data.readUInt16BE(5),
			soundThreshold: data.readUInt16BE(7),
			nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence: data.readUInt16BE(9),
			nrOfConsecutiveSoundSamplesBeforeFlippingToSound: data.readUInt16BE(11)
		}
		self.emit("incommingSettings", channel);
	}
};

Arduino.prototype.enableSoundgraphMonitoring = function (channelid) {
	var buf = new Buffer(5);
	buf[0] = 255;
	buf[1] = 255;
	buf[2] = 255;
	buf[3] = 1; // enable monitoring
	buf[4] = channelid;

	this.sp.write( buf , function (err, results) {
		if(err) return console.log('serial write err', err);
	});
};

Arduino.prototype.disableSoundgraphMonitoring = function () {
	var buf = new Buffer(4);
	buf[0] = 255;
	buf[1] = 255;
	buf[2] = 255;
	buf[3] = 2; // disable monitoring

	this.sp.write( buf , function (err, results) {
		if(err) return console.log('serial write err', err);
	});
};

Arduino.prototype.sendSettings = function (channel) {
	var buf = new Buffer(13);
	buf[0] = 255;
	buf[1] = 255;
	buf[2] = 255;
	buf[3] = 3; // update settings
	buf[4] = channel.id;
	buf.writeUInt16BE(channel.silenceThreshold, 5);
	buf.writeUInt16BE(channel.soundThreshold, 7);
	buf.writeUInt16BE(channel.nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence, 9);
	buf.writeUInt16BE(channel.nrOfConsecutiveSoundSamplesBeforeFlippingToSound, 11);

	console.log('sending settings of channel ' + channel.id);

	this.sp.write( buf , function (err, results) {
		if(err) return console.log('serial error when sending settings for channel ' + channel.id, err);
	});
}


module.exports = Arduino;