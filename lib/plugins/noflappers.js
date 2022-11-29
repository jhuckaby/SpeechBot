// No Flappers!
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !noflappers set COUNT

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"noflappers": "set, get, say max flap count per hour, e.g. `!noflappers set MAXIMUM`, `!noflappers [get]`, `!noflappers say [EXCLAMATION]`"
	},
	
	startup: function(callback) {
		// bot is starting up
		this.channels = {};

		// listen for joins, so we can count the number of flaps
		this.api.on('joined', this.joined.bind(this));
		// listen for ALL chat traffic, so we can scan for live people and reset the join count
		this.api.on('said', this.said.bind(this));

		if (!this.data.count) this.data.count = 0;
		if (!this.data.lookBackSeconds) this.data.lookBackSeconds = 3600;

		callback();
	},

	cmd_noflappers: function(value, chat) {
		// set/get noflappers count
		// admin only!
		if (!chat.is_admin) return;
		
		if (value.match(/^(set)\s+(.+)$/i)) {
			// set count
			let maxFlaps = parseInt(RegExp.$2);
			if (isNaN(maxFlaps)) {
				return this.doError(chat, `Invalid Flapper maximum, expected Int, got [${value}]`);
			} else if (maxFlaps === 1) {
				return this.doError(chat, `Invalid Flapper maximum, I am NOT setting the max join count to 1!`);
			} else {
				this.data.count = maxFlaps;
				this.storeData();
				this.doReply(chat, `:hammer: Flapper maximum set to auto-kick after: ${this.data.count}`);
			}
		}
		else if (!value || value.match(/^get/i)) {
			this.doReply(chat, `:hammer: Flapper maximum set to auto-kick after: ${this.data.count}`);
		}
		else if (value.match(/^(say)\s*(.*)$/i)) {
			let kick_message = RegExp.$2;
			this.data.kick_message = kick_message;
			this.storeData();
			this.doReply(chat, `:hammer: Kick message set to: ${kick_message}`);
		}
		else {
			this.doError(chat, "Invalid !noflappers command syntax.");
		}
	},

	_getFlaps: function(channel, username) {
		if (!this.channels[channel]) this.channels[channel] = {};
		if (!this.channels[channel][username]) this.channels[channel][username] = [];
		// remove "old" records
		this.channels[channel][username] = this.channels[channel][username].filter(d=>Date.now()-d<this.data.lookBackSeconds);
		return this.channels[channel][username];
	},

	joined: function(data) {
		// someone has joined the channel, so increment join count
		// if join count exceeds max, then wtf, kick them!
		let username = data.user.username;
		let chan = data.channel_id;

		let flaps = this._getFlaps(chan, username);
		flaps.push(Date.now());

		if (this.data.count > 0 && flaps.length > this.data.count && (username !== this.api.username)) {
			// kick user out!
			if (this.data.kick_message) this.say( chan, this.data.kick_message );
			this.sendCommand( 'kick', { channel_id: chan, username: username } );
			flaps.length = 0;
		}
	},

	said: function(chat) {
		// someone said something, zero their flap count
		this._getFlaps(chat.channel_id, chat.username).length = 0;
	},

	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
