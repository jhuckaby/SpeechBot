// Auto-Kick
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !autokick add BADWORD

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"autokick": "Add, remove or list autokick words, e.g. `!autokick add BADWORD`, `!autokick list`"
	},
	
	startup: function(callback) {
		// bot is starting up
		
		// listen for ALL chat traffic, so we can scan for bad words
		this.api.on('said', this.said.bind(this));
		
		// init data if not already
		if (!this.data.words) this.data.words = {};
		
		// pre-compile regexp
		this.compile();
		
		callback();
	},
	
	compile: function() {
		// compile regexp of matching bad words
		var esc_words = Object.keys(this.data.words).sort().map( function(word) {
			return Tools.escapeRegExp( word );
		} );
		if (!esc_words.length) esc_words.push("?!"); // never match
		this.regexp = new RegExp( "\\b(" + esc_words.join("|") + ")\\b", "i" );
	},
	
	cmd_autokick: function(value, chat) {
		// add/delete/list autokicks
		// admin only!
		if (!chat.is_admin) return;
		
		if (value.match(/^(add|set)\s+(.+)$/i)) {
			// add word
			var word = RegExp.$2.toLowerCase();
			if (word in this.data.words) {
				return this.doError(chat, "Word already in auto-kick list: " + word);
			}
			this.data.words[word] = 1;
			this.compile();
			this.storeData();
			this.doReply(chat, ":hammer: Word added to auto-kick list: " + word);
		}
		else if (value.match(/^(delete|remove)\s+(.+)$/i)) {
			// delete word
			var word = RegExp.$2.toLowerCase();
			if (!(word in this.data.words)) {
				return this.doError(chat, "Word not found in auto-kick list: " + word);
			}
			delete this.data.words[word];
			this.compile();
			this.storeData();
			this.doReply(chat, ":hammer: Word removed from auto-kick list: " + word);
		}
		else if (value.match(/^list/i)) {
			// list all words
			var words = Object.keys(this.data.words).sort();
			if (!words.length) this.doReply(chat, "There are currently no words in the auto-kick list.");
			else this.doReply(chat, ":hammer: The following words will get you auto-kicked: " + words.join(', '));
		}
		else {
			this.doError(chat, "Invalid !autokick command syntax.");
		}
	},
	
	said: function(chat) {
		// someone said something, look for bad words, ignore self
		var chan = chat.channel_id;
		
		if (chat.type.match(/^(standard|pose|code)$/) && !chat.is_command && (chat.username != this.api.username) && chat.text.match(this.regexp)) {
			// kick user out!
			if (this.config.kick_message) this.say( chan, this.config.kick_message );
			this.sendCommand( 'kick', { channel_id: chan, username: chat.username } );
		}
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
