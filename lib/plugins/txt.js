// Simple TXT Sending System using SMS Email Gateways
// SpeechBot Plugin
// Copyright (c) 2022 Joseph Huckaby
// Released under the MIT License

// !txt set joe 6505445288@txt.att.net
// !txt joe Hello

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;
var Mailer = require("pixl-mail");

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"txt": "Send text to user, e.g. `!txt bob Hey, we need you in chat!`"
	},
	
	startup: function(callback) {
		// bot is starting up
		if (!this.data.users) this.data.users = {};
		callback();
	},
	
	cmd_txt: function(value, chat) {
		// send text, or configure number
		var self = this;
		if (!value) return this.doUsage(chat);
		
		if (!this.config.smtp) {
			return this.doError(chat, "No SMTP server found.  Please add your server via `!config set txt/smtp localhost`.");
		}
		if (!this.config.from) {
			return this.doError(chat, "No email From address found.  Please add the server's from email via `!config set txt/from bot@myserver.com`.");
		}
		
		if (value.match(/^(set|add)\s+(\w+)\s+(\S+)$/)) {
			// set user's email
			var name = RegExp.$2;
			var email = RegExp.$3;
			
			var user = this.findUser( name );
			if (!user) return this.doError(chat, "Unable to find user matching: " + name);
			var username = user.username;
			
			this.data.users[username] = email;
			this.storeData();
			this.doReply(chat, "SMS email successfully stored for " + (user.full_name || user.nickname) + ": " + email);
		}
		else if (value.match(/^(delete|remove|del|rem|stop)\s+(\w+)$/)) {
			// delete user's email
			var name = RegExp.$2;
			
			var user = this.findUser( name );
			if (!user) return this.doError(chat, "Unable to find user matching: " + name);
			var username = user.username;
			
			if (!this.data.users[username]) return this.doError(chat, "No SMS email on file for: " + (user.full_name || user.nickname));
			
			delete this.data.users[username];
			this.storeData();
			this.doReply(chat, "SMS email removed for " + (user.full_name || user.nickname) + ".");
		}
		else if (value.match(/^(get)\s+(\w+)$/)) {
			// lookup address
			var name = RegExp.$2;
			
			var user = this.findUser( name );
			if (!user) return this.doError(chat, "Unable to find user matching: " + name);
			var username = user.username;
			
			if (!this.data.users[username]) return this.doError(chat, "No SMS email on file for: " + (user.full_name || user.nickname));
			var email = this.data.users[username];
			
			this.doReply(chat, "The SMS email address we have for " + (user.full_name || user.nickname) + " is: " + email);
		}
		else if (value.match(/^(\w+)\s+(.+)$/)) {
			// send SMS
			var name = RegExp.$1;
			var msg = RegExp.$2;
			var sender = (chat.full_name || chat.nickname);
			
			var user = this.findUser( name );
			if (!user) return this.doError(chat, "Unable to find user matching: " + name);
			var username = user.username;
			
			if (!this.data.users[username]) return this.doError(chat, "No SMS email on file for: " + (user.full_name || user.nickname));
			var email = this.data.users[username];
			
			this.logDebug(9, "Sending SMS via email gateway: " + email);
			this.startTyping(chat);
			
			var mailer = new Mailer( this.config.smtp );
			
			var message = 
				"To: " + email + "\n" + 
				"From: " + this.config.from + "\n" + 
				"Subject: Chat from " + sender + "\n" +
				"\n" +  
				sender + ": " + msg + "\n";
			
			mailer.send( message, function(err) {
				self.stopTyping();
				if (err) return self.doError("Email Error: " + err);
				self.doReply(chat, ":calling: Text message successfully sent to " + (user.full_name || user.nickname) + " at " + email + ".");
			} );
		}
		else return this.doUsage(chat);
	},
	
	cmd_text: function(value, chat) { return this.cmd_txt(value, chat); },
	cmd_sms: function(value, chat) { return this.cmd_txt(value, chat); }
	
});
