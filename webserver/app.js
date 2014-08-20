#!/usr/bin/env node

var express = require('express');
var http = require('http')
var path = require('path');
var jade = require('jade');
var fs = require('fs');
var utils = require('./utils');
var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var net = require('net');
var socketio = require('socket.io');
var _ = require('underscore');
var config = require('./config');

var serialportname = '/dev/ttyATH0';

if( process.env.NODE_ENV != 'production' ){
	var serialportname = '/dev/cu.usbmodemfd121'; // for debugging on local machine
}

// find serial ports:
// serialport.list(function (err, ports) {
//   ports.forEach(function(port) {
//     console.log(port.comName);
//     console.log(port.pnpId);
//     console.log(port.manufacturer);
//   });
// });
// return;





// Webserver:

var app = express();

app.configure(function(){
	app.set('port', process.env.PORT || 3000);
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(express.favicon());
	// app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(app.router);
	app.use(require('stylus').middleware(__dirname + '/public'));
	app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
	app.use(express.errorHandler());
});

var webserver = http.createServer(app).listen(app.get('port'), function(){
	console.log("Express server listening on port " + app.get('port') + " - v 0.1.0");
});
var io = socketio.listen(webserver);
io.set('log level', 0);

io.sockets.on('connection', function (socket) {
	socket.on('disconnect', function() {
		console.log('> user disconnected, disabling soundgraph monitoring');
		disableSoundgraphMonitoring();
	});
});


// Serial:

// my own parser (waits for 3 times 255):
function ownparser () {
	var data = new Buffer(0);

	return function (emitter, buffer){
		console.log('rawbuffer', buffer);

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
				// we expect 2 more bytes to follow (so that's 6 bytes in total):
				if(data.length < 6) return; // wait for more bytes
				out = data.slice(0, 6);
				data = data.slice(6);
			}

			if( data[3] == 2 ){
				// we expect 3 more bytes to follow (so that's 7 bytes in total):
				if(data.length < 7) return; // wait for more bytes
				out = data.slice(0, 7);
				data = data.slice(7);
			}

			if( data[3] == 3 ){
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

var sp = new SerialPort(serialportname, {
	parser: ownparser(),
	baudrate: 9600
});

serialport.on("error", function (err) {
	console.log(err);
});


// Compile index.html if we're not on production 'machine':
if( process.env.NODE_ENV != 'production' ){
	fs.readFile(__dirname + '/views/index.jade', 'utf8', function (err, data) {
	    if (err) return console.log(err);

	    var template = jade.compile(data);
	    var html = template({});

	    fs.writeFile(__dirname + '/public/index.html', html, function (err) {
	    	if(err) return console.log(err);
	    	console.log('New index.html rendered');
	    });
	});
}


app.get('/', function (req, res) {
	if( process.env.NODE_ENV == 'production' ){
		res.sendfile(__dirname + '/public/index.html');
	}else{
		res.render('index', {});
	}
});


sp.on("open", function () {
	console.log('serialport is open');
});


sp.on('data', function (data) {
	console.log(data);

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

function parseSoundLevel (data) {
	var soundlevel = {
		channel: data[4],
		value: data.readUInt16BE(5) // last two bytes are a 16bit integer encoded big endian
	};

	console.log('sound level changed', soundlevel);
	io.sockets.emit('soundlevelChanged', soundlevel);
}

function parseSoundState (data) {
	var state = {
		channel: data[4],
		soundstate: (data[5] == 1) // boolean, true or false
	};

	console.log('sound state changed', state);
	io.sockets.emit('soundstateChanged', state);
}

function parseSettings (data) {
	var channel = {
		id: data[4],
		silenceThreshold: data.readUInt16BE(5),
		soundThreshold: data.readUInt16BE(7),
		nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence: data.readUInt16BE(9),
		nrOfConsecutiveSoundSamplesBeforeFlippingToSound: data.readUInt16BE(11)
	}
	console.log('incomming settings:', channel);
}


sp.on("close", function () {
	console.log('serialport closed');
});




function enableSoundgraphMonitoring (channel) {
	var buf = new Buffer(5);
	buf[0] = 255;
	buf[1] = 255;
	buf[2] = 255;
	buf[3] = 1; // enable monitoring
	buf[4] = channel;

	sp.write( buf , function (err, results) {
		if(err) return console.log('serial write err', err);
	});
}

function disableSoundgraphMonitoring () {
	var buf = new Buffer(4);
	buf[0] = 255;
	buf[1] = 255;
	buf[2] = 255;
	buf[3] = 2; // disable monitoring

	sp.write( buf , function (err, results) {
		if(err) return console.log('serial write err', err);
	});
}

function sendSettings (channelid) {
	var channel = _.find(config.channels, function (channel) {
		return channel.id == channelid;
	});

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

	sp.write( buf , function (err, results) {
		if(err) return console.log('serial error when sending settings for channel ' + channel.id, err);
	});
}


// rest interface to backbone:
app.get('/api/channels', function (req, res) {
	return res.send(config.channels);
});

app.patch('/api/channels/:channelid', function (req, res) {
	var channel = _.find(config.channels, function (channel) {
		return channel.id == req.params.channelid;
	});

	var changesHappened = false;

	if(req.body.silenceThreshold !== undefined) {
		channel.silenceThreshold = req.body.silenceThreshold;
		changesHappened = true;
	}

	if(req.body.soundThreshold !== undefined) {
		channel.soundThreshold = req.body.soundThreshold;
		changesHappened = true;
	}

	if(req.body.nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence !== undefined) {
		channel.nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence = req.body.nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence;
		changesHappened = true;
	}

	if(req.body.nrOfConsecutiveSoundSamplesBeforeFlippingToSound !== undefined) {
		channel.nrOfConsecutiveSoundSamplesBeforeFlippingToSound = req.body.nrOfConsecutiveSoundSamplesBeforeFlippingToSound;
		changesHappened = true;
	}

	if(changesHappened)
		sendSettings(channel.id);

	return res.send(channel);
});


// request soundgraph data for channel:
app.post('/api/soundgraph/on', function (req, res) {
	var channel = parseInt(req.body.channel);
	enableSoundgraphMonitoring(channel);
	res.json('requested');
});

app.post('/api/soundgraph/off', function (req, res) {
	var channel = parseInt(req.body.channel);
	disableSoundgraphMonitoring();
	res.json('requested');
});







