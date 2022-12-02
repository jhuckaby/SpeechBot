// Auto-Responder
// SpeechBot Plugin
// Copyright (c) 2020 Joseph Huckaby
// Released under the MIT License

// !autobot add wingz Did you dry rub them?
// !autobot add agile !chaos
// !autobot add slapme /me :right-facing_fist: slaps [nickname]

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"autobot": "Add, remove or list autoresponders, e.g. `!autobot add agile !chaos`"
	},
	
	startup: function(callback) {
		// bot is starting up
		
		// listen for ALL chat traffic, so we can scan for matching words
		this.api.on('said', this.said.bind(this));
		
		// init data if not already
		if (!this.data.words) this.data.words = {};
		
		callback();
	},
	
	cmd_autobot: function(value, chat) {
		// add/delete/list autoresponders
		// admin only!
		var self = this;
		if (!chat.is_admin) return;
		
		if (value.match(/^(add|set)\s+\"([^\"]+)\"\s+(.+)$/i)) {
			// add phrase
			var word = RegExp.$2.toLowerCase();
			this.data.words[word] = RegExp.$3;
			this.storeData();
			this.doReply(chat, ":robot_face: Word added to auto-responders: " + word);
		}
		else if (value.match(/^(add|set)\s+(\S+)\s+(.+)$/i)) {
			// add word or regexp
			var word = RegExp.$2.toLowerCase();
			this.data.words[word] = RegExp.$3;
			this.storeData();
			this.doReply(chat, ":robot_face: Word added to auto-responders: " + word);
		}
		else if (value.match(/^(delete|remove)\s+(.+)$/i)) {
			// delete word
			var word = RegExp.$2.toLowerCase();
			if (!(word in this.data.words)) {
				return this.doError(chat, ":robot_face: Word not found in auto-responders: " + word);
			}
			delete this.data.words[word];
			this.storeData();
			this.doReply(chat, ":robot_face: Word removed from auto-responders: " + word);
		}
		else if (value.match(/^list/i)) {
			// list all words
			var words = Object.keys(this.data.words).sort();
			if (!words.length) this.doReply(chat, ":robot_face: There are currently no words in the auto-responder list.");
			else {
				var html = '';
				html += '<table class="data_table">';
				html += '<tr><th>Word Match</th><th>Response</th></tr>';
				
				words.forEach( function(word, idx) {
					var response = self.data.words[word];
					
					html += '<tr>';
					html += '<td>`' + word + '`</td>';
					html += '<td>' + response + '</td>';
					html += '</tr>';
				});
				
				html += '</table>';
				
				this.doReply(chat, html, { quiet: 1 });
			}
		}
		else {
			this.doError(chat, "Invalid !autobot command syntax.");
		}
	},
	
	said: function(chat) {
		// someone said something, look for bad words, ignore self
		var self = this;
		var chan = chat.channel_id;
		
		if (!chat.type.match(/^(standard|pose)$/) || chat.is_command || (chat.username == this.api.username)) {
			return;
		}
		
		Object.keys(this.data.words).forEach( function(word) {
			var response = self.data.words[word];
			
			if (word.match(/^\w+$/)) word = "\\b" + word + "\\b";
			var result = false;
			try { result = chat.text.toLowerCase().match(word); } catch(e) {;}
			if (!result) return;
			
			self.logDebug(9, "Matched autobot trigger: " + word + " (Sending: " + response + ")");
			
			// matches!
			var opts = {};
			
			// common aliases
			if (response.match(/^\/(slap|smack)s?\s+/)) {
				response = response.replace(/^\/(slap|smack)s?\s+/, '');
				response = '/me :raised_back_of_hand: slaps ' + response;
			}
			if (response.match(/^\/(punch|punches)\s+/)) {
				response = response.replace(/^\/(punch|punches)\s+/, '');
				response = '/me :right-facing_fist: punches ' + response;
			}
			if (response.match(/^\/(cut|cuts)\s+/)) {
				response = response.replace(/^\/(cut|cuts)\s+/, '');
				response = '/me :knife: cuts ' + response;
			}
			
			if (response.match(/^\/me\s+/)) {
				opts.type = 'pose';
				response = response.replace(/^\/me\s+/, '');
				
				if (response.match(/^\:([\w\-]+)\:\s*/)) {
					var emoji = RegExp.$1;
					opts.pose = emoji;
					response = response.replace(/^\:([\w\-]+)\:\s*/, '');
				}
			}
			
			// placeholder sub
			response = Tools.sub( response, chat, false );
			
			self.say( chan, response, opts );
		}); // foreach word
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
