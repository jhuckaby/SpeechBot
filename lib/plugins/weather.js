// Weather Reports and Monitoring via Dark Sky
// SpeechBot Plugin
// Copyright (c) 2018 Joseph Huckaby
// Released under the MIT License

// !weather LAT, LONG
// !weather forget
// !weather alerts on
// !weather alerts off
// !weather
// !forecast

var fs = require('fs');
var readline = require('readline');
var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;
var moment = require('moment-timezone');

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"weather": "Specify your weather location geo coordinates, e.g. `!weather LAT, LONG`, then type `!weather` or `!forecast`",
		"forecast": "After registering your location with `!weather LAT, LONG`, use this command to get a 5-day forecast, e.g. `!forecast`"
	},
	
	startup: function(callback) {
		// bot is starting up
		if (!this.data.users) this.data.users = {};
		
		// register hour handler for alerts
		this.server.on('hour', this.monitor.bind(this));
		
		callback();
	},
	
	cmd_weather: function(value, chat) {
		// weather command
		var self = this;
		var username = chat.username;
		var nickname = chat.nickname;
		
		if (!this.config.api_key) {
			return this.doError(chat, "No API key found.  Please add your [Dark Sky](https://darksky.net/dev/) API key via `!config set weather/api_key YOUR_API_KEY`.");
		}
		
		if (value.match(/^(\-?[\d\.]+)\,\s*(\-?[\d\.]+)$/)) {
			// user has given us their coords, save them
			var lat = RegExp.$1;
			var lon = RegExp.$2;
			
			if (!this.data.users[username]) this.data.users[username] = {};
			this.data.users[username].latitude = parseFloat( lat );
			this.data.users[username].longitude = parseFloat( lon );
			
			this.storeData();
			this.doReply(chat, ":earth_americas: Your geo location has been saved, " + nickname + ".  You can now get weather reports via `!weather`, and forecasts via `!forecast`.", { quiet: 1 });
		}
		else if (value.match(/^forget$/i)) {
			// right to be forgotten :)
			if (!this.data.users[username]) return this.doError(chat, "We have no location on file for you, " + nickname + ".", { quiet: 1 });
			delete his.data.users[username];
			this.storeData();
			this.doReply(chat, ":earth_americas: Your geo location has been deleted, " + nickname + ".", { quiet: 1 });
		}
		else if (value.match(/^alerts\s+on$/i)) {
			// enable monitoring
			this.data.enabled = chat.channel_id;
			this.storeData();
			this.doReply(chat, ":zap: Weather alert monitoring enabled (will emit to this channel).");
			
			setTimeout( function() {
				self.monitor();
			}, 1000 );
		}
		else if (value.match(/^alerts\s+off$/i)) {
			// disable monitoring
			this.data.enabled = false;
			this.storeData();
			this.doReply(chat, ":zap: Weather alert monitoring disabled.");
		}
		else if (value.match(/\S/)) {
			// try to guess coords based on ZIP or city/state
			this.guessUserLocation(value, chat, function(err, data) {
				if (err) return self.doError(chat, err.message || err);
				var link = 'speech://!weather+' + data.latitude + ',' + data.longitude;
				
				self.displayWeather( {
					latitude: data.latitude,
					longitude: data.longitude,
					who: data.city_state,
					append: '<p>**[Click Here](' + link + ')** to set this as your default weather location.</p>'
				}, chat );
			});
		}
		else if (!this.data.users[username]) {
			// no data for user yet
			this.doReply(chat, ":earth_americas: We have no location on file for you, " + nickname + ".  Please specify a US ZIP code or city and state, and a link will be provided to save your location.", { quiet: 1 });
			// this.doReply(chat, ":earth_americas: We have no location on file for you, " + nickname + ".  Please type `/location` to get your local geo coordinates, then copy & paste those onto the `!weather` command (use a private channel to protect your location).", { quiet: 1 });
		}
		else {
			// show current weather conditions for user
			var coords = this.data.users[username];
			this.displayWeather( {
				latitude: coords.latitude, 
				longitude: coords.longitude,
				who: nickname
			}, chat );
		}
	},
	
	cmd_forecast: function(value, chat) {
		// forecast command
		var self = this;
		var username = chat.username;
		var nickname = chat.nickname;
		
		if (!this.config.api_key || !this.data.users[username]) {
			// cmd_weather handles the error replies for these cases
			return this.cmd_weather(value, chat);
		}
		
		// possibly switch over to hourly mode
		if (value.match(/\bhourly\b/i)) {
			return this.forecast_hourly(value.replace(/\bhourly\b/i, '').trim(), chat);
		}
		else if (value.match(/\S/)) {
			// get weather forecast for arbitrary location
			// try to guess coords based on ZIP or city/state
			this.guessUserLocation(value, chat, function(err, data) {
				if (err) return this.doError(chat, err.message || err);
				
				self.displayDailyForecast( {
					latitude: data.latitude,
					longitude: data.longitude,
					who: data.city_state
				}, chat );
			});
		}
		else {
			// get weather forecast for user
			var coords = this.data.users[username];
			
			this.displayDailyForecast({
				latitude: coords.latitude, 
				longitude: coords.longitude,
				who: nickname
			}, chat);
		}
	},
	
	forecast_hourly: function(value, chat) {
		// forecast hourly command
		var self = this;
		var username = chat.username;
		var nickname = chat.nickname;
		
		if (!this.config.api_key || !this.data.users[username]) {
			// cmd_weather handles the error replies for these cases
			return this.cmd_weather(value, chat);
		}
		
		if (value.match(/\S/)) {
			// get hourly forecast for arbitrary location
			// try to guess coords based on ZIP or city/state
			this.guessUserLocation(value, chat, function(err, data) {
				if (err) return this.doError(chat, err.message || err);
				
				self.displayHourlyForecast( {
					latitude: data.latitude,
					longitude: data.longitude,
					who: data.city_state
				}, chat );
			});
		}
		else {
			// get hourly forecast for user
			var coords = this.data.users[username];
			
			this.displayHourlyForecast({
				latitude: coords.latitude, 
				longitude: coords.longitude,
				who: nickname
			}, chat);
		}
	},
	
	monitor: function() {
		// monitor Dark Sky for new alerts for all registered users who are also in channel
		var self = this;
		this.logDebug(9, "In monitor()");
		
		if (!this.data.enabled) {
			this.logDebug(9, "this.data.enabled is false, returning");
			return;
		}
		if (!Tools.numKeys(this.data.users)) {
			this.logDebug(9, "No keys in this.data.users, returning");
			return;
		}
		
		var chan = this.data.enabled;
		var channel = this.api.channels[chan];
		
		if (!channel) this.logDebug(9, "Channel not found: " + chan);
		if (!channel.live_users) this.logDebug(9, "Channel has no live users key: " + chan);
		if (!Tools.numKeys(channel.live_users)) this.logDebug(9, "Channel has no live users count: " + chan);
		
		if (!channel || !channel.live_users || !Tools.numKeys(channel.live_users)) return;
		
		var dirty = false;
		var active_users = [];
		for (var username in channel.live_users) {
			if (this.data.users[username]) active_users.push(username);
		}
		
		if (!active_users.length) {
			this.logDebug(9, "No registered weather users in channel " + chan + ", skipping alert check");
			return;
		}
		
		this.logDebug(9, "Checking weather alerts for " + active_users.length + " users", active_users);
		
		async.eachSeries( active_users,
			function(username, callback) {
				// check for alerts
				var coords = self.data.users[username];
				var current_alert_ids = {};
				
				var nick = username;
				if (self.api.users[username] && self.api.users[username].nickname) {
					nick = self.api.users[username].nickname;
				}
				
				self.getDarkSkyData(coords, function(err, data) {
					if (err) return callback();
					
					if (data.alerts && data.alerts.length) {
						data.alerts.forEach( function(alert) {
							// process alert -- is unique?
							if (!alert.id) alert.id = Tools.digestHex( alert.title, 'md5' );
							self.logDebug(9, "Processing alert: " + alert.title, alert);
							current_alert_ids[alert.id] = 1;
							
							if (!coords.alerts) coords.alerts = {};
							if (!coords.alerts[alert.id]) {
								// new alert!  say it!
								self.logDebug(5, "Broadcasting new alert: " + alert.id);
								coords.alerts[alert.id] = 1;
								
								var emoji = self.getAlertEmoji( alert.severity, alert.title );
								var msg = '';
								msg += '<p>:' + emoji + ': **New Weather Alert for ' + nick + ':** ' + alert.title;
								if (alert.regions && alert.regions.length) {
									msg += ' (' + alert.regions.join(', ') + ')';
								}
								msg += ' ([Details](' + alert.uri + '))</p>';
								/*if (alert.description) {
									msg += '`' + alert.description.replace(/\`/g, '') + '`';
								}*/
								self.say( chan, msg );
								
								dirty = true;
							}
						}); // foreach alert
					} // alerts
					
					// prune stale alerts from user data
					if (coords.alerts) {
						for (var id in coords.alerts) {
							if (!current_alert_ids[id]) {
								self.logDebug(9, "Alert is no longer active, removing from cache: " + id);
								delete coords.alerts[id];
								dirty = true;
							}
						}
					}
					
					callback();
				}); // getDarkSkyData
			},
			function() {
				// all done with alert checks
				self.logDebug(9, "Weather alert checks complete");
				
				// dirty?  save dataz here
				if (dirty) self.storeData();
			}
		); // eachSeries
	},
	
	displayHourlyForecast: function(opts, chat) {
		// fetch and display hourly forecast for user, or for arbitrary named location
		// opts: { latitude, longitude, who }
		var self = this;
		var coords = { latitude: opts.latitude, longitude: opts.longitude };
		
		this.startTyping(chat);
		this.getDarkSkyData(coords, function(err, data) {
			self.stopTyping();
			
			if (err) {
				return self.doError(chat, "Failed to fetch forecast: " + err);
			}
			if (!data || !data.hourly || !data.hourly.summary || !data.hourly.data || !data.hourly.data.length || !data.flags || !data.flags.units) {
				return self.doError(chat, "Failed to fetch forecast: Invalid JSON response");
			}
			
			var hours = data.hourly.data;
			var units = data.flags.units;
			var msg = '<p>**Hourly forecast for ' + opts.who + ':** ' + data.hourly.summary + '</p>';
			
			// if (hours[0].time < Tools.timeNow()) hours.shift();
			if (hours.length > 12) hours.splice(12);
			
			msg += '<table class="data_table">';
			msg += '<tr><th>Time</th><th>Forecast</th></tr>';
			
			// pull in user's timezone here
			moment.tz.setDefault( self.getPlugin('time').getUserTimezone(chat.username) );
			
			hours.forEach( function(hour) {
				var hour_name = moment( new Date(hour.time * 1000) ).format('h A z');
				var emoji = self.getWeatherEmoji(hour.icon, hour.summary);
				
				msg += '<tr><td>';
				msg += '**' + hour_name + ':**</td><td>:' + emoji + ': ' + hour.summary;
				
				if (!hour.summary.trim().match(/\.$/)) msg += ', ';
				else msg += '  ';
				msg += 'Temp: ' + self.formatTemperature(hour.temperature, units);
				
				// rain / snow / sleet
				if (!hour.precipType) hour.precipType = 'rain';
				if (!hour.precipIntensity) hour.precipIntensity = 0;
				if (!hour.precipProbability) hour.precipProbability = 0;
				
				if (hour.precipIntensity >= 0.01) {
					msg += ', ' + Tools.ucfirst(hour.precipType) + 'fall: ' + self.formatLength(hour.precipIntensity, units);
					if (hour.precipProbability > 0) {
						msg += ' with a ' + Tools.pct(hour.precipProbability, 1.0, true) + ' chance of more';
					}
				}
				else if (hour.precipProbability > 0) {
					msg += ', ' + Tools.ucfirst(hour.precipType) + ': ' + Tools.pct(hour.precipProbability, 1.0, true) + ' chance';
				}
				
				msg += '</td></tr>';
			}); // foreach hour
			
			msg += '</table>';
			
			self.doReply(chat, msg, { quiet: 1 });
		}); // getDarkSkyData
	},
	
	displayDailyForecast: function(opts, chat) {
		// fetch and display forecast for user, or for arbitrary named location
		// opts: { latitude, longitude, who }
		var self = this;
		var coords = { latitude: opts.latitude, longitude: opts.longitude };
		
		this.startTyping(chat);
		this.getDarkSkyData(coords, function(err, data) {
			self.stopTyping();
			
			if (err) {
				return self.doError(chat, "Failed to fetch forecast: " + err);
			}
			if (!data || !data.daily || !data.daily.summary || !data.daily.data || !data.daily.data.length || !data.flags || !data.flags.units) {
				return self.doError(chat, "Failed to fetch forecast: Invalid JSON response");
			}
			
			var days = data.daily.data;
			var units = data.flags.units;
			var msg = '<p>**Daily forecast for ' + opts.who + ':** ' + data.daily.summary + '</p>';
			
			if (days.length > 7) days.splice(7);
			
			msg += '<table class="data_table">';
			msg += '<tr><th>Day</th><th>Forecast</th></tr>';
			
			// pull in user's timezone here
			moment.tz.setDefault( self.getPlugin('time').getUserTimezone(chat.username) );
			
			days.forEach( function(day) {
				var day_name = moment( new Date(day.time * 1000) ).format('dddd');
				var emoji = self.getWeatherEmoji(day.icon, day.summary);
				
				msg += '<tr><td>';
				msg += '**' + day_name + ':**</td><td>:' + emoji + ': ' + day.summary;
				
				if (!day.summary.trim().match(/\.$/)) msg += ', ';
				else msg += '  ';
				msg += 'High: ' + self.formatTemperature(day.temperatureHigh, units);
				msg += ', Low: ' + self.formatTemperature(day.temperatureLow, units);
				
				// rain / snow / sleet
				if (!day.precipType) day.precipType = 'rain';
				if (!day.precipIntensity) day.precipIntensity = 0;
				if (!day.precipProbability) day.precipProbability = 0;
				
				if (day.precipIntensity >= 0.001) {
					msg += ', ' + Tools.ucfirst(day.precipType) + 'fall: ' + self.formatLength(day.precipIntensity * 24, units);
					if (day.precipProbability > 0) {
						msg += ' with a ' + Tools.pct(day.precipProbability, 1.0, true) + ' chance of more';
					}
				}
				else if (day.precipProbability > 0) {
					msg += ', ' + Tools.ucfirst(day.precipType) + ': ' + Tools.pct(day.precipProbability, 1.0, true) + ' chance';
				}
				
				msg += '</td></tr>';
			}); // foreach day
			
			msg += '</table>';
			
			self.doReply(chat, msg, { quiet: 1 });
		}); // getDarkSkyData
	},
	
	displayWeather: function(opts, chat) {
		// fetch and display weather for user, or for arbitrary named location
		// opts: { latitude, longitude, who, append }
		var self = this;
		var coords = { latitude: opts.latitude, longitude: opts.longitude };
		
		this.startTyping(chat);
		this.getDarkSkyData(coords, function(err, data) {
			self.stopTyping();
			
			if (err) {
				return self.doError(chat, "Failed to fetch weather: " + err);
			}
			var cur = data.currently;
			var daily = data.daily;
			
			if (!cur || !cur.summary || !daily || !daily.data || !daily.data.length || !data.flags || !data.flags.units) {
				return self.doError(chat, "Failed to fetch weather: Invalid JSON response");
			}
			
			self.logDebug(9, "Current weather for: " + opts.who, cur);
			var emoji = self.getWeatherEmoji( cur.icon, cur.summary );
			var today = daily.data[0];
			var units = data.flags.units;
			var msg = '<p>**Current weather for ' + opts.who + ':** :' + emoji + ': ' + cur.summary;
			
			// temperature
			msg += ', ' + self.formatTemperature(cur.temperature, units);
			msg += ' (High: ' + self.formatTemperature(Math.max(cur.temperature, today.temperatureHigh), units);
			msg += ', Low: ' + self.formatTemperature(Math.min(cur.temperature, today.temperatureLow), units) + ')';
			
			// rain / snow / sleet
			if (!cur.precipType) cur.precipType = 'rain';
			if (!cur.precipIntensity) cur.precipIntensity = 0;
			if (!cur.precipProbability) cur.precipProbability = 0;
			
			if (cur.precipIntensity >= 0.001) {
				msg += ', ' + Tools.ucfirst(cur.precipType) + 'fall: ' + self.formatLength(cur.precipIntensity * 24, units);
				if (cur.precipProbability > 0) {
					msg += ' with a ' + Tools.pct(cur.precipProbability, 1.0, true) + ' chance of more';
				}
			}
			else if (cur.precipProbability > 0) {
				msg += ', ' + Tools.ucfirst(cur.precipType) + ': ' + Tools.pct(cur.precipProbability, 1.0, true) + ' chance';
			}
			
			// wind speed
			msg += ', Wind: ';
			if (cur.windSpeed >= 1.0) {
				msg += self.formatSpeed(cur.windSpeed, units);
				if ('windBearing' in cur) msg += " " + self.degToCompass(cur.windBearing);
				if (cur.windGust && (cur.windGust > cur.windSpeed)) msg += ' gusting to ' + self.formatSpeed(cur.windGust, units);
			}
			else msg += 'Calm';
			
			// humidity
			msg += ', Humidity: ' + Tools.pct(cur.humidity, 1.0, true);
			
			// pressure
			msg += ', Pressure: ' + self.formatPressure(cur.pressure, units);
			
			// visibility
			msg += ', Visibility: ' + self.formatDistance(cur.visibility, units);
			
			// UV
			msg += ', UV Index: ' + cur.uvIndex + '/12</p>';
			
			// severe weather alerts
			if (data.alerts && data.alerts.length) {
				data.alerts.forEach( function(alert) {
					var emoji = self.getAlertEmoji( alert.severity, alert.title );
					msg += '<p>:' + emoji + ': **Weather Alert:** ' + alert.title;
					msg += ' ([Details](' + alert.uri + '))</p>';
				} ); // foreach
			}
			
			if (opts.append) msg += opts.append;
			
			self.doReply(chat, msg, { quiet: 1 });
		}); // getDarkSkyData
	},
	
	degToCompass: function(num) {
		// wind bearing degrees to compass direction
		var val = Math.floor((num / 22.5) + 0.5);
		var arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
		return arr[(val % arr.length)];
	},
	
	guessUserLocation: function(value, chat, callback) {
		// try to locate user based on specified US ZIP, or US City+State
		// this requires local tab-delimited data from ZipCodeDownload.com
		// Columns: ZIPCode, ZIPType, CityName, CityType, CountyName, CountyFIPS, StateName, StateAbbr, StateFIPS, MSACode, AreaCode, TimeZone, UTC, DST, Latitude, Longitude
		var self = this;
		var loc_file = 'conf/zipcodes.txt';
		var found_row = null;
		var regex = new RegExp( Tools.escapeRegExp( value.replace(/\,/g, ' ').replace(/\s+/g, ' ') ), "i" );
		
		if (!fs.existsSync(loc_file)) {
			return callback( new Error("Sorry, no local ZIP code database can be found.  Please provide exact latitude / longitude coordinates.") );
		}
		
		this.startTyping(chat);
		Tools.fileEachLine( loc_file,
			{
				buffer_size: 1024 * 1024
			},
			function(line, callback) {
				// this is fired for each line
				var columns = line.split(/\t/);
				
				// match zip
				if (columns[0].match(regex)) {
					found_row = columns;
					return callback("STOP");
				}
				
				// match city state
				var city_state = columns[2].trim() + " " + columns[7].trim();
				if (city_state.match(regex)) {
					found_row = columns;
					return callback("STOP");
				}
				
				// fire callback for next line, pass error to abort
				callback();
			},
			function(err) {
				// all lines are complete
				if (!found_row) {
					self.stopTyping();
					return callback(new Error("We could not determine a location from your query: " + value));
				}
				
				// return custom location data
				callback( false, {
					city: found_row[2].trim(),
					state: found_row[7].trim(),
					city_state: found_row[2].trim() + ", " + found_row[7].trim(),
					latitude: parseFloat( found_row[14].trim() ),
					longitude: parseFloat( found_row[15].trim() )
				});
			}
		); // fileEachLine
	},
	
	getWeatherEmoji: function(icon, summary) {
		// pick appropriate emoji for weather conditions
		var emoji = this.config.weather_emoji[ icon ] || 'earth_americas';
		if ((emoji == 'mostly_sunny') && summary.match(/(partly\s+sunny|mostly\s+cloudy)/i)) emoji = 'partly_sunny';
		return emoji;
	},
	
	getAlertEmoji: function(sev, title) {
		// pick appropriate emoji for weather alert
		var emoji = this.config.alert_emoji[ sev ] || 'zap';
		if (title.match(/\b(surf)\b/i)) emoji = 'surfer';
		else if (title.match(/\b(flood|beach)\b/i)) emoji = 'ocean';
		else if (title.match(/\b(winds?)\b/i)) emoji = 'tornado';
		else if (title.match(/\b(fog)\b/i)) emoji = 'fog';
		else if (title.match(/\b(winter|frost|ice|icy)\b/i)) emoji = 'snowflake';
		else if (title.match(/\b(snow)\b/i)) emoji = 'snowman';
		else if (title.match(/\b(storm|thunder|lightning)\b/i)) emoji = 'thunder_cloud_and_rain';
		return emoji;
	},
	
	formatTemperature: function(value, units) {
		// format temperature according to units (us, si, uk2, ca)
		if (units && units.match(/us/i)) {
			return '' + Math.round(value) + '°F';
		}
		else {
			return '' + Math.round(value) + '°C';
		}
	},
	
	formatSpeed: function(value, units) {
		// format speed according to units (us, si, uk2, ca)
		if (units && units.match(/(us|uk2)/i)) {
			return '' + Math.round(value) + ' MPH';
		}
		else {
			return '' + Math.round(value) + ' Km/H';
		}
	},
	
	formatDistance: function(value, units) {
		// format distance according to units (us, si, uk2, ca)
		if (units && units.match(/(us|uk2)/i)) {
			return '' + Math.round(value) + ' Mi';
		}
		else {
			return '' + Math.round(value) + ' Km';
		}
	},
	
	formatPressure: function(value, units) {
		// format pressure according to units (us, si, uk2, ca)
		if (units && units.match(/us/i)) {
			// millibars --> inches
			return '' + Math.round(value / 33.864) + ' in';
		}
		else {
			// Hectopascals --> Kilopascals
			return '' + Tools.commify(Math.round(value / 10)) + ' kPa';
		}
	},
	
	formatLength: function(value, units) {
		// format pressure according to units (us, si, uk2, ca)
		if (units && units.match(/us/i)) {
			return '' + Tools.shortFloat(value) + ' in';
		}
		else {
			return '' + Tools.shortFloat(value) + ' mm';
		}
	},
	
	getDarkSkyData: function(coords, callback) {
		// fetch dark sky current conditions and forecast, given user coords
		var self = this;
		var url = "https://api.darksky.net/forecast/" + this.config.api_key + "/" + coords.latitude + "," + coords.longitude + "?exclude=minutely&units=auto";
		this.logDebug(9, "Fetching weather: " + url);
		
		this.request.json( url, null, function(err, resp, data, perf) {
			if (err) {
				self.logError('darksky', "Failed to fetch weather: " + err);
			}
			callback(err, data);
		}); // request.json
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
