var App = function (options) {

	var xDistance = 2; //distance between points on the graph

	var socket;

	var router;
	var Models= {};
	var Collections = {};
	var Views = {};


	function init () {
		initSocket();
		initBackbone();
	}

	var initSocket = function (){
		if(socket) return; // already initialized

		socket = io.connect(window.location.hostname);

		// some debugging statements concerning socket.io
		socket.on('disconnect', function(){
			console.log('disconnected');
		});
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

	var initBackbone = function () {
		router = new Router();

		Collections.channels = new Collections.Channels();
		Views.menu = new Views.Menu({collection: Collections.channels});
		Collections.channels.fetch({success: function () {
			Backbone.history.start();
		}});
	};

 	var onSoundlevelChanged = function (data) {
 		// data.channel
 		// data.value
 		Collections.channels.get(data.channel).set('level', data.value);
 	};

	var onSoundstateChanged = function (data) {
		// data.channel
		// data.soundstate
		Collections.channels.get(data.channel).set('soundstate', data.soundstate);
	};

	// Backbone ROUTER:
	// ================


	Router = Backbone.Router.extend({
		routes: {
			''                      : 'empty',
			'channels/:channelid'   : 'channel'
		},

		empty: function() {
			$('.maincontent').empty();
		},

		channel: function(channelid) {
			var channel = Collections.channels.get(channelid);

			// used to highlight which channel is shown in the mainview:
			Collections.channels.forEach(function (element, index, list) {
				if(element == channel)
					element.set('active', true);
				else
					element.set('active', false);
			});

			// create a new channelview and append it to maincontent:
			var view = new Views.Channel({model: channel});
			$('.maincontent').empty().append( view.render().el );
		}

	});




	// Backbone MODELS AND COLLECTIONS:
	// ================================

	Models.Channel = Backbone.Model.extend({
		defaults:{
			active: false,
			soundstate: false
		}
	});

	Collections.Channels = Backbone.Collection.extend({
		model: Models.Channel,
		url: '/api/channels'
	});

	Views.Menu = Backbone.View.extend({
		el: ".menu",

		initialize: function(){
			this.collection.on('add', this.addChannel, this);
		},

		addChannel: function(model){
			var view = new Views.Menu.Channel({model: model});
			this.$el.append( view.render().el );
		}
	});

	Views.Menu.Channel = Backbone.View.extend({
		template: '#channelmenuitem-tmpl',
		className: 'channelmenuitem',

		initialize: function(){
			this.model.on('change:soundstate', this.renderSoundstate, this);
			this.model.on('change:active', this.renderActiveState, this);
		},

		events : {
			'click': 'this_clicked'
		},

		render: function(){
			var html = $(this.template).tmpl(this.model.toJSON());
			this.$el.html(html);
			this.renderActiveState();
			return this;
		},

		renderSoundstate: function (model, soundstate) {
			if( soundstate == true ) {
				this.$el.addClass('soundon');
			}else{
				this.$el.removeClass('soundon');
			}
		},

		renderActiveState: function () {
			if( this.model.get('active') == true )
				this.$el.addClass('active');
			else
				this.$el.removeClass('active');
		},

		this_clicked: function (event) {
			router.navigate('/channels/'+this.model.id, {trigger: true});
		}
	});

	Views.Channel = Backbone.View.extend({
		template: '#channelview-tmpl',
		className: 'channelview',

		initialize: function(){
			this.graph = null;

			this.model.on('change:soundstate', this.renderSoundstate, this);
			this.model.on('change:level', this.level_changed, this);
		},

		events : {
			'click .activatesoundgraph': 'activatesoundgraph_clicked',
			'click .deactivatesoundgraph': 'deactivatesoundgraph_clicked'
		},

		render: function(){
			var html = $(this.template).tmpl(this.model.toJSON());
			this.$el.html(html);
			return this;
		},

		renderSoundstate: function (model, soundstate) {
			if( soundstate == true ) {
				this.$el.addClass('soundon');
			}else{
				this.$el.removeClass('soundon');
			}
		},

		activatesoundgraph_clicked: function (event) {
			this.$el.addClass('soundgraphactive');
			this.initGraph();
		},

		deactivatesoundgraph_clicked: function (event) {
			this.$el.removeClass('soundgraphactive');
			this.destroyGraph();
		},

		level_changed: function () {
			if(this.graph == null) return; // graph not initialized

			var percentage = this.model.get('level')/1024;

			// remove last item from buffer:
			this.graph.soundbuffer = this.graph.soundbuffer.slice(-(this.graph.soundbufferLENGTH-1));

			// add new item to buffer:
			this.graph.soundbuffer.push({
				percentage: percentage,
				soundstate: this.model.get('soundstate') // current soundstate
			});
		},

		initGraph: function () {
			$.post('/api/soundgraph/on', {
				channel: this.model.id
			});

			this.graph = {};

			this.graph.canvas = this.$('.soundgraph')[0];
			this.graph.ctx = this.graph.canvas.getContext('2d');

			this.graph.canvas.width  = this.$('.soundgraph').width();
			this.graph.canvas.height = this.$('.soundgraph').height();

			this.graph.ctx.fillStyle = 'rgb(200, 200, 200)';
			this.graph.ctx.lineWidth = 1;

			this.graph.soundbufferLENGTH = Math.floor(this.graph.canvas.width/xDistance);
			this.graph.soundbuffer = new Array(this.graph.soundbufferLENGTH);

			this.drawGraph();
		},

		drawGraph: function () {
			if(this.graph == null) return; // graph not initialized

			var x_prev = 0;
			var soundvaluePixels_prev = 0;
			var soundstate_prev = false;


			this.graph.ctx.fillRect(0, 0, this.graph.canvas.width, this.graph.canvas.height);
			this.graph.ctx.strokeStyle = 'black';


			for (var i = 0; i < this.graph.soundbuffer.length; i++) {
				if(!this.graph.soundbuffer[i]) continue;

				var x = i*xDistance;
				var soundlevelPixels = this.graph.canvas.height - this.graph.soundbuffer[i].percentage * this.graph.canvas.height;


				if(this.graph.soundbuffer[i].soundstate != soundstate_prev){
					if(this.graph.soundbuffer[i].soundstate)
						this.graph.ctx.strokeStyle = 'red';
					else
						this.graph.ctx.strokeStyle = 'black';
				}

				this.graph.ctx.beginPath();
				this.graph.ctx.moveTo(x_prev, soundvaluePixels_prev);
				if(x_prev != 0)
					this.graph.ctx.lineTo(x, soundlevelPixels);
				this.graph.ctx.stroke(); // draw it


				x_prev = x;
				soundvaluePixels_prev = soundlevelPixels;
				soundstate_prev = this.graph.soundbuffer[i].soundstate;
			};


			// redraw:
			var self = this;
			requestAnimationFrame(function () {
				self.drawGraph.call(self);
			});
		},

		destroyGraph: function () {
			$.post('/api/soundgraph/off', {
				channel: this.model.id
			});

			this.graph = null;
		}
	});

	return {
		init: init
	};
};



$(function(){
	app = new App();
	app.init();
});






