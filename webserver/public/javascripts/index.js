var App = function (options){

	var canvas = document.getElementById('soundgraph');
	var socket, ctx, soundbuffer;
	var x = 0;
	var xDistance = 2; //distance between points on the graph

	var currentSoundon = false;
	var newsoundleveldata = false;

	var init = function (){
		console.log("init");
		initSocket();
		addUIHandlers();
		initCanvas();

		$(window).on("load resize orientationchange", function() {
			updateDimensions();
		});
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

		ctx = canvas.getContext('2d');

		canvas.width  = $('canvas').width();
		canvas.height = $('canvas').height();

		WIDTH = canvas.width;
		HEIGHT = canvas.height;

		ctx.fillStyle = 'rgb(200, 200, 200)';
		ctx.lineWidth = 1;

		soundbufferLENGTH = Math.floor(canvas.width/xDistance);
		soundbuffer = new Array(soundbufferLENGTH);

		draw();
	};

	var updateDimensions = function () {

	};

	var addUIHandlers = function () {
		$('#ledenable').click(onEnableLed);
		$('#leddisable').click(onDisableLed);
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
		soundbuffer.push({percentage: percentage, soundon: currentSoundon});
	};

	var draw = function () {
		var x_prev = 0;
		var soundvalue_prev = 0;
		var soundon_prev = false;


		ctx.fillRect(0, 0, WIDTH, HEIGHT);
		ctx.strokeStyle="black";


		for (var i = 0; i < soundbuffer.length; i++) {
			if(!soundbuffer[i]) continue;

			var x = i*xDistance;
			var soundvalue = HEIGHT-soundbuffer[i].percentage*HEIGHT;


			if(soundbuffer[i].soundon != soundon_prev){
				if(soundbuffer[i].soundon)
					ctx.strokeStyle="red";
				else
					ctx.strokeStyle="black";
			}

			ctx.beginPath();
			ctx.moveTo(x_prev, soundvalue_prev);
			if(x_prev != 0)
				ctx.lineTo(x, soundvalue);
			ctx.stroke(); // draw it




			x_prev = x;
			soundvalue_prev = soundvalue;
			soundon_prev = soundbuffer[i].soundon;
		};


		// redraw:
		requestAnimationFrame(draw);
	};

	var onSoundstateChanged = function (soundstate) {
		currentSoundon = soundstate.soundon;
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

