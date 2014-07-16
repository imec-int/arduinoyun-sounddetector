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

var sp = new SerialPort("/dev/ttyATH0", {
	// parser: serialport.parsers.readline("\n"),
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
	console.log('serial data', data);
});






