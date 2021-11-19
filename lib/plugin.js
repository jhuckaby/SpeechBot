// Plugin Base Class

var cp = require("child_process");
var assert = require("assert");
var Class = require("pixl-class");
var Tools = require("pixl-tools");

module.exports = Class.create({
	
	__name: 'Generic',
	
	bot: null,
	data: null,
	config: null,
	logger: null,
	
	__construct: function() {
		// class constructor
	},
	
	startup: function(callback) {
		// override in subclass if needed
		callback();
	},
	
	shutdown: function(callback) {
		// override in subclass if needed
		callback();
	},
	
	doReply: function(chat, msg, overrides) {
		// send reply to same channel
		assert( arguments.length >= 2, "Wrong arguments to doReply" );
		this.logDebug(9, "Sending reply: " + msg);
		var chan = chat.channel_id;
		this.api.say( chan, msg, overrides );
	},
	
	doError: function(chat, err) {
		// fire callback with error reply
		assert( arguments.length == 2, "Wrong arguments to doError" );
		this.logError('cmd', "Command Error: " + err);
		this.bot.replyError(chat, err);
	},
	
	doUsage: function(chat) {
		// print out help/usage for command
		var cmd = chat.cmd;
		
		// rewrite chat to look like user was asking for help to begin with :)
		chat.cmd = "help";
		chat.value = cmd;
		
		this.bot.cmd_help(chat);
	},
	
	storeData: function() {
		// store value in storage, then commit to disk
		this.bot.updatePluginData( this.__name, this.data );
	},
	
	say: function(chan, msg, overrides) {
		// alias
		this.api.say( chan, msg, overrides );
	},
	
	whisper: function(chan, to, msg, overrides) {
		// alias
		this.api.whisper( chan, to, msg, overrides );
	},
	
	sendCommand: function(cmd, data) {
		// alias
		this.api.sendCommand(cmd, data);
	},
	
	startTyping: function(chat) {
		// alias
		this.bot.startTyping(chat);
	},
	
	stopTyping: function() {
		// alias
		this.bot.stopTyping();
	},
	
	findUser: function(text) {
		// find user from partial username, nickname or full name match
		var username = text.replace(/\W+/g, '').toLowerCase();
		var user = this.api.users[username] || null;
		
		if (!user) {
			// try to fuzzy match on nickname, full name
			var regex = new RegExp(username);
			
			for (var id in this.api.users) {
				var friend = this.api.users[id];
				if (friend.nickname.replace(/\W+/g, '').toLowerCase().match(regex)) {
					username = id;
					user = friend;
					break;
				}
				else if (friend.full_name.replace(/\W+/g, '').toLowerCase().match(regex)) {
					username = id;
					user = friend;
					break;
				}
			}
		}
		
		return user;
	},
	
	findChannel: function(text) {
		// find channel from partial name or title match
		var chan = text.replace(/\W+/g, '').toLowerCase();
		var channel = this.api.channels[chan] || null;
		
		if (!channel) {
			// try to fuzzy match on title
			var regex = new RegExp(chan);
			
			for (var id in this.api.channels) {
				var ch = this.api.channels[id];
				if (ch.title.replace(/\W+/g, '').toLowerCase().match(regex)) {
					chan = id;
					channel = ch;
					break;
				}
			}
		}
		
		return channel;
	},
	
	requireAdmin: function(chat) {
		// require admin access to use command
		if (!chat.is_admin) {
			this.doError(chat, "You must be an administrator to use that command.");
			return false;
		}
		return true;
	},
	
	doExecReply: function(chat, cmd) {
		// execute command in shell, send output as reply
		if (!this.requireAdmin(chat)) return;
		var self = this;
		var opts = {
			timeout: 5000
		};
		var time_start = Tools.timeNow();
		
		// sanity check
		if (cmd.match(/\b(rm|kill|pkill|shutdown)\b/)) return this.bot.replyError(chat, "No.");
		
		this.startTyping(chat);
		cp.exec( cmd, opts, function(err, stdout, stderr) {
			self.stopTyping();
			
			if (err) {
				var elapsed = Tools.timeNow() - time_start;
				if (elapsed >= 5) err = "Timeout";
				return self.bot.replyError( chat, err );
			}
			
			var msg = ( stdout.trim() + "\n" + stderr.trim() ).trim();
			if (!msg.match(/\S/)) msg = "(No output)";
			self.doReply( chat, msg, { type: 'code', plain: true } );
		} );
	},
	
	getPlugin: function(name) {
		// get reference to plugin by name
		return Tools.findObject( this.bot.plugins, { __name: name } );
	},
	
	debugLevel: function(level) {
		// check if we're logging at or above the requested level
		return (this.logger.get('debugLevel') >= level);
	},
	
	logDebug: function(level, msg, data) {
		// proxy request to system logger with correct component
		this.logger.set( 'component', this.__name );
		this.logger.debug( level, msg, data );
	},
	
	logError: function(code, msg, data) {
		// proxy request to system logger with correct component
		this.logger.set( 'component', this.__name );
		this.logger.error( code, msg, data );
	},
	
	logTransaction: function(code, msg, data) {
		// proxy request to system logger with correct component
		this.logger.set( 'component', this.__name );
		this.logger.transaction( code, msg, data );
	}
	
});
