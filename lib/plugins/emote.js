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
		
		// keep track of clever conversations
		this.conversations = {};
		
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
			
			// trigger a single clever response when our name is mentioned
			this.single_trigger = new RegExp( "\\b(" + names.join('|') + ")\\b", "i" );
			
			// start a clever converation if our name is mentioned at the very start
			this.convo_trigger = new RegExp( "^(" + names.join('|') + ")\\s+(.+)$", "i" );
			
			// stop words
			this.stop_trigger = /^(stop|shut\s+up|quiet|off|hush|cancel|cease|abort|no|quit|silence|mute|shh+|enough|disable)$/i;
		}
		
		// if two people say the same exact thing within 5 seconds, bot repeats it
		if (chat.type.match(/^(standard|pose)$/) && !chat.is_command && (chat.username != this.api.username) && chat.content) {
			if (this.lastSaid[chan]) {
				var last = this.lastSaid[chan];
				this.lastSaid[chan] = chat;
				
				if ((last.username != chat.username) && (chat.date - last.date <= 5) && (chat.content.length < 80) && (chat.content.trim() == last.content.trim()) && (chat.type == last.type)) {
					setTimeout( function() {
						var overrides = {
							type: chat.type
						};
						if (chat.pose) overrides.pose = chat.pose;
						
						self.doReply(chat, chat.content, overrides);
					}, 500 );
					this.lastSaid[chan] = null;
					return;
				}
			}
			else {
				this.lastSaid[chan] = chat;
			}
			
			// optional clever responses
			if (this.config.api_key && chat.type.match(/^(standard|pose)$/)) {
				return this.clever(chat);
			}
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
	},
	
	clever: function(chat) {
		// use cleverbot API for some responses
		var self = this;
		var keep_convo = false;
		var opts = {
			key: this.config.api_key
		};
		
		// check for bot name at start
		if (chat.text.match(this.convo_trigger)) {
			var text = RegExp.$2;
			if (text.match(this.stop_trigger)) {
				delete this.conversations[ chat.username ];
				return;
			}
			else {
				// start or continue conversation
				opts.input = text;
				keep_convo = true;
			}
		}
		else if (chat.text.match(this.single_trigger)) {
			// single query
			var text = chat.text.replace(this.single_trigger, 'you');
			if (chat.type == 'pose') {
				opts.input = chat.nickname + ' ' + text;
				keep_convo = true;
			}
			else {
				opts.input = text;
				keep_convo = true;
			}
		}
		else if (this.conversations[chat.username]) {
			opts.input = chat.text;
			keep_convo = true;
			
			if (chat.text.match(this.stop_trigger)) {
				delete this.conversations[ chat.username ];
				return;
			}
		}
		
		if (!opts.input) return;
		
		if (this.conversations[chat.username]) {
			opts.cs = this.conversations[chat.username];
		}
		var url = 'https://www.cleverbot.com/getreply' + Tools.composeQueryString(opts);
		
		this.logDebug(9, "Requesting Cleverbot API: " + url);
		
		this.startTyping(chat);
		this.request.json( url, null, function(err, resp, data, perf) {
			self.stopTyping();
			
			self.logDebug(9, "Cleverbot Response", data);
			
			if (err) {
				return self.logError('clever', "Cleverbot API Failure: " + url + ": " + err);
			}
			if (!data || !data.output) {
				return;
			}
			
			if (data.cs && keep_convo) {
				// keep the conversation going, track per user
				self.conversations[chat.username] = data.cs;
			}
			
			var overrides = {};
			if (data.output.match(/^\*(.+)\*\.?$/)) {
				data.output = RegExp.$1;
				overrides.type = 'pose';
			}
			
			self.doReply(chat, data.output, overrides);
		}); // request.json
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
