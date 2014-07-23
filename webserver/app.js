#!/usr/bin/env node

var express = require('express');
var http = require('http')
var path = require('path');
var utils = require('./utils');
var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var net = require('net');
var socketio = require('socket.io');


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

var sp = new SerialPort("/dev/ttyATH0", {
	parser: ownparser(),
	baudrate: 9600
});



app.get('/', function (req, res){
	res.render('index', { title: 'Hello World' });
});

app.post('/rest/led', function (req, res){
	var state = req.body.state;

	console.log(state);

	sp.write( (state=='on')?'a':'b', function (err, results) {
		if(err) return console.log('serial write err', err);
	});

	res.json(state);
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
}

function parseSoundState (data) {
	var state = {
		channel: data[4],
		soundon: (data[5] == 1) // boolean, true or false
	};
	console.log('sound state changed', state);

	//data[3] should be emtpy
}


sp.on("close", function () {
	console.log('serialport closed');
});






