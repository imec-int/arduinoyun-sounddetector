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

// my own parser (waits for 3 times 255 and then read the next 4 bytes):
function ownparser () {
	var data = new Buffer(0);

	return function (emitter, buffer){
		// console.log('rawbuffer', buffer);

		data = Buffer.concat([data, buffer]);

		while(data.length >= 7){

			var times255 = 0;
			var startindex;

			for (var i = 0; i < data.length; i++) {
				if(data[i] == 255){
					times255++;
				}else{
					if(times255 >= 3){
						// we have a starting point:
						startindex = i-3;
						break;
					}else{
						times255 = 0;
						startindex = null;
					}
				}
			};

			if(startindex !== null){
				data = data.slice(startindex);
			}

			// get first 7 bytes:
			var out = data.slice(0,7);

			// leave the rest for the next time/whileloop
			data = data.slice(7);

			// emit those 7 bytes:
			emitter.emit('data', out);
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
	// console.log(data);

	if(data[3] == 02){
		return parseSoundState(data);
	}

	if(data[3] == 03){
		return parseSoundLevel(data);
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

	//data[3] should be emtpy
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

function updateSilenceThreshold (channel, silenceThreshold) {
	var buf = new Buffer(7);
	buf[0] = 255;
	buf[1] = 255;
	buf[2] = 255;
	buf[3] = 3; // update silenceThreshold
	buf[4] = channel;

	buf.writeUInt16BE(silenceThreshold, 5);

	sp.write( buf , function (err, results) {
		if(err) return console.log('serial write err', err);
	});
}

function updateSoundThreshold (channel, soundThreshold) {
	var buf = new Buffer(7);
	buf[0] = 255;
	buf[1] = 255;
	buf[2] = 255;
	buf[3] = 4; // update soundThreshold
	buf[4] = channel;
	buf.writeUInt16BE(soundThreshold, 5);

	sp.write( buf , function (err, results) {
		if(err) return console.log('serial write err', err);
	});
}

function updateNrOfConsecutiveSilenceSamplesBeforeFlippingToSilence (channel, nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence) {
	var buf = new Buffer(7);
	buf[0] = 255;
	buf[1] = 255;
	buf[2] = 255;
	buf[3] = 5; // update nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence
	buf[4] = channel;
	buf.writeUInt16BE(nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence, 5);

	sp.write( buf , function (err, results) {
		if(err) return console.log('serial write err', err);
	});
}

function updateNrOfConsecutiveSoundSamplesBeforeFlippingToSound (channel, nrOfConsecutiveSoundSamplesBeforeFlippingToSound) {
	var buf = new Buffer(7);
	buf[0] = 255;
	buf[1] = 255;
	buf[2] = 255;
	buf[3] = 6; // update nrOfConsecutiveSoundSamplesBeforeFlippingToSound
	buf[4] = channel;
	buf.writeUInt16BE(nrOfConsecutiveSoundSamplesBeforeFlippingToSound, 5);

	sp.write( buf , function (err, results) {
		if(err) return console.log('serial write err', err);
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

	if(req.body.silenceThreshold !== undefined) {
		channel.silenceThreshold = req.body.silenceThreshold;
		updateSilenceThreshold(channel.id, channel.silenceThreshold);
	}

	if(req.body.soundThreshold !== undefined) {
		channel.soundThreshold = req.body.soundThreshold;
		updateSoundThreshold(channel.id, channel.soundThreshold);
	}

	if(req.body.nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence !== undefined) {
		channel.nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence = req.body.nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence;
		updateNrOfConsecutiveSilenceSamplesBeforeFlippingToSilence(channel.id, channel.nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence);
	}

	if(req.body.nrOfConsecutiveSoundSamplesBeforeFlippingToSound !== undefined) {
		channel.nrOfConsecutiveSoundSamplesBeforeFlippingToSound = req.body.nrOfConsecutiveSoundSamplesBeforeFlippingToSound;
		updateNrOfConsecutiveSoundSamplesBeforeFlippingToSound(channel.id, channel.nrOfConsecutiveSoundSamplesBeforeFlippingToSound);
	}

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







