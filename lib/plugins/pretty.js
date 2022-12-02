// JSON Pretty-Printer
// SpeechBot Plugin
// Copyright (c) 2021 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

module.exports = Class.create({
	
	__parent: Plugin,
	
	startup: function(callback) {
		// bot is starting up
		
		// listen for ALL chat traffic, so we can scan for matching JSON
		this.api.on('said', this.said.bind(this));
		
		callback();
	},
	
	said: function(chat) {
		// someone said something, look for bad words, ignore self
		var self = this;
		var chan = chat.channel_id;
		
		if (!chat.type.match(/^(standard|code)$/) || chat.is_command || (chat.username == this.api.username)) {
			return;
		}
		
		try {
			var text = chat.text.trim();
			if (text.match(/^\{.{64,}\}$/) && !text.match(/\n/)) {
				var json = JSON.parse( text );
				var opts = { type: 'code' };
				this.say( chan, JSON.stringify(json, null, "\t"), opts );
			}
		}
		catch (e) {
			;
		}

	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
