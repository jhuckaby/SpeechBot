// Insult Stuff
// SpeechBot Plugin
// Borrowed and modified from http://search.cpan.org/dist/Acme-Scurvy-Whoreson-BilgeRat-Backend-insultserver/
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !insult bob

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"insult": "Generates a random insult and directs it at something or someone, e.g. `!insult Bob`"
	},
	
	startup: function(callback) {
		// bot is starting up
		this.intros = this.config.Intros.trim().split(/\,\s*/);
		this.adjectives = this.config.Adjectives.trim().split(/\s+/).map( function(item) { return item.replace(/\|/g, ' '); } );
		this.amounts = this.config.Amounts.trim().split(/\s+/).map( function(item) { return item.replace(/\|/g, ' '); } );
		this.nouns = this.config.PluralThings.trim().split(/\s+/).map( function(item) { return item.replace(/\|/g, ' '); } );
		this.things = this.config.SingleThings.trim().split(/\s+/).map( function(item) { return item.replace(/\|/g, ' '); } );
		callback();
	},
	
	cmd_insult: function(value, chat) {
		// insult command
		if (!value) value = chat.nickname;
		var msg = '';
		var type = this.probably(0.5);
		
		if (type) {
			// type 1, singular insult
			var num_adjs = Math.floor( Math.random() * 3 ) + 1;
			var num_things = Math.floor( Math.random() * 2 ) + 1;
			
			// generate unique adjectives
			var adjs_hash = {};
			while (Tools.numKeys(adjs_hash) < num_adjs) {
				var adj = Tools.randArray( this.adjectives );
				adjs_hash[adj] = 1;
			}
			var adjs = this.shuffle( Object.keys(adjs_hash) );
			
			// generate unique nouns (things)
			var things_hash = {};
			while (Tools.numKeys(things_hash) < num_things) {
				var thing = Tools.randArray( this.things );
				things_hash[thing] = 1;
			}
			var things = this.shuffle( Object.keys(things_hash) );
			
			// compile insult sentence
			var intro = Tools.randArray( this.intros );
			msg = value + ' ' + intro;
			if (adjs[0].match(/^[aeiou]/)) { msg += 'n'; }
			
			msg += ' ' + adjs.join(', ') + ' ' + things.join(' ') + '!';
		}
		else {
			// type 2, plural insult
			var adj1 = Tools.randArray( this.adjectives );
			var adj2 = Tools.randArray( this.adjectives );
			while (adj2 == adj1) { adj2 = Tools.randArray( this.adjectives ); }
			
			// choose random parts
			var intro = Tools.randArray( this.intros );
			var amount = Tools.randArray( this.amounts );
			var noun = Tools.randArray( this.nouns );
			
			// compile insult sentence
			msg = value + ' ' + intro;
			if (adj1.match(/^[aeiou]/)) { msg += 'n'; }
			
			msg += " " + adj1 + " " + amount + " of " + adj2 + " " + noun + "!";
		}
		
		this.doReply(chat, ":poo: " + msg);
	},
	
	probably: function(amount) {
		// probability
		return !!(Math.random() < amount);
	},
	
	shuffle: function(arr) {
		// shuffle array
		return arr.sort( function() { return Math.random() - 0.5; } );
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
