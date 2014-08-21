#!/usr/bin/env node

var express = require('express');
var http = require('http')
var path = require('path');
var jade = require('jade');
var fs = require('fs');
var utils = require('./utils');

var net = require('net');
var socketio = require('socket.io');
var _ = require('underscore');

var Arduino = require('./arduino');
var arduino = new Arduino();


var settingsdb = require('./settingsdb');
var settings = {};

settingsdb.load(function (err, _settings) {
	settings = _settings;
});





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


// Socket io:
var io = socketio.listen(webserver);
io.set('log level', 0);

io.sockets.on('connection', function (socket) {
	socket.on('disconnect', function() {
		console.log('> user disconnected, disabling soundgraph monitoring');
		arduino.disableSoundgraphMonitoring();
	});
});


// Arduino:

arduino.on('soundlevelChanged', function (soundlevel) {
	console.log('soundlevelChanged', soundlevel);
	io.sockets.emit('soundlevelChanged', soundlevel);
});

arduino.on('soundstateChanged', function (state) {
	console.log('soundstateChanged', state);
	io.sockets.emit('soundstateChanged', state);
});

arduino.on('incommingSettings', function (channel_arduino) {
	console.log('incommingSettings', channel_arduino);

	// check if channel settings are different from local channel settings:
	var channel_local = _.find(settings.channels, function (channel) {
		return channel.id == channel_arduino.id;
	});

	// console.log('--------------------------');
	// console.log(channel_local);
	// console.log(channel_arduino);

	var isDifferent = false;

	if(channel_local.silenceThreshold != channel_arduino.silenceThreshold)
		isDifferent = true;

	if(channel_local.soundThreshold != channel_arduino.soundThreshold)
		isDifferent = true;

	if(channel_local.nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence != channel_arduino.nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence)
		isDifferent = true;

	if(channel_local.nrOfConsecutiveSoundSamplesBeforeFlippingToSound != channel_arduino.nrOfConsecutiveSoundSamplesBeforeFlippingToSound)
		isDifferent = true;


	if( isDifferent ){
		arduino.sendSettings(channel_local);
	}
});


// Webserver routes:


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

// rest interface to backbone:
app.get('/api/channels', function (req, res) {
	return res.send(settings.channels);
});

app.patch('/api/channels/:channelid', function (req, res) {
	var channel = _.find(settings.channels, function (channel) {
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

	if(changesHappened){
		arduino.sendSettings(channel);
	}

	settingsdb.save(settings);


	return res.send(channel);
});


// request soundgraph data for channel:
app.post('/api/soundgraph/on', function (req, res) {
	var channel = parseInt(req.body.channel);
	arduino.enableSoundgraphMonitoring(channel);
	res.json('requested');
});

app.post('/api/soundgraph/off', function (req, res) {
	var channel = parseInt(req.body.channel);
	arduino.disableSoundgraphMonitoring();
	res.json('requested');
});







