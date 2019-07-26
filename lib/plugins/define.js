// Define Term (Wikipedia API)
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !define XML

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"define": "Define a word or term using Wikipedia, e.g. `!define Ent`"
	},
	
	startup: function(callback) {
		// bot is starting up
		callback();
	},
	
	cmd_define: function(value, chat) {
		// define command
		var self = this;
		if (!value) return this.doUsage(chat);
		
		var base_url = 'https://en.wikipedia.org/w/api.php';
		url = base_url + Tools.composeQueryString({
			action: 'opensearch',
			search: value,
			format: 'json'
		});
		
		this.logDebug(9, "Fetching definition for " + value + ": " + url);
		
		this.startTyping(chat);
		this.request.json( url, null, function(err, resp, data, perf) {
			self.stopTyping();
			
			if (err) {
				return self.doError(chat, "Failed to fetch definition for: " + value + ": " + err);
			}
			if (!data || (data.length < 4) || !data[1].length) {
				return self.doError(chat, "No definition found for: " + value);
			}
			
			var titles = data[1];
			var descs = data[2];
			var links = data[3];
			
			var has_desc = false;
			for (var idx = 0, len = descs.length; idx < len; idx++) {
				if (descs[idx] && !descs[idx].match(/may\s+refer\s+to/)) { has_desc = true; idx = len; }
			}
			if (!has_desc) descs[0] = "(No description provided)";
			
			while (!descs[0] || descs[0].match(/may\s+refer\s+to/)) {
				// disambiguation is first result, skip it
				titles.shift();
				descs.shift();
				links.shift();
			}
			
			var title = titles.shift();
			var desc = descs.shift().replace(/\(\)\s+/g, '');
			var link = links.shift();
			
			self.doReply(chat, ":book: **" + title + "**: " + desc + " ([Details]("+link+"))");
		}); // request.json
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
