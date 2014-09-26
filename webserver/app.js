#!/usr/bin/env node

var express = require('express');
var http = require('http')
var path = require('path');
var jade = require('jade');
var fs = require('fs');

var httpreq = require('httpreq');

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

	// wait till settings are loaded before connecting to Arduino:
	arduino.connect();
});


function log() {
	console.log.apply(this, arguments);

	var now = new Date();
	var filepath = path.join(__dirname, "log.txt");

	var str = now.toString() + ': ';
	for (var i = 0; i < arguments.length; i++) {

		if (typeof arguments == 'string' || arguments instanceof String) {
			str += arguments[i] + '\n';
		}else{
			str += JSON.stringify(arguments[i]) + '\n';
		}

	}

	fs.appendFile(filepath, str, function (err) {});
}





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
	log("Express server listening on port " + app.get('port') + " - v 0.1.0");
});


// Socket io:
var io = socketio.listen(webserver);
io.set('log level', 0);

io.sockets.on('connection', function (socket) {
	socket.on('disconnect', function() {
		log('> user disconnected, disabling soundgraph monitoring');
		arduino.disableSoundgraphMonitoring();
	});
});


// Arduino:

arduino.on('soundlevelChanged', function (soundlevel) {
	// log('soundlevelChanged', soundlevel);

	// send to UI:
	io.sockets.emit('soundlevelChanged', soundlevel);
});

arduino.on('soundstateChanged', function (state) {
	// state.channel;
	// state.soundstate;

	log('soundstateChanged', state);


	// send to UI:
	io.sockets.emit('soundstateChanged', state);


	// check if we need to send a http event to somewhere:
	var channel = _.find(settings.channels, function (channel) {
		return channel.id == state.channel;
	});


	if(channel.onsoundevent_enabled && state.soundstate == true) {

		try{

			var json = null;
			try{
				json = JSON.parse(channel.onsoundevent_body);
			}catch(e){}

			// log("sending to endpoint", channel.onsoundevent_endpoint);

			if(json){
				httpreq[channel.onsoundevent_type](channel.onsoundevent_endpoint, {json: json}, function (err, res) {
					if(err) log('http error when sending http onsilenceevent for channel ' + state.channel, err);
				});
			}

		}catch(e){
			log('try/catch error when sending http onsilenceevent for channel ' + state.channel, e);
		}

	}



	if(channel.onsilenceevent_enabled && state.soundstate == false) {

		try{

			var json = null;
			try{
				json = JSON.parse(channel.onsilenceevent_body);
			}catch(e){}

			if(json){
				httpreq[channel.onsilenceevent_type](channel.onsilenceevent_endpoint, {json: json}, function (err, res) {
					if(err) log('http error when sending http onsoundevent for channel ' + state.channel, err);
				});
			}

		}catch(e){
			log('try/catch error when sending http onsoundevent for channel ' + state.channel, e);
		}

	}





});

arduino.on('incommingSettings', function (channel_arduino) {
	// log('incommingSettings', channel_arduino);

	// check if channel settings are different from local channel settings:
	var channel_local = _.find(settings.channels, function (channel) {
		return channel.id == channel_arduino.id;
	});

	// log('--------------------------');
	// log(channel_local);
	// log(channel_arduino);

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
		// log('isDifferent, sending settings');
		arduino.sendSettings(channel_local);
	}
});


// Webserver routes:


// Compile index.html if we're not on production 'machine':
if( process.env.NODE_ENV != 'production' ){
	fs.readFile(__dirname + '/views/index.jade', 'utf8', function (err, data) {
		if (err) return log(err);

		var template = jade.compile(data);
		var html = template({});

		fs.writeFile(__dirname + '/public/index.html', html, function (err) {
			if(err) return log(err);
			log('New index.html rendered');
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



	// ARDUINO SETTINGS

	var arduinosettings_changed = false;

	if(req.body.silenceThreshold !== undefined) {
		channel.silenceThreshold = req.body.silenceThreshold;
		arduinosettings_changed = true;
	}

	if(req.body.soundThreshold !== undefined) {
		channel.soundThreshold = req.body.soundThreshold;
		arduinosettings_changed = true;
	}

	if(req.body.nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence !== undefined) {
		channel.nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence = req.body.nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence;
		arduinosettings_changed = true;
	}

	if(req.body.nrOfConsecutiveSoundSamplesBeforeFlippingToSound !== undefined) {
		channel.nrOfConsecutiveSoundSamplesBeforeFlippingToSound = req.body.nrOfConsecutiveSoundSamplesBeforeFlippingToSound;
		arduinosettings_changed = true;
	}

	if(arduinosettings_changed){
		arduino.sendSettings(channel);
	}



	// CHANNEL NAME:

	if(req.body.name !== undefined) {
		channel.name = req.body.name;
	}



	// HTTP EVENT SETTINGS:

	if(req.body.onsoundevent_enabled !== undefined) { // we're only checking 'onsoundevent_enabled', the other 7 values should be there too
		// just 'paste' them into the channel object:
		for(var key in req.body){
			channel[key] = req.body[key];
		}
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







