// Mobile App Stuff
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !mobile

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

var QRCode = require('qrcode');

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"mobile": "Generate personal QR code to install mobile app, e.g. `!mobile`"
	},
	
	startup: function(callback) {
		// bot is starting up
		callback();
	},
	
	cmd_mobile: function(value, chat) {
		// mobile command
		var self = this;
		
		if (!this.config.api_key) {
			return this.doError(chat, "No API key found.  Please add your SpeechBubble Mobile API key via `!config set mobile/api_key YOUR_API_KEY`.");
		}
		
		var settings = this.bot.config.get('connection');
		var chan = chat.channel_id;
		var nick = chat.nickname;
		var auth = this.config.api_key;
		var host = this.api.server_config.base_app_url.replace(/^\w+\:\/\/([\w\-\.]+).*$/, '$1');
		var rand = Math.random();
		
		var app_url = this.api.server_config.base_app_url + this.config.base_uri + 
			Tools.composeQueryString({ auth, chan, nick, host, rand });
		
		QRCode.toDataURL( app_url, { width: 400 }, function (err, data_url) {
			if (err) return self.doError(chat, "Failed to generate QR code: " + err);
			
			var msg = 'Open the camera app on your mobile device, and scan this code:<br/>';
			msg += '<img src="' + data_url + '" class="click_to_hide" style="margin-top:5px;">';
			
			self.logDebug(9, "Sending whisper to " + chat.username + ": " + msg);
			self.whisper( chan, chat.username, msg );
		}); // QRCode
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
