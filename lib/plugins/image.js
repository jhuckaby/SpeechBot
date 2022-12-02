// Google Image Search
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !image kitten

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"image": "Search for an image using Google Image Search, e.g. `!image kitten`"
	},
	
	startup: function(callback) {
		// bot is starting up
		callback();
	},
	
	cmd_image: function(value, chat) {
		// image command
		var self = this;
		if (!value) return this.doUsage(chat);
		
		if (!this.config.api_key) {
			return this.doError(chat, "No API key found.  Please add your [Google](https://console.developers.google.com/) API key via `!config set image/api_key YOUR_API_KEY`.");
		}
		if (!this.config.app_id) {
			return this.doError(chat, "No App ID found.  Please add your [Google](https://console.developers.google.com/) API key via `!config set image/app_id YOUR_APP_ID`.");
		}
		
		// safe mode
		var safety = 'high';
		if (value.match(/^unsafe\s+(.+)$/i)) {
			safety = 'off';
			value = value.replace(/^unsafe\s+(.+)$/, '$1');
		}
		
		var base_url = 'https://www.googleapis.com/customsearch/v1';
		url = base_url + Tools.composeQueryString({
			key: this.config.api_key,
			cx: this.config.app_id,
			safe: safety,
			num: this.config.limit || 5,
			searchType: 'image',
			imgType: 'photo',
			q: value
		});
		
		this.logDebug(9, "Fetching image for " + value + ": " + url);
		
		this.startTyping(chat);
		this.request.json( url, null, function(err, resp, data, perf) {
			self.stopTyping();
			
			if (err) {
				return self.doError(chat, "Failed to fetch image for: " + value + ": " + err);
			}
			if (data && data.error) {
				return self.doError(chat, "Google Image API Error: " + data.error.code + ": " + data.error.message);
			}
			
			var urls = [];
			if (data && data.items && data.items.length) {
				data.items.forEach( function(item) {
					if (item.link && item.link.match(/\.(jpg|jpeg|gif|png)(\?|$)/i) && !item.link.match(/(ytimg\.com)/)) {
						urls.push( item.link );
					}
				} );
			}
			
			if (!urls.length) {
				return self.doError(chat, "No images found for: " + value);
			}
			
			// Google has significantly "damaged" the image search API so the results are mostly crap
			// Instead of picking from the random top results, just grab the topmost one
			var image_url = urls.shift();
			
			self.doReply(chat, image_url);
		}); // request.json
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
