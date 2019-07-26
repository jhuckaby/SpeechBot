// Urban Dictionary API
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !urban grok

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"urban": "Look up the definition of a term on UrbanDictionary.com, e.g. `!urban grok`"
	},
	
	startup: function(callback) {
		// bot is starting up
		callback();
	},
	
	cmd_urban: function(value, chat) {
		// urban command
		var self = this;
		if (!value) return this.doUsage(chat);
		
		// http://api.urbandictionary.com/v0/define?page=1&term=
		var base_url = 'http://api.urbandictionary.com/v0/define';
		url = base_url + Tools.composeQueryString({
			page: 1,
			term: value
		});
		
		this.logDebug(9, "Fetching urban definition for " + value + ": " + url);
		
		this.startTyping(chat);
		this.request.json( url, null, function(err, resp, data, perf) {
			self.stopTyping();
			
			if (err) {
				return self.doError(chat, "Failed to fetch definition for: " + value + ": " + err);
			}
			if (!data || !data.list || !data.list.length || !data.list[0].definition) {
				return self.doError(chat, "No definition found for: " + value);
			}
			
			var item = data.list[0];
			
			var title = Tools.ucfirst( item.word || value );
			var desc = '' + item.definition;
			var link = 'http://www.urbandictionary.com/define.php?term=' + encodeURIComponent(value);
			
			desc = desc.replace(/[\[\]]+/g, '');
			
			self.doReply(chat, ":newspaper: **" + title + "**: " + desc + " ([Details]("+link+"))");
		}); // request.json
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
