// Simple emote responses
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// /me hugs Bot

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {},
	
	startup: function(callback) {
		// bot is starting up
		
		// listen for ALL chat traffic, so we can scan for trigger words
		this.api.on('said', this.said.bind(this));
		
		// keep track of what people said (for repeats)
		this.lastSaid = {};
		
		callback();
	},
	
	said: function(chat) {
		// someone said something, look for trigger words, ignore self
		var self = this;
		var chan = chat.channel_id;
		
		if (!this.sadden) {
			// pre-compile regexps
			var user = this.api.user;
			var names = [ this.api.username, user.nickname, user.full_name ];
			this.sadden = new RegExp( "^(slaps|punches|hits|smacks|shoots|kills)\\s+(" + names.join('|') + ")", "i" );
			this.gladden = new RegExp( "^(hugs|kisses|embraces|applauds|blesses|thanks)\\s+(" + names.join('|') + ")", "i" );
		}
		
		// respond to slaps, hugs, etc.
		if (chat.type.match(/^(pose)$/) && !chat.is_command && (chat.username != this.api.username)) {
			if (chat.text.match(this.sadden)) {
				// you make bot sad
				var emote = Tools.randArray([ 'expressionless', 'persevere', 'disappointed_relieved', 'open_mouth', 'hushed', 'tired_face', 'unamused', 'confused', 'astonished', 'white_frowning_face', 'slightly_frowning_face', 'confounded', 'disappointed', 'triumph', 'cry', 'rage', 'face_with_symbols_on_mouth' ]);
				
				setTimeout( function() {
					self.doReply(chat, ':' + emote + ':');
				}, 500 );
			}
			else if (chat.text.match(this.gladden)) {
				// you make bot happy
				var emote = Tools.randArray([ 'grinning', 'grin', 'smiley', 'smile', 'heart_eyes', 'kissing_heart', 'kissing', 'kissing_smiling_eyes', 'kissing_closed_eyes', 'relaxed', 'slightly_smiling_face', 'hugging_face', 'relieved', 'drooling_face' ]);
				
				setTimeout( function() {
					self.doReply(chat, ':' + emote + ':');
				}, 500 );
			}
		}
		
		// if two people say the same exact thing within 5 seconds, bot repeats it
		if (chat.type.match(/^(standard)$/) && !chat.is_command && (chat.username != this.api.username) && chat.content) {
			if (this.lastSaid[chan]) {
				var last = this.lastSaid[chan];
				this.lastSaid[chan] = chat;
				
				if ((last.username != chat.username) && (chat.date - last.date <= 5) && (chat.content.length < 80) && (chat.content.trim() == last.content.trim())) {
					setTimeout( function() {
						self.doReply(chat, chat.content);
					}, 500 );
					this.lastSaid[chan] = null;
				}
			}
			else {
				this.lastSaid[chan] = chat;
			}
		}
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
