// Upload URL
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !upload http://myserver.com/some/image.jpg
// !qr https://google.com/

var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;
var QRCode = require('qrcode');

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"upload": "Upload any URL and host it locally, e.g. `!upload http://myserver.com/some/image.jpg`",
		"qr": "Convert any URL to a QR code and display it, e.g. `!qr https://google.com/`"
	},
	
	startup: function(callback) {
		// bot is starting up
		callback();
	},
	
	cmd_upload: function(value, chat) {
		// upload command
		if (value.match(/^(https?\:\/\/\S+)$/i)) {
			// special upload + store locally
			var url = RegExp.$1;
			this.uploadReply( url, chat );
		}
		else return this.doUsage(chat);
	},
	
	uploadReply: function(url, chat) {
		// upload URL and reply with local URL
		var self = this;
		var settings = this.bot.config.get('connection');
		this.logDebug(9, "Downloading URL: " + url);
		
		this.startTyping(chat);
		this.request.get( url, function(err, resp, data, perf) {
			if (err) {
				self.stopTyping();
				return self.doError(chat, "Failed to fetch URL: " + err);
			}
			
			var name = '';
			var ext = '';
			
			if (url.match(/([^\/]+)\.(\w+)($|\?)/)) {
				name = RegExp.$1.replace(/[^\w\-\.]+/g, '_');
				ext = RegExp.$2;
			}
			else {
				// give up
				self.stopTyping();
				return self.doError(chat, "Could not determine URL content type");
			}
			
			var filename = name + '.' + ext;
			
			// now upload blob to SpeechBubble API
			var api_url = settings.ssl ? 'https://' : 'http://';
			api_url += settings.hostname + ':' + settings.port;
			api_url += '/api/app/upload_file' + Tools.composeQueryString({
				session_id: self.api.session_id,
				webcam: name,
				ext: ext
			});
			
			self.logDebug(9, "Uploading file to SpeechBubble: " + api_url, { size: data.length });
			
			var opts = {
				data: {},
				files: {
					file1: [ data, filename ]
				}
			};
			
			self.request.post( api_url, opts, function(err, resp, data, perf) {
				// file upload complete
				self.stopTyping();
				
				if (err) {
					return self.doError(chat, "Failed to upload file: " + err);
				}
				self.logDebug(9, "Got API response: " + data);
				
				var json = null;
				try { json = JSON.parse( data.toString() ); }
				catch (err) {
					return self.doError(chat, "Failed to upload file: " + err);
				}
				
				if (json.code) {
					return self.doError(chat, "Failed to upload file: " + json.description);
				}
				
				// success
				self.doReply(chat, ":floppy_disk: URL successfully uploaded: " + json.url);
				
			}); // request.post
		}); // request.get
	},
	
	cmd_qr: function(value, chat) {
		// convert any string (i.e. URL) to a QR code, upload and post it
		var self = this;
		var settings = this.bot.config.get('connection');
		if (!value.length) return this.doUsage(chat);
		this.logDebug(9, "Encoding text in QR code: " + value);
		
		this.startTyping(chat);
		QRCode.toDataURL( value, { width: 400 }, function (err, data_url) {
			if (err) return self.doError(chat, "Failed to generate QR code: " + err);
			
			// extract raw base64 data from Data URI
			var data = Buffer.from( data_url.replace(/^data\:image\/\w+\;base64\,/, ''), 'base64' );
			var name = 'qrcode';
			var ext = 'png';
			var filename = name + '.' + ext;
			
			// now upload blob to SpeechBubble API
			var api_url = settings.ssl ? 'https://' : 'http://';
			api_url += settings.hostname + ':' + settings.port;
			api_url += '/api/app/upload_file' + Tools.composeQueryString({
				session_id: self.api.session_id,
				webcam: name,
				ext: ext
			});
			
			self.logDebug(9, "Uploading QR image to SpeechBubble: " + api_url, { size: data.length });
			
			var opts = {
				data: {},
				files: {
					file1: [ data, filename ]
				}
			};
			
			self.request.post( api_url, opts, function(err, resp, data, perf) {
				// file upload complete
				self.stopTyping();
				
				if (err) {
					return self.doError(chat, "Failed to upload file: " + err);
				}
				self.logDebug(9, "Got API response: " + data);
				
				var json = null;
				try { json = JSON.parse( data.toString() ); }
				catch (err) {
					return self.doError(chat, "Failed to upload file: " + err);
				}
				
				if (json.code) {
					return self.doError(chat, "Failed to upload file: " + json.description);
				}
				
				// success
				self.doReply(chat, ":calling: " + json.url);
				
			}); // request.post
		}); // QRCode
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
