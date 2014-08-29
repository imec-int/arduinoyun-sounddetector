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


			// turn off soundgraph monitoring when switching channels in UI:
			$.post('/api/soundgraph/off');
		}

	});




	// Backbone MODELS AND COLLECTIONS:
	// ================================

	Models.Channel = Backbone.Model.extend({
		defaults:{
			active: false,
			soundstate: false,

			onsoundevent_enabled: false,
			onsoundevent_type: 'put',
			onsoundevent_endpoint: null,
			onsoundevent_body: null,
			onsilenceevent_enabled: false,
			onsilenceevent_type: 'put',
			onsilenceevent_endpoint: null,
			onsilenceevent_body: null
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
			this.model.on('change:name', this.renderName, this);
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

		renderName: function (model, name) {
			this.$('.name').html( name );
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

			this.model.on('change:name', this.renderName, this);
			this.model.on('change:soundstate', this.renderSoundstate, this);
			this.model.on('change:level', this.level_changed, this);
		},

		events : {
			'click button.updatechannelname' : 'updatechannelname_clicked',

			'click .activatesoundgraph': 'activatesoundgraph_clickhandler',
			'click .deactivatesoundgraph': 'deactivatesoundgraph_clickhandler',
			'change .silenceThreshold': 'silenceThreshold_changehandler',
			'change .soundThreshold': 'soundThreshold_changehandler',
			'change .nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence': 'nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence_changehandler',
			'change .nrOfConsecutiveSoundSamplesBeforeFlippingToSound': 'nrOfConsecutiveSoundSamplesBeforeFlippingToSound_changehandler',

			'change .httpevent input': 'httpevent_input_changed',
			'keyup .httpevent input, .httpevent textarea': 'httpevent_input_changed',
			'click .savehttpevents': 'savehttpevents_clicked'
		},

		render: function(){
			var html = $(this.template).tmpl(this.model.toJSON());
			this.$el.html(html);
			this.updateHttpeventsUI();
			return this;
		},

		renderName: function (model, name) {
			this.$('.name').html( name );
		},

		renderSoundstate: function (model, soundstate) {
			if( soundstate == true ) {
				this.$el.addClass('soundon');
			}else{
				this.$el.removeClass('soundon');
			}
		},


		level_changed: function (model, level) {
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

			this.graph.canvas = this.$('.soundgraph canvas')[0];
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

			// draw threshold lines:
			var y_slicenceThreshold = this.graph.canvas.height - this.model.get('silenceThreshold')/1024*this.graph.canvas.height;
			var y_soundThreshold = this.graph.canvas.height - this.model.get('soundThreshold')/1024*this.graph.canvas.height;


			this.graph.ctx.beginPath();
			this.graph.ctx.lineWidth=2;
			this.graph.ctx.moveTo(0, y_slicenceThreshold);
			this.graph.ctx.lineTo(this.graph.canvas.width, y_slicenceThreshold);
			this.graph.ctx.stroke(); // draw it

			this.graph.ctx.strokeStyle = 'red';

			this.graph.ctx.beginPath();
			this.graph.ctx.moveTo(0, y_soundThreshold);
			this.graph.ctx.lineTo(this.graph.canvas.width, y_soundThreshold);
			this.graph.ctx.stroke(); // draw it

			this.graph.ctx.strokeStyle = 'black';
			this.graph.ctx.lineWidth=1;


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
		},

		// UI Handlers:
		updatechannelname_clicked: function (event) {
			this.model.save('name', this.$('input.channelname').val(), {patch: true});
		},

		activatesoundgraph_clickhandler: function (event) {
			this.$el.addClass('soundgraphactive');
			this.initGraph();
		},

		deactivatesoundgraph_clickhandler: function (event) {
			this.$el.removeClass('soundgraphactive');
			this.destroyGraph();
		},

		silenceThreshold_changehandler: function (event) {
			this.model.save('silenceThreshold', this.$('.silenceThreshold').val(), {patch: true});
		},

		soundThreshold_changehandler: function (event) {
			this.model.save('soundThreshold', this.$('.soundThreshold').val(), {patch: true});
		},

		nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence_changehandler: function (event) {
			this.model.save('nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence', this.$('.nrOfConsecutiveSilenceSamplesBeforeFlippingToSilence').val(), {patch: true});
		},

		nrOfConsecutiveSoundSamplesBeforeFlippingToSound_changehandler: function (event) {
			this.model.save('nrOfConsecutiveSoundSamplesBeforeFlippingToSound', this.$('.nrOfConsecutiveSoundSamplesBeforeFlippingToSound').val(), {patch: true});
		},

		httpevent_input_changed: function (event) {
			this.$('.savehttpevents').removeAttr('disabled');
			this.updateHttpeventsUI();
		},

		updateHttpeventsUI: function () {
			var onsoundEl = this.$('.onsound_event');
			var onsilenceEl = this.$('.onsilence_event');

			if( onsoundEl.find('.enable').is(':checked') )
				onsoundEl.find('.type>input,.endpoint,.httpbody').removeAttr('disabled');
			else
				onsoundEl.find('.type>input,.endpoint,.httpbody').attr('disabled', 'disabled');


			if( onsilenceEl.find('.enable').is(':checked') )
				onsilenceEl.find('.type>input,.endpoint,.httpbody').removeAttr('disabled');
			else
				onsilenceEl.find('.type>input,.endpoint,.httpbody').attr('disabled', 'disabled');
		},

		savehttpevents_clicked: function (event) {
			var onsoundEl = this.$('.onsound_event');
			var onsilenceEl = this.$('.onsilence_event');

			var data = {
				onsoundevent_enabled   : onsoundEl.find('.enable').is(':checked'),
				onsoundevent_type      : onsoundEl.find('.type>input:checked').val(),
				onsoundevent_endpoint  : onsoundEl.find('.endpoint').val(),
				onsoundevent_body      : onsoundEl.find('.httpbody').val(),

				onsilenceevent_enabled : onsilenceEl.find('.enable').is(':checked'),
				onsilenceevent_type    : onsilenceEl.find('.type>input:checked').val(),
				onsilenceevent_endpoint: onsilenceEl.find('.endpoint').val(),
				onsilenceevent_body    : onsilenceEl.find('.httpbody').val()
			};

			var validjson = this.checkValidJson(data.onsoundevent_body);
			if(data.onsoundevent_enabled && !validjson) return alert("'On Sound' body is not valid json.");

			validjson = this.checkValidJson(data.onsilenceevent_body);
			if(data.onsilenceevent_enabled && !validjson) return alert("'On Silence' body is not valid json.");

			this.model.save(data, {patch: true});
			this.$('.savehttpevents').attr('disabled', 'disabled');
		},

		checkValidJson: function (data) {
			try{
				JSON.parse(data);
				return true;
			}catch(e){
				return false;
			}
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






