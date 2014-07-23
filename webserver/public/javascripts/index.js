var App = function (options){

	var socket;

	var init = function (){
		console.log("init");
		initSocket();
		addUIHandlers();
	};

	var initSocket = function (){
		if(socket) return; // already initialized

		socket = io.connect(window.location.hostname);

		// some debugging statements concerning socket.io
		socket.on('reconnecting', function(seconds){
			console.log('reconnecting in ' + seconds + ' seconds');
		});
		socket.on('reconnect', function(){
			console.log('reconnected');
		});
		socket.on('reconnect_failed', function(){
			console.log('failed to reconnect');
		});
		socket.on('connect', function() {
			console.log('connected');
		});

		socket.on('soundlevelChanged', onSoundlevelChanged);
		socket.on('soundstateChanged', onSoundstateChanged);
	};

	var addUIHandlers = function () {
		$('.led .enable').click(onEnableLed);
		$('.led .disable').click(onDisableLed);
	};

	var onEnableLed = function (event) {
		$.post('/rest/led', {state: 'on'});
	};

	var onDisableLed = function (event) {
		$.post('/rest/led', {state: 'off'});
	};


	var onSoundlevelChanged = function (soundlevel) {
		// console.log(soundlevel);

		if(soundlevel.channel != 0) return; //debug

		var percentage = soundlevel.value/1024;

		soundlevel.db = 20.0 * log10(soundlevel.value+1);

		// console.log(soundlevel.db);

		$('.soundbar .fill').css('height', (percentage*100)+'%')
	};

	var onSoundstateChanged = function (soundstate) {
		console.log(soundstate);
	};

	var log10 = function (x) {
		return Math.log(x) / Math.LN10;
	};

	return {
		init: init
	};
};



$(function(){
	var app = new App();
	app.init();
});

