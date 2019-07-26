// Giphy Search
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !gif kitten

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"gif": "Search for an animated GIF using the Giphy service, e.g. `!gif kitten`"
	},
	
	startup: function(callback) {
		// bot is starting up
		callback();
	},
	
	cmd_gif: function(value, chat) {
		// gif command
		var self = this;
		if (!value) return this.doUsage(chat);
		
		if (!this.config.api_key) {
			return this.doError(chat, "No API key found.  Please add your [Giphy](https://developers.giphy.com/) API key via `!config set gif/api_key YOUR_API_KEY`.");
		}
		
		var base_url = 'https://api.giphy.com/v1/gifs/search';
		url = base_url + Tools.composeQueryString({
			api_key: this.config.api_key,
			q: value,
			lang: 'en',
			limit: this.config.limit || 1
		});
		
		this.logDebug(9, "Fetching GIF for " + value + ": " + url);
		
		this.startTyping(chat);
		this.request.json( url, null, function(err, resp, data, perf) {
			self.stopTyping();
			
			if (err) {
				return self.doError(chat, "Failed to fetch GIF for: " + value + ": " + err);
			}
			if (!data || !data.data || !data.data.length) {
				return self.doError(chat, "No GIF found for: " + value);
			}
			
			var result = Tools.randArray( data.data );
			var link = result.url;
			var image_url = '';
			
			if (result.images && result.images.original && result.images.original.mp4) {
				image_url = result.images.original.mp4;
			}
			else if (result.images && result.images.original && result.images.original.url) {
				image_url = result.images.original.url;
			}
			if (!image_url) {
				return self.doError(chat, "No GIF found for: " + value);
			}
			
			self.doReply(chat, image_url); // + " ([Source]("+link+"))");
		}); // request.json
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
