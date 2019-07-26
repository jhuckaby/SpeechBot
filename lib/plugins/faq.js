// FAQ System (Custom Commands)
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !faq myserver Welcome to my server!  Please read the rules at http://myserver.com/rules/
// !myserver
// !faq list
// !faq search serv
// !faq delete myserver

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;
var ImageSize = require('image-size');

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"faq": "Register a custom FAQ command which can be recalled at any time, e.g. `!faq myserver Welcome!`"
	},
	
	startup: function(callback) {
		// bot is starting up
		
		// init data if not already
		if (!this.data.faqs) this.data.faqs = {};
		
		callback();
	},
	
	cmd_faq: function(value, chat) {
		// faq command
		if (value.match(/^upload\s+(\w+)\s+(https?\:\/\/\S+)$/i)) {
			// special upload + store locally + add FAQ to local URL
			var faq = RegExp.$1.toLowerCase();
			var url = RegExp.$2;
			
			// don't allow replacement of built-in commands
			if (faq in this.bot.commandHelp) {
				return this.doError(chat, "Cannot replace built-in command: " + faq);
			}
			
			this.uploadAdd( faq, url, chat );
		}
		else if (value.match(/^(delete|remove)\s+(.+)$/i)) {
			// delete faq
			var faq = RegExp.$2.toLowerCase();
			if (!(faq in this.data.faqs)) {
				return this.doError(chat, "FAQ not found in list: " + faq);
			}
			delete this.data.faqs[faq];
			this.storeData();
			this.doReply(chat, ":label: FAQ removed from list: " + faq);
		}
		else if (value.match(/^search\s+(.+)$/i)) {
			// search for faqs by partial name
			var term = RegExp.$1.toLowerCase();
			var term_re = new RegExp(term);
			
			var faqs = Object.keys(this.data.faqs).filter( function(faq) {
				return !!faq.match(term_re);
			} );
			
			if (!faqs.length) this.doReply(chat, ":label: No FAQs match your search query: " + term);
			else this.doReply(chat, ":label: The following FAQ commands matched your search: " + faqs.join(', '));
		}
		else if (value.match(/^list/i)) {
			// list all faqs
			var faqs = Object.keys(this.data.faqs).sort();
			if (!faqs.length) this.doReply(chat, ":label: There are currently no FAQs registered.");
			else this.doReply(chat, ":label: The following FAQ commands are registered: " + faqs.join(', '));
		}
		else if (value.match(/^(\w+)\s+(.+)$/)) {
			// add new faq
			var faq = RegExp.$1.toLowerCase();
			var text = RegExp.$2;
			
			// don't allow replacement of built-in commands
			if (faq in this.bot.commandHelp) {
				return this.doError(chat, "Cannot replace built-in command: " + faq);
			}
			
			this.data.faqs[faq] = text;
			this.storeData();
			this.doReply(chat, ":label: FAQ command added to list: " + faq);
		}
		else if (value.match(/^(\w+)$/)) {
			// alias for firehose
			if (value in this.data.faqs) {
				this.doReply(chat, this.data.faqs[value]);
			}
			else {
				// this.doError(chat, "No FAQ found by that name: " + value);
				this.cmd_faq( "search " + value, chat );
			}
		}
	},
	
	firehose: function(cmd, value, chat) {
		// called for EVERY bot command, see if it matches a FAQ
		if (cmd == 'faq') return;
		
		if (cmd in this.data.faqs) {
			this.doReply(chat, this.data.faqs[cmd]);
		}
		else {
			var closest_dist = 99999;
			var closest_cmd = '';
			
			for (var key in this.data.faqs) {
				var dist = this.bot.levenshtein( cmd, key );
				if (dist < closest_dist) {
					closest_dist = dist;
					closest_cmd = key;
				}
			}
			
			if (closest_dist < 6) {
				this.doReply(chat, ":label: The FAQ command `" + cmd + "` was not found.  Did you mean `" + closest_cmd + "`?");
			}
		}
	},
	
	uploadAdd: function(faq, url, chat) {
		// upload URL and add as FAQ
		var self = this;
		var settings = this.bot.config.get('connection');
		this.logDebug(9, "Downloading URL: " + url, { faq: faq });
		
		this.startTyping(chat);
		this.request.get( url, function(err, resp, data, perf) {
			if (err) {
				self.stopTyping();
				return self.doError(chat, "Failed to fetch URL: " + err);
			}
			
			var ext = 'jpg';
			if (url.match(/\.(\w+)($|\?)/)) {
				ext = RegExp.$1;
			}
			else if (resp.headers['content-type'] && resp.headers['content-type'].match(/(image|video)\/(\w+)/)) {
				ext = RegExp.$3.replace(/jpeg/, 'jpg');
			}
			else {
				// try to guess file type from content (assuming image)
				var info = null;
				try { info = ImageSize(data); } catch (e) {;}
				if (info && info.type) ext = info.type;
			}
			var filename = faq + '.' + ext;
			
			// now upload blob to SpeechBubble API
			var api_url = settings.ssl ? 'https://' : 'http://';
			api_url += settings.hostname + ':' + settings.port;
			api_url += '/api/app/upload_file' + Tools.composeQueryString({
				session_id: self.api.session_id,
				webcam: faq,
				ext: ext
			});
			
			self.logDebug(9, "Uploading file to SpeechBubble: " + api_url, { size: data.length });
			
			var opts = {
				data: {},
				files: {
					file1: [ data, filename ]
				}
			};
			
			self.request.post( api_url, opts, function(err, resp, data, perf) {
				// file upload complete
				self.stopTyping();
				
				if (err) {
					return self.doError(chat, "Failed to upload file: " + err);
				}
				self.logDebug(9, "Got API response: " + data);
				
				var json = null;
				try { json = JSON.parse( data.toString() ); }
				catch (err) {
					return self.doError(chat, "Failed to upload file: " + err);
				}
				
				if (json.code) {
					return self.doError(chat, "Failed to upload file: " + json.description);
				}
				
				// success
				self.data.faqs[faq] = json.url;
				self.storeData();
				self.doReply(chat, ":label: FAQ locally hosted and added to list: " + faq);
				
			}); // request.post
		}); // request.get
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
