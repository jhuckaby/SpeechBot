// Stock Market
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !stock aapl
// !coin btc

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"stock": "Get stock quote for a specific symbol, e.g. `!stock AAPL`",
		"coin": "Get price quote for a specific cryptocurrency, e.g. `!coin BTC`"
	},
	
	startup: function(callback) {
		// bot is starting up
		callback();
	},
	
	cmd_stock: function(value, chat) {
		// stock command
		var self = this;
		var sym = value.toUpperCase().replace(/\W+/g, '');
		
		if (sym.match(/^(BTC|ETH|XPR|BCH|LTC|XMR)$/)) return this.cmd_coin(value, chat);
		
		if (!this.config.api_key) {
			return this.doError(chat, "No API key found.  Please add your [IEX Cloud](https://iexcloud.io/) API key via `!config set stock/api_key YOUR_API_KEY`.");
		}
		
		var url = 'https://cloud.iexapis.com/v1/stock/' + sym + '/quote?token=' + this.config.api_key;
		
		this.logDebug(9, "Fetching stocks for " + sym + ": " + url);
		
		this.startTyping(chat);
		this.request.json( url, null, function(err, resp, data, perf) {
			self.stopTyping();
			
			if (err) {
				return self.doError(chat, "Failed to fetch stocks for: " + sym + ": " + err);
			}
			
			var msg = '';
			var change = '';
			
			if (data.change >= 0) {
				change = '+$' + data.change;
				msg += ':chart_with_upwards_trend: ';
			}
			else {
				change = '-$' + Math.abs(data.change);
				msg += ':chart_with_downwards_trend: ';
			}
			
			msg += '' + data.symbol + ' - ' + data.companyName + ": ";
			msg += '<b>$' + data.latestPrice + '</b>';
			msg += " (High: $" + data.high + ", Low: $" + data.low + ", Change: " + change + ")";
			
			self.doReply(chat, msg);
		} );
	},
	
	cmd_coin: function(value, chat) {
		// coin command (crypto currency stock prices)
		var self = this;
		var sym = value.toUpperCase().replace(/\W+/g, '');
		var url = 'https://api.coinmarketcap.com/v1/ticker/?limit=10';
		
		this.logDebug(9, "Fetching coin prices for " + sym + ": " + url);
		
		this.startTyping(chat);
		this.request.json( url, null, function(err, resp, list, perf) {
			self.stopTyping();
			
			if (!err && (!list || !list.length)) {
				err = "No coin prices in response";
			}
			if (err) {
				return self.doError(chat, "Failed to fetch coin prices for: " + sym + ": " + err);
			}
			
			var data = Tools.findObject( list, { symbol: sym } );
			if (!data) {
				err = "No data found for symbol";
				return self.doError(chat, "Failed to fetch coin prices for: " + sym + ": " + err);
			}
			
			data.change = parseFloat( data.percent_change_24h );
			data.latestPrice = self.formatPrice( data.price_usd );
			
			var msg = '';
			var change = '';
			
			if (data.change >= 0) {
				change = '+' + self.formatPrice(data.change);
				msg += ':chart_with_upwards_trend: ';
			}
			else {
				change = '-' + self.formatPrice( Math.abs(data.change) );
				msg += ':chart_with_downwards_trend: ';
			}
			
			msg += '' + sym + ' - ' + data.name + ": ";
			msg += '<b>' + data.latestPrice + '</b>';
			msg += " (Change: " + change + ")";
			
			self.doReply(chat, msg);
		} );
	},
	
	formatPrice: function(value) {
		// format price as $##.##
		return (new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })).format( parseFloat(value) );
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
