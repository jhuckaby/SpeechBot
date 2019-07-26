// Timezone / Timer / Alarm Stuff
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !time 8:00 pm to EST
// !timer 5 minutes
// !timer cancel
// !timezone PST
// !alarm set 4 PM "remember the milk!"
// !alarm list
// !alarm delete 1

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

var moment = require('moment-timezone');
require('moment-parseplus');

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"time": "Convert between timezones, e.g. `!time 8:00 pm to EST`",
		"timer": "Set a countdown timer for a specific duration, e.g. `!timer 5 minutes`",
		"timezone": "Set your preferred timezone, e.g. `!timezone PST`",
		"alarm": "Set, list and delete alarms, e.g. `!alarm set 4 PM \"remember the milk!\"`"
	},
	
	startup: function(callback) {
		// bot is starting up
		moment.tz.setDefault( this.config.default_timezone || moment.tz.guess() );
		
		var tz_names = {};
		moment.tz.names().forEach( function(name) { 
			tz_names[ name.toLowerCase() ] = name; 
		} );
		this.tz_names = tz_names;
		
		// hook tick for timer end
		this.server.on('tick', this.tick.bind(this));
		
		// init data
		if (!this.data.timezones) this.data.timezones = {};
		if (!this.data.alarms) this.data.alarms = [];
		
		callback();
	},
	
	getUserTimezone: function(username) {
		// return timezone for specified user, or default tz
		return this.data.timezones[username] || this.config.default_timezone;
	},
	
	cmd_time: function(value, chat) {
		// time command
		var self = this;
		var tz_abbrev = this.config.timezone_abbreviations || {};
		var to_tz = false;
		if (!value) value = undefined;
		
		var need_convert = false;
		if (value) {
			var tz = value.toLowerCase();
			if ((tz in tz_abbrev) || (tz in this.tz_names)) {
				// convert now to specified tz
				need_convert = true;
				to_tz = tz_abbrev[tz] || this.tz_names[tz];
				value = undefined;
			}
			else if (value.match(/\s+to\s+(.+)$/i)) {
				tz = RegExp.$1.toLowerCase();
				if ((tz in tz_abbrev) || (tz in this.tz_names)) {
					// convert specific time to tz
					need_convert = true;
					to_tz = tz_abbrev[tz] || this.tz_names[tz];
					value = value.replace(/\s+to\s+(.+)$/i, '');
					if (!value.match(/\S/)) value = undefined;
				}
			}
			
			if (value && !value.match(/\d{4}/)) {
				var dargs = Tools.getDateArgs( Tools.timeNow(true) );
				value = dargs.yyyy_mm_dd + " " + value;
			}
		} // value
		
		moment.tz.setDefault( this.data.timezones[chat.username] || this.config.default_timezone );
		var date = moment( value ? value : undefined );
		if (!date.isValid()) {
			return this.doError(chat, "Invalid date format: " + value);
		}
		
		if (need_convert) {
			date.tz( to_tz || this.config.default_timezone || moment.tz.guess() );
		}
		var fmt = date.format( this.config.format );
		var msg = ":mantelpiece_clock: " + fmt;
		
		this.doReply(chat, msg);
	},
	
	cmd_timer: function(value, chat) {
		// timer command
		var now = Tools.timeNow(true);
		
		if (value.match(/^(stop|cancel|abort|off)$/i)) {
			// stop timer
			if (!this.data.timer) return this.doError(chat, "No timer is currently active.");
			delete this.data.timer;
			this.storeData();
			this.doReply(chat, ":mantelpiece_clock: The timer has been canceled.");
		}
		else if (value) {
			// set timer
			if (value.match(/(\d+)\:(\d+)\:(\d+)/)) {
				value = RegExp.$1 + " hours " + RegExp.$2 + " minutes " + RegExp.$3 + " seconds";
			}
			else if (value.match(/(\d+)\:(\d+)/)) {
				value = RegExp.$1 + " minutes " + RegExp.$1 + " seconds";
			}
			
			var delta = Tools.getSecondsFromText(value);
			if (!value) return this.doError(chat, "Invalid timer value: " + value);
			
			var epoch = now + delta;
			
			this.data.timer = {
				channel_id: chat.channel_id,
				epoch: epoch,
				value: value
			};
			this.storeData();
			this.doReply(chat, ":mantelpiece_clock: The timer has been set for: " + value);
		}
		else {
			// check timer value
			if (!this.data.timer) return this.doReply(chat, ":mantelpiece_clock: No timer is currently active.");
			
			var remaining = Tools.getTextFromSeconds( this.data.timer.epoch - now, false, false );
			this.doReply(chat, ":mantelpiece_clock: The current timer will expire in " + remaining + ".");
		}
	},
	
	cmd_timezone: function(value, chat) {
		// timezone command
		var tz_abbrev = this.config.timezone_abbreviations || {};
		var tz = value.toLowerCase();
		var username = chat.username;
		
		if ((tz in tz_abbrev) || (tz in this.tz_names)) {
			// found specified tz
			tz = tz_abbrev[tz] || this.tz_names[tz];
			
			this.data.timezones[username] = tz;
			this.storeData();
			this.doReply(chat, ":mantelpiece_clock: Timezone set for " + chat.nickname + ": " + tz, { quiet: 1 });
		}
		else if (value) {
			this.doError(chat, "Unknown timezone: " + value);
		}
		else {
			tz = this.data.timezones[username] || this.config.default_timezone;
			this.doReply(chat, ":mantelpiece_clock: Timezone for " + chat.nickname + ": " + tz, { quiet: 1 });
		}
	},
	
	cmd_alarm: function(value, chat) {
		// alarm command
		if (!value) return this.doUsage(chat);
		
		var chan = chat.channel_id;
		var username = chat.username;
		var tz = this.data.timezones[username] || this.config.default_timezone;
		moment.tz.setDefault( tz );
		
		if (value.match(/^(set|add)\s+(.+)$/i)) {
			// add new alarm
			var alarm_when = RegExp.$2;
			var alarm_desc = '';
			if (alarm_when.match(/^(.+)\"(.+)\"$/)) {
				alarm_when = RegExp.$1.trim();
				alarm_desc = RegExp.$2.trim();
			}
			
			var date = moment( alarm_when );
			if (!date.isValid()) return this.doError(chat, "Unknown date/time for alarm: " + alarm_when);
			var epoch = parseInt(date.format('X'));
			if (epoch <= Tools.timeNow(true)) return this.doError(chat, "Cannot set an alarm in the past.");
			var fmt = date.format( this.config.format );
			
			this.data.alarms.push({
				epoch: epoch,
				channel_id: chan,
				username: chat.username,
				fmt: fmt,
				tz: tz,
				desc: alarm_desc
			});
			var num = this.data.alarms.length;
			
			this.storeData();
			this.doReply(chat, ":mantelpiece_clock: Alarm #" + num + " set for: " + fmt + (alarm_desc ? (" (" + alarm_desc + ")") : ''));
		}
		if (value.match(/^(delete|remove)\s+(\d+)$/i)) {
			// delete alarm
			var num = parseInt( RegExp.$2 );
			var idx = num - 1;
			
			if (!this.data.alarms[idx]) return this.doError(chat, "Alarm #" + num + " not found.");
			this.data.alarms.splice( idx, 1 );
			this.storeData();
			this.doReply(chat, ":mantelpiece_clock: Alarm #" + num + " deleted.");
		}
		else if (value.match(/^list$/i)) {
			// list alarms
			if (!this.data.alarms.length) return this.doReply(chat, ":mantelpiece_clock: There are no alarms currently set.");
			var msg = '';
			var num = 1;
			
			this.data.alarms.forEach( function(alarm) {
				msg += '<p>:mantelpiece_clock: **Alarm #' + num + ':** ';
				msg += alarm.fmt;
				if (alarm.desc) msg += " (" + alarm.desc + ")";
				msg += '</p>';
				num++;
			} );
			
			this.doReply(chat, msg);
		}
	},
	
	tick: function() {
		// check for expired timers / alarms
		var self = this;
		var now = Tools.timeNow(true);
		
		if (this.data.timer && (now >= this.data.timer.epoch)) {
			this.say( this.data.timer.channel_id, ":alarm_clock: The timer has expired: " + this.data.timer.value );
			delete this.data.timer;
			this.storeData();
		}
		if (this.data.alarms.length) {
			var need_save = false;
			var keep_alarms = [];
			
			this.data.alarms.forEach( function(alarm) {
				if (now >= alarm.epoch) {
					var msg = '';
					msg += '<p>:alarm_clock: **Alarm!** ';
					msg += alarm.fmt;
					if (alarm.desc) msg += " (" + alarm.desc + ")";
					msg += '</p>';
					self.say( alarm.channel_id, msg );
					need_save = true;
				}
				else keep_alarms.push(alarm);
			} );
			
			if (need_save) {
				this.data.alarms = keep_alarms;
				this.storeData();
			}
		}
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
