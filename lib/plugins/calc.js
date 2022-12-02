// Calculator and Unit Converter
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !calc 2 + 2
// !convert 12.7 cm to in

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;
const math = require('mathjs');

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"calc": "Evaluate a mathematical expression and print the result, e.g. `!calc 2 + 2`",
		"convert": "Convert a measurement between two units, e.g. `!convert 12.7 cm to in`"
	},
	
	startup: function(callback) {
		// bot is starting up
		callback();
	},
	
	cmd_calc: function(value, chat) {
		// calc command
		var self = this;
		if (!value) return this.doUsage(chat);
		
		var result = false;
		try { result = math.eval(value); }
		catch (err) {
			return this.doError(chat, err.message);
		}
		
		var msg = value + " = " + result;
		self.say( chat.channel_id, msg, { type: 'code', plain: true } );
	},
	
	cmd_convert: function(value, chat) {
		// convert
		var self = this;
		if (!value || !value.match(/\s+to\s+/)) return this.doUsage(chat);
		
		// mathjs uses `degC` and `degF`, because `C` and `F` are used for electrical units coulomb (C) and farad (F)
		// we don't care about electricity, so using regexp to allow C / F to work, as its the much more common use case
		value = value.replace(/\bC\b/i, 'degC').replace(/\bF\b/i, 'degF');
		
		var result = false;
		try { result = math.eval(value); }
		catch (err) {
			return this.doError(chat, err.message);
		}
		
		// replace degF and degC in resulr too
		result = '' + result;
		result = result.replace(/\bdegC\b/, 'C').replace(/\bdegF\b/, 'F');
		
		var msg = value.replace(/\s+to\s+.+$/i, '') + " = " + result;
		self.say( chat.channel_id, msg, { type: 'code', plain: true } );
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
