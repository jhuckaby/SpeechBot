// Misc Stuff
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !ping google.com

var Path = require('path');
var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"8ball": "Ask the magic 8-ball a question, e.g. `!8ball Should I upgrade my computer?`",
		"roll": "Roll one or more dice D&D style, e.g. `!roll 1d20+3`",
		"pick": "Pick a random user from the current channel, e.g. `!pick`"
	},
	
	startup: function(callback) {
		// bot is starting up
		callback();
	},
	
	cmd_ping: function(value, chat) {
		// ping command
		if (!value.match(/^[\w\-\.\:]+$/)) return this.doError(chat, "Invalid IP or hostname to ping.");
		this.doExecReply( chat, "ping -c 1 " + value );
	},
	
	cmd_host: function(value, chat) {
		// host command
		if (!value.match(/^[\w\-\.]+$/)) return this.doError(chat, "Invalid hostname to lookup.");
		this.doExecReply( chat, "host " + value );
	},
	
	cmd_dig: function(value, chat) {
		// dig command
		if (!value.match(/^[\w\-\.]+$/)) return this.doError(chat, "Invalid hostname to dig.");
		this.doExecReply( chat, "dig " + value );
	},
	
	cmd_wget: function(value, chat) {
		// wget command
		if (!value.match(/^https?\:\/\/\S+$/i)) return this.doError(chat, "Invalid URL to fetch.");
		var url = value.replace(/[\"\\]+/g, '');
		this.doExecReply( chat, 'curl -v -t 3 -o /dev/null "' + url + '"' );
	},
	
	cmd_sleep: function(value, chat) {
		// simulate typing for specified number of seconds
		var self = this;
		var sec = parseInt(value) || 5;
		
		this.startTyping(chat);
		setTimeout( function() {
			self.stopTyping();
			self.doReply(chat, "Slept for " + value + " seconds.");
		}, sec * 1000);
	},
	
	cmd_8ball: function(value, chat) {
		// 8ball command
		this.doReply(chat, ":8ball: " + chat.nickname + ": " + Tools.randArray([
			"It is certain",
			"It is decidedly so",
			"Without a doubt",
			"Yes - definitely",
			"You may rely on it",
			"As I see it, yes",
			"Most likely",
			"Outlook good",
			"Signs point to yes",
			"Yes",
			"Reply hazy, try again",
			"Ask again later",
			"Better not tell you now",
			"Cannot predict now",
			"Concentrate and ask again",
			"Don't count on it",
			"My reply is no",
			"My sources say no",
			"Outlook not so good",
			"Very doubtful",
		]), { quiet: 1 });
	},
	
	cmd_roll: function(msg, chat) {
		// roll dice
		var nick = chat.nickname;
		var value = 0;
		var orig_msg = '' + msg;
		var actions = [];
		if (!msg) return this.doUsage(chat);
		
		// 1d6, 3d20, etc.
		var re = /(\d+)d(\d+)/;
		while (msg.match(re)) {
			var num = RegExp.$1;
			var sides = RegExp.$2;
			num = parseInt(num);
			sides = parseInt(sides);
			for (var idx = 1; idx <= num; idx++) {
				var result = Math.floor( Math.random() * sides ) + 1;
				actions.push( "[" + result + "]" );
				value += result;
			}
			msg = msg.replace(re, '');
		}
		
		// static addition, e.g. +3
		re = /\+\s*(\d+)/;
		while (msg.match(re)) {
			var num = RegExp.$1;
			num = parseInt(num);
			actions.push( "+" + num );
			value += num;
			msg = msg.replace(re, '');
		}
		
		// static subtraction, e.g. -3
		re = /\-\s*(\d+)/;
		while (msg.match(re)) {
			var num = RegExp.$1;
			num = parseInt(num);
			actions.push( "-" + num );
			value -= num;
			msg = msg.replace(re, '');
		}
		
		if (!actions.length) return this.doError(chat, "Invalid format for dice roll.  Try `!roll 1d6`");
		
		// this.doReply( chat, nick + ": " + orig_msg + " = " + actions.join(' ') + " = " + value, { quiet: 1 } );
		this.doReply( chat, ":game_die: " + orig_msg + " = " + actions.join(' ') + " = " + value, {} );
	},
	
	cmd_pick: function(value, chat) {
		// pick command
		var chan = chat.channel_id;
		var channel = this.api.channels[chan] || {};
		var user_list = Object.keys(channel.live_users || {}).filter( function(username) {
			return (username != chat.username) && !username.match(/bot$/i);
		} );
		if (!user_list.length) return this.doError(chat, "There are no users to pick from.");
		var chosen = Tools.randArray(user_list);
		var user = this.findUser(chosen);
		
		return this.doReply(chat, ":dart: The chosen one is: **" + user.full_name + "** (" + user.nickname + ")");
	},
	
	cmd_chaos: function(value, chat) {
		// flood channel with sound-emojis
		var self = this;
		var chunk_size = 8;
		var delay = 500;
		
		if (this.chaosTimer) {
			clearTimeout( this.chaosTimer );
			delete this.chaosTimer;
		}
		
		if (value.match(/(\d+)\s+(\d+)/)) {
			chunk_size = parseInt( RegExp.$1 );
			delay = parseInt( RegExp.$2 );
		}
		else if (value.match(/(\d+)/)) {
			chunk_size = parseInt( RegExp.$1 );
		}
		else if (value.match(/(stop|cancel|abort)/)) {
			return;
		}
		
		var shuffle = function shuffle(a) {
		    for (let i = a.length - 1; i > 0; i--) {
		        const j = Math.floor(Math.random() * (i + 1));
		        [a[i], a[j]] = [a[j], a[i]];
		    }
		    return a;
		};
		
		var emojis = [];
		Tools.glob.sync('/opt/speechbubble/htdocs/sounds/emoji/*.mp3').forEach( function(file) {
			var emoji = Path.basename(file).replace(/\.mp3$/, '');
			emojis.push( ':' + emoji + ':' );
		} );
		var shuffled_emojis = shuffle(emojis);
		
		this.chaosTimer = setInterval( function() {
			var chunk = shuffled_emojis.splice(0, chunk_size);
			self.doReply(chat, chunk.join(' '));
			
			if (!shuffled_emojis.length || value.match(/single/)) {
				clearTimeout( self.chaosTimer );
				delete self.chaosTimer;
			}
		}, delay );
	},
	
	cmd_mc: function(value, chat) {
		var self = this;
		
		this.request.json( 'http://mc.speech.im/list.php', false, function(err, resp, data, perf) {
			// { "code": 0, "players": ["jhuckaby"] }
			if (err) {
				return self.doReply(chat, ":hammer_and_pick: Sorry, could not fetch Minecraft server data right now: " + err);
			}
			if (data.players.length == 1) {
				self.doReply(chat, ":hammer_and_pick: There is currently one player online: **" + data.players[0] + "**");
			}
			else if (data.players.length) {
				self.doReply(chat, ":hammer_and_pick: There are currently " + data.players.length + " players online: **" + data.players.join('**, **') + "**");
			}
			else {
				self.doReply(chat, ":hammer_and_pick: There are no players currently online.");
			}
		});
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
