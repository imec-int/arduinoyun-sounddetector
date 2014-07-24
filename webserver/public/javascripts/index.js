var App = function (options){

	var socket, canvas, ctx, soundbuffer;
	var x = 0;
	var xDistance = 2; //distance between points on the graph

	var soundon = false;

	var init = function (){
		console.log("init");
		initSocket();
		addUIHandlers();
		initCanvas();
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

	var initCanvas = function () {
		canvas = document.getElementById('soundgraph');
		ctx = canvas.getContext('2d');

		WIDTH = canvas.width;
		HEIGHT = canvas.height;

		ctx.fillStyle = 'rgb(200, 200, 200)';
		ctx.lineWidth = 1;
		ctx.strokeStyle = 'rgb(0, 0, 0)';

		soundbufferLENGTH = Math.floor(canvas.width/xDistance);
		soundbuffer = new Array(soundbufferLENGTH);

		draw();
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

		// soundlevel.db = 20.0 * log10(soundlevel.value+1);


		soundbuffer = soundbuffer.slice(-(soundbufferLENGTH-1));
		soundbuffer.push({percentage: percentage, soundon: soundon});
	};

	var draw = function () {

		ctx.fillRect(0, 0, WIDTH, HEIGHT);
		ctx.beginPath();

		for (var i = 0; i < soundbuffer.length; i++) {

			if(!soundbuffer[i]) continue;

			var soundvalue = HEIGHT-soundbuffer[i].percentage*HEIGHT

			if(i === 0) {
				ctx.moveTo(i, soundvalue);
			} else {
				ctx.lineTo(i*xDistance, soundvalue);
			}
		};

		ctx.stroke();

		// $('.soundbar .fill').css('height', (soundbuffer[soundbuffer.length-1]*100)+'%');

		drawVisual = requestAnimationFrame(draw);
	}

	var onSoundstateChanged = function (soundstate) {
		// console.log(soundstate);

		soundon = soundstate.soundon;
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

