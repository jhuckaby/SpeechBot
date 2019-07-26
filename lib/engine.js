// SpeechBot Server Component
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

var fs = require("fs");
var cp = require("child_process");
var Path = require('path');
var Class = require("pixl-class");
var Component = require("pixl-server/component");
var Tools = require("pixl-tools");
var Request = require("pixl-request");
var SpeechBotAPI = require('speechbot-api');

var async = Tools.async;
var mkdirp = Tools.mkdirp;
var glob = Tools.glob;

module.exports = Class.create({
	
	__name: 'SpeechBot',
	__parent: Component,
	
	pluginDir: 'lib/plugins',
	pluginConfigDir: 'conf/plugins',
	pluginDataDir: 'data/plugins',
	
	pluginList: null,
	pluginConfig: null,
	pluginData: null,
	plugins: null,
	commandHelp: null,
	
	startup: function(callback) {
		// start app api service
		var self = this;
		this.logDebug(3, "SpeechBot engine starting up" );
		
		// ref to web server
		this.web = this.server.WebServer;
		
		// setup data
		this.pluginList = [];
		this.pluginConfig = {};
		this.pluginData = {};
		this.commandHelp = this.config.get('command_help') || {};
		
		// request client for plugins to use
		this.request = new Request( "SpeechBot v" + this.server.__version );
		this.request.setTimeout( 5000 );
		this.request.setKeepAlive( true );
		this.request.setAutoError( true );
		
		// tick tock
		this.server.on('tick', this.tick.bind(this));
		
		// archive logs daily at midnight
		this.server.on('day', function() {
			self.archiveLogs();
		} );
		
		// load initial plugin list, config and data
		async.series(
			[
				this.connect.bind(this),
				this.getPluginList.bind(this),
				this.loadAllPluginConfigs.bind(this),
				this.loadAllPluginData.bind(this),
				this.loadAllPlugins.bind(this)
			],
			callback
		);
	},
	
	connect: function(callback) {
		// connect to server
		var self = this;
		var cmd_activator = this.config.get('activation_character');
		var settings = this.config.get('connection');
		
		this.logDebug(4, "Connecting to SpeechBubble", Tools.copyHashRemoveKeys( settings, { password: 1 } ) );
		
		this.api = new SpeechBotAPI( settings );
		this.api.on('connecting', function() {
			self.logDebug(3, "Reconnecting");
		});
		this.api.on('connect', function() {
			self.logDebug(3, "Successfully connected to server.");
		});
		this.api.on('error', function(err) {
			self.logError('api', "API Error: " + err);
		});
		this.api.on('close', function(code, msg) {
			self.logDebug(3, "Server connection closed: " + code + ": " + (msg || "(No message)"));
		});
		
		this.api.on('login', function() {
			self.logDebug(3, "Successfully authenticated.");
		});
		
		this.api.on('said', function(chat) {
			// someone said something, look for bot commands
			if ((chat.type == 'standard') && !chat.replace && chat.text.match(/^(\W)(\w+)(.*)$/)) {
				var cmd_prefix = RegExp.$1;
				var cmd = RegExp.$2.toLowerCase();
				var value = RegExp.$3.trim();
				
				if (cmd_prefix != cmd_activator) return; // wrong activation character
				
				chat.is_command = true;
				chat.cmd = cmd;
				chat.value = value;
				
				self.logDebug(9, "Processing bot command: " + cmd + " " + value, chat);
				
				var func = 'cmd_' + cmd;
				if (func in self) {
					// handle cmd locally in parent process
					self[func](chat);
				}
				else {
					// proxy cmd to plugin
					self.delegateCommand( chat );
				} // delegate
			} // bot cmd
		});
		
		callback();
	},
	
	getPluginList: function(callback) {
		// get list of plugins
		var self = this;
		
		glob( Path.join(this.pluginDir, '*.js'), function(err, files) {
			if (files && files.length) {
				self.pluginList = files.map( function(file) {
					return Path.basename(file).replace(/\.\w+$/, '');
				});
			}
			self.logDebug(4, "Got Plugin List:", self.pluginList);
			callback();
		}); // glob
	},
	
	loadAllPluginConfigs: function(callback) {
		// load all plugin config files, if found
		var self = this;
		
		async.eachSeries( this.pluginList,
			function(plugin_name, callback) {
				// file is totally optional, default to empty hash
				self.pluginConfig[plugin_name] = {};
				
				// try to load (non-fatal if missing)
				var file = Path.join( self.pluginConfigDir, plugin_name + '.json' );
				fs.readFile( file, 'utf8', function(err, text) {
					if (text) {
						var json = null;
						try { json = JSON.parse(text); }
						catch (err) {
							self.logError('plugin', "Failed to load Plugin Configuration: " + file + ": " + err);
						}
						if (json) {
							self.pluginConfig[plugin_name] = json;
							self.logDebug(10, "Loaded Plugin Configuration: " + file, json);
							
							// import command help
							if (json.help) Tools.mergeHashInto(self.commandHelp, json.help);
						}
					}
					callback();
				} ); // fs.readFile
			},
			callback
		);
	},
	
	loadAllPluginData: function(callback) {
		// load all plugin data files, if found
		var self = this;
		
		async.eachSeries( this.pluginList,
			function(plugin_name, callback) {
				self.pluginData[plugin_name] = {};
				var file = Path.join( self.pluginDataDir, plugin_name + '.json' );
				
				fs.readFile( file, 'utf8', function(err, text) {
					if (text) {
						var json = null;
						try { json = JSON.parse(text); }
						catch (err) {
							self.logError('data', "Failed to load Plugin data: " + file + ": " + err);
						}
						if (json) {
							self.pluginData[plugin_name] = json;
							self.logDebug(10, "Loaded Plugin Data: " + file, json);
						}
					}
					callback();
				} ); // fs.readFile
			},
			callback
		);
	},
	
	loadAllPlugins: function(callback) {
		// load plugins
		var self = this;
		this.plugins = [];
		
		async.eachSeries( this.pluginList,
			async.ensureAsync( function(plugin_name, callback) {
				self.logDebug(3, "Loading Plugin: " + plugin_name);
				
				var pluginClass = require( './plugins/' + plugin_name + '.js' );
				var plugin = new pluginClass();
				
				if (!self.pluginConfig[plugin_name]) self.pluginConfig[plugin_name] = {};
				if (!self.pluginData[plugin_name]) self.pluginData[plugin_name] = {};
				
				plugin.__name = plugin_name;
				plugin.config = self.pluginConfig[plugin_name];
				plugin.data = self.pluginData[plugin_name];
				plugin.bot = self;
				plugin.api = self.api;
				plugin.server = self.server;
				plugin.logger = self.logger;
				plugin.request = self.request;
				plugin.web = self.web;
				
				self.plugins.push(plugin);
				plugin.startup( callback );
				
				// import command help
				if (plugin.help) Tools.mergeHashInto(self.commandHelp, plugin.help);
			} ),
			function() {
				self.logDebug(2, "All Plugins loaded");
				callback();
			}
		); // eachSeries
	},
	
	delegateCommand: function(chat) {
		// delegate command to plugin
		var self = this;
		var cmd = chat.cmd;
		var value = chat.value;
		
		// first check for plugins that have explicit named command method
		var func = 'cmd_' + cmd;
		var handled = false;
		this.plugins.forEach( function(plugin) {
			if (func in plugin) {
				self.logDebug(9, "Delegating command: " + cmd + " " + value + " to plugin: " + plugin.__name);
				plugin[func](value, chat);
				handled = true;
			}
		});
		
		// also see if any plugins register a wildcard handler
		if (!handled) {
			func = 'firehose';
			this.plugins.forEach( function(plugin) {
				if (func in plugin) {
					self.logDebug(9, "Firehosing command: " + cmd + " " + value + " to plugin: " + plugin.__name);
					plugin[func](cmd, value, chat);
				}
			});
		}
	},
	
	replyError: function(chat, err) {
		// send formatted error reply
		var chan = chat.channel_id;
		this.api.say( chan, ":warning: <b>Error:</b> " + err );
		this.logError('cmd', "Command Error: " + err);
	},
	
	requireAdmin: function(chat) {
		// require admin access to use command
		if (!chat.is_admin) {
			this.replyError(chat, "You must be an administrator to use that command.");
			return false;
		}
		return true;
	},
	
	cmd_test: function(chat) {
		// make sure bot is working
		this.api.say( chat.channel_id, "Hello." );
	},
	
	cmd_help: function(chat) {
		// get help for command
		var cmd = chat.value.toLowerCase();
		var cmd_activator = this.config.get('activation_character');
		var chan = chat.channel_id;
		
		if (cmd in this.commandHelp) {
			// help for specific command
			this.api.say(chan, ":scroll: Help: **" + cmd_activator + cmd + "**: " + this.commandHelp[cmd]);
		}
		else if (cmd) {
			// find nearest command (typo?)
			var closest_dist = 99999;
			var closest_cmd = '';
			
			for (var key in this.commandHelp) {
				var dist = this.levenshtein( cmd, key );
				if (dist < closest_dist) {
					closest_dist = dist;
					closest_cmd = key;
				}
			}
			
			this.api.say(chan, ":scroll: The command " + cmd_activator + cmd + " was not found.  Did you mean `" + cmd_activator + closest_cmd + "`?");
		}
		else {
			// list all commands
			var commands = Object.keys(this.commandHelp).sort();
			this.api.say(chan, ":scroll: Command List: " + commands.map( function(cmd) { return '`' + cmd_activator + cmd + '`'; } ).join(', '));
		}
	},
	
	cmd_config: function(chat) {
		// The !config command:
		// !config set PLUGIN/PATH VALUE
		// !config set weather/api_key 3289473298743894
		var self = this;
		if (!this.requireAdmin(chat)) return;
		
		if (chat.value.match(/^set\s+(\S+)\s+(.+)$/i)) {
			var path = RegExp.$1;
			var value = RegExp.$2;
			
			path = path.replace(/^\//, '').replace(/\/$/, '');
			var old_value = Tools.getPath(this.pluginConfig, path);
			var type = typeof(old_value);
			
			if (type !== 'undefined') {
				switch (type) {
					case 'string': value = value.toString(); break;
					case 'number': value = parseFloat(value); break;
					case 'boolean': value = value.toString().match(/^(false|0)$/i) ? false : true; break;
					case 'object': value = JSON.parse(value); break;
				}
				Tools.setPath(this.pluginConfig, path, value);
				
				// save back to disk
				var plugin_name = path.split(/\//).shift();
				var file = Path.join( this.pluginConfigDir, plugin_name + '.json' );
				fs.writeFile( file, JSON.stringify(this.pluginConfig[plugin_name], null, "\t"), function(err) {
					if (err) {
						return self.replyError(chat, "Failed to write config file: " + file + ": " + err);
					}
					
					// and we're done
					self.api.say( chat.channel_id, ':gear: **Config Key Saved:** <code>' + path + ': ' + JSON.stringify(value) + '</code>' );
					
				}); // fs.writeFile
			}
			else {
				this.replyError(chat, "Configuration path not found: `" + path + "`");
			}
		}
		else if (chat.value.match(/^get\s+(\S+)$/i)) {
			var path = RegExp.$1;
			path = path.replace(/^\//, '').replace(/\/$/, '');
			var value = Tools.getPath(this.pluginConfig, path);
			var type = typeof(value);
			
			if (type !== 'undefined') {
				this.api.say( chat.channel_id, ':gear: **Config Key:** <code>' + path + ': ' + JSON.stringify(value) + '</code>' );
			}
			else {
				this.replyError(chat, "Configuration path not found: `" + path + '`');
			}
		}
		else {
			this.replyError(chat, "Configuration syntax invalid.");
		}
	},
	
	cmd_join: function(chat) {
		// tell the bot to join a channel
		if (!this.requireAdmin(chat)) return;
		if (chat.value) this.api.join( chat.value.replace(/^\#/, '') );
	},
	
	cmd_leave: function(chat) {
		// tell the bot to leave a channel (default to current)
		if (!this.requireAdmin(chat)) return;
		var chan = chat.value.replace(/^\#/, '') || chat.channel_id;
		this.api.leave(chan);
	},
	
	cmd_say: function(chat) {
		// puppet mode
		if (!this.requireAdmin(chat)) return;
		var what = chat.value;
		var chan = chat.channel_id;
		if (what.match(/^\#(\w+)\s*/)) {
			chan = RegExp.$1;
			what = what.replace(/^\#(\w+)\s*/, '');
		}
		this.api.say( chan, what );
	},
	
	cmd_pose: function(chat) {
		// puppet pose
		if (!this.requireAdmin(chat)) return;
		var what = chat.value;
		var chan = chat.channel_id;
		if (what.match(/^\#(\w+)\s*/)) {
			chan = RegExp.$1;
			what = what.replace(/^\#(\w+)\s*/, '');
		}
		this.api.pose( chan, what );
	},
	
	cmd_exec: function(chat) {
		// execute command in shell
		if (!this.requireAdmin(chat)) return;
		var self = this;
		var cmd = chat.value;
		var chan = chat.channel_id;
		var opts = {
			timeout: 5000
		};
		var time_start = Tools.timeNow();
		
		// sanity check
		if (cmd.match(/\b(rm|kill|pkill|shutdown)\b/)) return this.replyError(chat, "No.");
		
		this.startTyping(chat);
		cp.exec( cmd, opts, function(err, stdout, stderr) {
			self.stopTyping();
			
			if (err) {
				var elapsed = Tools.timeNow() - time_start;
				if (elapsed >= 5) err = "Timeout";
				return self.replyError( chat, err );
			}
			
			var msg = ( stdout.trim() + "\n" + stderr.trim() ).trim();
			if (!msg.match(/\S/)) msg = "(No output)";
			self.api.say( chan, msg, { type: 'code', plain: true } );
		} );
	},
	
	cmd_restart: function(chat) {
		// restart the bot
		if (!this.requireAdmin(chat)) return;
		if (this.server.debug) {
			this.logDebug(5, "Skipping restart command, as we're in debug mode.");
			return;
		}
		
		this.logDebug(1, "Restarting server: " + (chat.value || 'Unknown reason'));
		
		// issue a restart command by shelling out to our control script in a detached child
		child = cp.spawn( "bin/control.sh", ["restart"], { 
			detached: true,
			stdio: ['ignore', 'ignore', 'ignore'] 
		} );
		child.unref();
	},
	
	cmd_shutdown: function(chat) {
		// shutdown the bot
		if (!this.requireAdmin(chat)) return;
		if (this.server.debug) {
			this.logDebug(5, "Skipping shutdown command, as we're in debug mode.");
			return;
		}
		
		this.logDebug(1, "Shutting down server: " + (chat.value || 'Unknown reason'));
		
		// issue shutdown command
		this.server.shutdown();
	},
	
	// levenshtein distance algorithm, pulled from Andrei Mackenzie's MIT licensed.
	// gist, which can be found here: https://gist.github.com/andrei-m/982927
	// Compute the edit distance between the two given strings
	levenshtein: function (a, b) {
		if (a.length === 0) return b.length;
		if (b.length === 0) return a.length;
		
		var matrix = [];
		
		// increment along the first column of each row
		var i;
		for (i = 0; i <= b.length; i++) {
			matrix[i] = [i];
		}
		
		// increment each column in the first row
		var j;
		for (j = 0; j <= a.length; j++) {
			matrix[0][j] = j;
		}
		
		// Fill in the rest of the matrix
		for (i = 1; i <= b.length; i++) {
			for (j = 1; j <= a.length; j++) {
				if (b.charAt(i - 1) === a.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} 
				else {
					matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
						Math.min(matrix[i][j - 1] + 1, // insertion
						matrix[i - 1][j] + 1)); // deletion
				}
			}
		}
		
		return matrix[b.length][a.length];
	},
	
	startTyping: function(chat) {
		// start sending pings to server that we're "typing" (working)
		var self = this;
		
		if (!this.typing) {
			this.typing = true;
			this.typingTimer = setInterval( function() {
				self.api.sendCommand( 'typing', { channel_id: chat.channel_id } );
			}, 500 );
		}
	},
	
	stopTyping: function() {
		// stop typing timer
		if (this.typing) {
			delete this.typing;
			clearTimeout( this.typingTimer );
			delete this.typingTimer;
		}
	},
	
	updatePluginData: function(plugin_name, plugin_data) {
		// update plugin data, save to disk
		var self = this;
		this.logDebug(9, "Saving Plugin data for: " + plugin_name);
		this.pluginData[plugin_name] = plugin_data;
		
		var file = Path.join( this.pluginDataDir, plugin_name + '.json' );
		fs.writeFile( file, JSON.stringify(plugin_data), function(err) {
			if (err) {
				self.logError('fs', "Failed to write plugin data file: " + file + ": " + err);
			}
			else {
				self.logDebug(9, "Plugin data saved successfully");
			}
		} ); // fs.writeFile
	},
	
	tick: function() {
		// called every second
		var self = this;
		var now = Tools.timeNow(true);
	},
	
	archiveLogs: function() {
		// archive all logs (called once daily)
		var self = this;
		var src_spec = this.server.config.get('log_dir') + '/*.log';
		var dest_path = this.server.config.get('log_archive_path');
		
		if (dest_path) {
			this.logDebug(4, "Archiving logs: " + src_spec + " to: " + dest_path);
			// generate time label from previous day, so just subtracting 30 minutes to be safe
			var epoch = Tools.timeNow(true) - 1800;
			
			this.logger.archive(src_spec, dest_path, epoch, function(err) {
				if (err) self.logError('maint', "Failed to archive logs: " + err);
				else self.logDebug(4, "Log archival complete");
			});
		}
	},
	
	shutdown: function(callback) {
		// shutdown sequence
		var self = this;
		this.shut = true;
		this.logDebug(2, "Shutting down SpeechBot");
		
		async.eachSeries( this.plugins,
			async.ensureAsync( function(plugin, callback) {
				self.logDebug(3, "Shutting down plugin: " + plugin.__name);
				plugin.shutdown( callback );
			} ),
			function() {
				self.api.disconnect();
				self.logDebug(1, "Shutdown complete");
				callback();
			}
		); // eachSeries
	}
	
});
