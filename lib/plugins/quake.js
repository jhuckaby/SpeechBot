// Earthquake Monitoring
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !quake on
// !quake off

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"quake": "Enable or disable USGS earthquake monitoring, e.g. `!quake on` or `!quake off`"
	},
	
	startup: function(callback) {
		// bot is starting up
		
		// register minute handler
		this.server.on('minute', this.monitor.bind(this));
		
		callback();
	},
	
	cmd_quake: function(value, chat) {
		// quake command
		var self = this;
		if (!value) return this.doUsage(chat);
		
		if (value.match(/on/i)) {
			// enable monitoring
			this.data.enabled = chat.channel_id;
			this.storeData();
			this.doReply(chat, ":earth_americas: Earthquake monitoring enabled (will emit to this channel).");
		}
		else if (value.match(/off/i)) {
			// disable monitoring
			this.data.enabled = false;
			this.storeData();
			this.doReply(chat, ":earth_americas: Earthquake monitoring disabled.");
		}
	},
	
	monitor: function() {
		// monitor USGS for new quakes
		var self = this;
		if (!this.data.enabled) return;
		if (!this.data.quakes) this.data.quakes = {};
		
		var url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_hour.geojson';
		this.logDebug(9, "Fetching quakes: " + url);
		
		this.request.json( url, null, function(err, resp, data, perf) {
			if (err) {
				self.logError('usgs', "Failed to fetch quakes: " + err);
				return;
			}
			
			var all_ids = {};
			var new_quake = false;
			var now = Tools.timeNow();
			
			if (data && data.features && data.features.length) {
				data.features.forEach( function(quake) {
					if (quake.properties && (quake.properties.type == "earthquake")) {
						// try to avoid dupes
						var props = quake.properties;
						var loc_id = ''+props.place;
						if (loc_id.match(/\s+of\s+(.+)$/)) loc_id = RegExp.$1;
						var epoch = props.time / 1000;
						
						if (!self.data.quakes[quake.id] && (loc_id != self.data.last_loc_id) && (now - epoch < 3600) && !new_quake) {
							// new quake!
							self.logDebug(9, "New earthquake detected", quake);
							
							// pick an appropriate emoji for the occasion
							var emoji = 'earth_americas';
							if (quake.geometry && quake.geometry.coordinates && quake.geometry.coordinates.length) {
								var longitude = quake.geometry.coordinates[0];
								var latitude = quake.geometry.coordinates[1];
								if (longitude <= -22) emoji = 'earth_americas';
								else if (longitude <= 54) emoji = 'earth_africa';
								else emoji = 'earth_asia';
							}
							
							self.say( self.data.enabled, ":" + emoji + ": **New Earthquake**: Magnitude " + props.mag + ", " + props.place + " ([Details](" + props.url + "))" );
							self.data.last_loc_id = loc_id;
							new_quake = true;
						} // new quake
						
						all_ids[ quake.id ] = 1;
					} // earthquake type
				} ); // foreach quake
			} // data has quakes
			
			self.data.quakes = all_ids;
			self.storeData();
		}); // request.json
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
