#!/usr/bin/env node

var express = require('express');
var http = require('http')

var app = express();

app.configure(function(){
	app.set('port', process.env.PORT || 8080);
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(app.router);
});

app.configure('development', function(){
	app.use(express.errorHandler());
});

var webserver = http.createServer(app).listen(app.get('port'), function(){
	console.log("Test endpoint web server listening on port " + app.get('port'));
});

app.put('/api/sound', function (req, res){
	console.log('incomming event', req.body);

	res.json("thx");
});
