// Simple TXT Sending System using Twilio
// SpeechBot Plugin
// Copyright (c) 2019 Joseph Huckaby
// Released under the MIT License

// !txt set joe 6505445288
// !txt joe Hello

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"txt": "Send text to user, e.g. `!txt bob Hey, we need you in chat!`"
	},
	
	startup: function(callback) {
		// bot is starting up
		if (!this.data.users) this.data.users = {};
		
		// accept incoming requests from the twilio web hook system
		this.web.addURIHandler( /^\/bot\/txt/, 'Twilio', this.receiveWebRequest.bind(this) );
		
		callback();
	},
	
	cmd_txt: function(value, chat) {
		// send text, or configure number
		var self = this;
		if (!value) return this.doUsage(chat);
		
		if (!this.config.sid) {
			return this.doError(chat, "No TXT SID found.  Please add your [Twilio](https://www.twilio.com/) account SID via `!config set txt/sid YOUR_SID_HERE`.");
		}
		if (!this.config.auth) {
			return this.doError(chat, "No TXT Auth Token found.  Please add your [Twilio](https://www.twilio.com/) Auth Token via `!config set txt/auth YOUR_TOKEN_HERE`.");
		}
		if (!this.config.from) {
			return this.doError(chat, "No TXT From number found.  Please add your [Twilio](https://www.twilio.com/) phone number via `!config set txt/from +YOUR_NUMBER_HERE`.");
		}
		if (!this.config.chan) {
			return this.doError(chat, "No TXT Channel found.  Please add your desired channel for incoming texts via `!config set txt/chan CHANNEL_ID_HERE`.");
		}
		
		if (value.match(/^(set|add)\s+(\w+)\s+(\+?\d+)$/)) {
			// set user's number
			var name = RegExp.$2;
			var num = RegExp.$3;
			if (!num.match(/^\+/)) num = "+1" + num; // default to US numbers
			
			var user = this.findUser( name );
			if (!user) return this.doError(chat, "Unable to find user matching: " + name);
			var username = user.username;
			
			this.data.users[username] = num;
			this.storeData();
			this.doReply(chat, "Phone number successfully stored for " + (user.full_name || user.nickname) + ": " + num);
		}
		else if (value.match(/^(delete|remove|del|rem|stop)\s+(\w+)$/)) {
			// delete user's number
			var name = RegExp.$2;
			
			var user = this.findUser( name );
			if (!user) return this.doError(chat, "Unable to find user matching: " + name);
			var username = user.username;
			
			if (!this.data.users[username]) return this.doError(chat, "No number on file for: " + (user.full_name || user.nickname));
			
			delete this.data.users[username];
			this.storeData();
			this.doReply(chat, "Phone number removed for " + (user.full_name || user.nickname) + ".");
		}
		else if (value.match(/^(get)\s+(\w+)$/)) {
			// send SMS
			var name = RegExp.$2;
			
			var user = this.findUser( name );
			if (!user) return this.doError(chat, "Unable to find user matching: " + name);
			var username = user.username;
			
			if (!this.data.users[username]) return this.doError(chat, "No number on file for: " + (user.full_name || user.nickname));
			var num = this.data.users[username];
			
			this.doReply(chat, "The phone number we have for " + (user.full_name || user.nickname) + " is: " + num);
		}
		else if (value.match(/^(\w+)\s+(.+)$/)) {
			// send SMS
			var name = RegExp.$1;
			var msg = RegExp.$2;
			
			var user = this.findUser( name );
			if (!user) return this.doError(chat, "Unable to find user matching: " + name);
			var username = user.username;
			
			if (!this.data.users[username]) return this.doError(chat, "No number on file for: " + (user.full_name || user.nickname));
			var num = this.data.users[username];
			
			var url = 'https://api.twilio.com/2010-04-01/Accounts/' + this.config.sid + '/Messages.json';
			var opts = {
				data: {
					Body: '' + (chat.full_name || chat.nickname) + ": " + msg,
					From: this.config.from,
					To: num
				},
				auth: this.config.sid + ':' + this.config.auth
			};
			
			this.logDebug(9, "Sending SMS via Twilio: " + url, opts);
			this.startTyping(chat);
			
			this.request.post( url, opts, function(err, resp, data, perf) {
				self.stopTyping();
				if (err) return self.doError("Error from Twilio API: " + err);
				
				self.logDebug(9, "Raw Twilio API Response: " + data);
				
				var json = null;
				try { json = JSON.parse( ''+data ); }
				catch (err) {
					return self.doError("Error from Twilio API: " + err);
				}
				if (json.error_code) {
					return self.doError("Error from Twilio API: " + json.error_code + ": " + json.error_message);
				}
				
				self.doReply(chat, ":calling: Text message successfully sent to " + (user.full_name || user.nickname) + " at " + num + ".");
			}); // request
		}
		else return this.doUsage(chat);
	},
	
	cmd_text: function(value, chat) { return this.cmd_txt(value, chat); },
	cmd_sms: function(value, chat) { return this.cmd_txt(value, chat); },
	
	receiveWebRequest: function(args, callback) {
		// receive SMS from Twilio, emit to chat
		this.logDebug(9, "Received web request from Twilio: " + args.request.url, args.params);
		
		var params = args.params;
		if (!params.From) {
			this.logError('twilio', "No 'From' property specified in response", params);
			return callback( "500 Internal Server Error", { 'Content-Type': "text/plain" }, "Error: No 'From' property specified in response." );
		}
		if (!params.Body) {
			this.logError('twilio', "No 'Body' property specified in response", params);
			return callback( "500 Internal Server Error", { 'Content-Type': "text/plain" }, "Error: No 'Body' property specified in response." );
		}
		
		var num = params.From;
		var found_username = '';
		for (var username in this.data.users) {
			if (num == this.data.users[username]) {
				found_username = username;
				break;
			}
		}
		if (!username) {
			this.logError('twilio', "Username not found for number: " + num);
			return callback({ code: 0 });
		}
		
		var user = this.findUser( found_username );
		if (!user) {
			this.logError('twilio', "Username not known: " + found_username);
			return callback({ code: 0 });
		}
		
		this.say( this.config.chan, ":iphone: **Text from " + (user.full_name || user.nickname) + ":** " + params.Body );
		callback({ code: 0 });
	}
	
});
