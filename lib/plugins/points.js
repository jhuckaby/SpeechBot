// Simple Point System
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !award bob 50
// !deduct bob 50
// !scores

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"award": "Award a user some points, e.g. `!award bob 50`",
		"deduct": "Deduct points from a user, e.g. `!deduct bob 50`",
		"scores": "List all current user scores, e.g. `!scores`"
	},
	
	startup: function(callback) {
		// bot is starting up
		if (!this.data.scores) this.data.scores = {};
		callback();
	},
	
	cmd_award: function(value, chat) {
		// award command
		var self = this;
		if (!value) return this.doUsage(chat);
		
		if (value.match(/^(\-?\d+)\s+(\S+)/)) {
			value = RegExp.$2 + ' ' + RegExp.$1;
		}
		
		if (value.match(/^(\S+)\s+(\-?\d+)/)) {
			var name = RegExp.$1;
			var amount = parseInt( RegExp.$2 );
			if (!amount) return;
			
			var user = this.findUser( name );
			if (!user && !this.data.scores[name]) return this.doError(chat, "Unable to find user matching: " + name);
			if (!user) user = { username: name, nickname: name };
			
			var username = user.username;
			if ((amount > 0) && (username == chat.username)) {
				return this.doError(chat, "You cannot award points to yourself, cheater!");
			}
			
			if (!this.data.scores[username]) this.data.scores[username] = 0;
			this.data.scores[username] += amount;
			if (this.data.scores[username] < 0) this.data.scores[username] = 0;
			
			var new_score = this.data.scores[username];
			if (!this.data.scores[username]) delete this.data.scores[username];
			this.storeData();
			
			var msg = '';
			
			if (amount > 0) {
				msg = ":trophy: " + chat.nickname + " has awarded " + amount + " points to " + user.nickname + ".";
			}
			else {
				msg = ":no_entry: " + chat.nickname + " has deducted " + Math.abs(amount) + " points from " + user.nickname + ".";
			}
			
			msg += "  Their new score is " + new_score + " points.";
			
			this.doReply(chat, msg);
		}
		else return this.doUsage(chat);
	},
	
	cmd_deduct: function(value, chat) {
		// deduct command
		var self = this;
		if (!value) return this.doUsage(chat);
		
		if (value.match(/^(\-?\d+)\s+(\S+)/)) {
			value = RegExp.$2 + ' ' + RegExp.$1;
		}
		
		if (value.match(/^(\S+)\s+(\d+)/)) {
			var name = RegExp.$1;
			var amount = 0 - parseInt( RegExp.$2 );
			this.cmd_award( name + " " + amount, chat );
		}
		else return this.doUsage(chat);
	},
	
	cmd_scores: function(value, chat) {
		// scores command (list all scores)
		var self = this;
		var html = '';
		var scores = this.data.scores;
		var sorted_usernames = Object.keys(scores).sort( function(a, b) {
			return scores[b] - scores[a];
		});
		sorted_usernames.splice(10); // top 10 only
		
		if (!sorted_usernames.length) {
			return this.doReply(chat, "No points have been awarded yet.");
		}
		
		html += '<table class="data_table">';
		html += '<tr><th>#.</th><th>User</th><th>Points</th></tr>';
		
		sorted_usernames.forEach( function(username, idx) {
			var user = self.findUser( username );
			var user_disp = '';
			if (user) user_disp = user.full_name + " (" + user.nickname + ")";
			else user_disp = "(" + username + ")";
			
			var rank = idx + 1;
			if (rank == 1) user_disp = ":trophy: " + user_disp + "";
			
			html += '<tr>';
			html += '<td>' + rank + '.</td>';
			html += '<td>' + user_disp + '</td>';
			html += '<td>' + Tools.commify(scores[username]) + '</td>';
			html += '</tr>';
		});
		
		html += '</table>';
		
		this.doReply(chat, html, { quiet: 1 });
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
