#!/usr/bin/env node

var express = require('express');
var http = require('http')
var path = require('path');
var utils = require('./utils');
var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var net = require('net');


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
	console.log("Express server listening on port " + app.get('port') + " - v 0.0.4");
});


// Serial:

// byteLength parser (waits for x bytes and then emits them as data)
function byteLength (length) {
	var data = new Buffer(0);

	return function (emitter, buffer){
		data = Buffer.concat([data, buffer]);
		while (data.length >= length) {
			var out = data.slice(0,length);
			data = data.slice(length);
			emitter.emit('data', out);
		}
	};
}

var sp = new SerialPort("/dev/ttyATH0", {
	parser: byteLength(4),
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
	if(data[0] == 03){
		return parseSoundLevel(data);
	}

	if(data[0] == 02){
		return parseSoundState(data);
	}
});

function parseSoundLevel (data) {
	var soundlevel = {
		channel: data[1],
		value: data.readUInt16BE(2) // last two bytes are a 16bit integer encoded big endian
	};
	console.log('sound level changed', soundlevel);
}

function parseSoundState (data) {
	var state = {
		channel: data[1],
		soundon: (data[2] == 1) // boolean, true or false
	};
	console.log('sound state changed', state);

	//data[3] should be emtpy
}


sp.on("close", function () {
	console.log('serialport closed');
});






