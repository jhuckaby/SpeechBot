// Weather Reports via Open-Meteo.com
// SpeechBot Plugin
// Copyright (c) 2022 Joseph Huckaby
// Released under the MIT License

// !weather LAT, LONG
// !weather forget
// !weather
// !forecast

var fs = require('fs');
var Class = require("pixl-class");
var Plugin = require("../plugin.js");
var Tools = require("pixl-tools");
var async = Tools.async;

module.exports = Class.create({
	
	__parent: Plugin,
	
	help: {
		"weather": "Specify your weather location geo coordinates, e.g. `!weather LAT, LONG`, then type `!weather` or `!forecast`",
		"forecast": "After registering your location with `!weather LAT, LONG`, use this command to get a 5-day forecast, e.g. `!forecast`"
	},
	
	startup: function(callback) {
		// bot is starting up
		if (!this.data.users) this.data.users = {};
		
		callback();
	},
	
	cmd_weather: function(value, chat) {
		// weather command
		var self = this;
		var username = chat.username;
		var nickname = chat.nickname;
		
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
		
		if (!this.data.users[username]) {
			// cmd_weather handles the error reply for this case
			return this.cmd_weather(value, chat);
		}
		
		if (value.match(/\S/)) {
			// get weather forecast for arbitrary location
			// try to guess coords based on ZIP or city/state
			this.guessUserLocation(value, chat, function(err, data) {
				if (err) return self.doError(chat, err.message || err);
				
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
	
	displayDailyForecast: function(opts, chat) {
		// fetch and display forecast for user, or for arbitrary named location
		// opts: { latitude, longitude, who }
		var self = this;
		var coords = { latitude: opts.latitude, longitude: opts.longitude };
		
		this.startTyping(chat);
		this.getWeatherData(coords, function(err, data) {
			self.stopTyping();
			
			if (err) {
				return self.doError(chat, "Failed to fetch forecast: " + err);
			}
			
			var units = data.daily_units;
			var daily = data.daily;
			if (!units || !daily) {
				return self.doError(chat, "Failed to fetch weather: Invalid JSON response");
			}
			
			var msg = '<p>**Daily forecast for ' + opts.who + ':**</p>';
			
			msg += '<table class="data_table">';
			msg += '<tr><th>Day</th><th>Forecast</th></tr>';
			
			daily.time.forEach( function(date_str, idx) {
				var dargs = Tools.getDateArgs( date_str + ' 00:00:00' );
				var day_name = dargs.dddd;
				var summary = self.getWeatherSummary( daily.weathercode[idx] );
				
				msg += '<tr><td>';
				msg += '**' + day_name + ':**</td><td>' + summary;
				
				msg += ', High: ' + daily.temperature_2m_max[idx] + units.temperature_2m_max;
				msg += ', Low: ' + daily.temperature_2m_min[idx] + units.temperature_2m_min;
				
				// precip
				if (daily.snowfall_sum[idx] > 0) {
					msg += ', Snowfall: ' + daily.snowfall_sum[idx] + ' ' + units.snowfall_sum;
				}
				else if (daily.showers_sum[idx] > 0) {
					msg += ', Showers: ' + daily.showers_sum[idx] + ' ' + units.showers_sum;
				}
				else if (daily.rain_sum[idx] > 0) {
					msg += ', Rain: ' + daily.rain_sum[idx] + ' ' + units.rain_sum;
				}
				
				msg += '</td></tr>';
			}); // foreach day
			
			msg += '</table>';
			
			self.doReply(chat, msg, { quiet: 1 });
		}); // getWeatherData
	},
	
	displayWeather: function(opts, chat) {
		// fetch and display weather for user, or for arbitrary named location
		// opts: { latitude, longitude, who, append }
		var self = this;
		var coords = { latitude: opts.latitude, longitude: opts.longitude };
		
		this.startTyping(chat);
		this.getWeatherData(coords, function(err, data) {
			self.stopTyping();
			
			if (err) {
				return self.doError(chat, "Failed to fetch weather: " + err);
			}
			
			var cur = data.current_weather;
			var units = data.daily_units;
			var daily = data.daily;
			if (!cur || !units || !daily) {
				return self.doError(chat, "Failed to fetch weather: Invalid JSON response");
			}
			
			self.logDebug(9, "Current weather for: " + opts.who, cur);
			
			var summary = self.getWeatherSummary(cur.weathercode);
			var msg = '<p>**Current weather for ' + opts.who + ':** ' + summary;
			
			// "current_weather":{"temperature":42.8,"windspeed":5.2,"winddirection":320.0,"weathercode":1,"time":"2022-12-01T18:00"}
			// daily.temperature_2m_max[0]
			// daily.temperature_2m_min[0]
			// daily.rain_sum[0]
			// daily.showers_sum[0]
			// daily.snowfall_sum[0]
			// daily.precipitation_hours[0]
			// daily.shortwave_radiation_sum[0]
			
			// temperature
			msg += ', ' + cur.temperature + units.temperature_2m_max;
			msg += ' (High: ' + daily.temperature_2m_max[0] + units.temperature_2m_max;
			msg += ', Low: ' + daily.temperature_2m_min[0] + units.temperature_2m_min + ')';
			
			// precip
			if (daily.snowfall_sum[0] > 0) {
				msg += ', Snowfall: ' + daily.snowfall_sum[0] + ' ' + units.snowfall_sum;
				if (daily.precipitation_hours[0] > 0) msg += ' (' + daily.precipitation_hours[0] + ' ' + Tools.pluralize('hour', daily.precipitation_hours[0]) + ')';
			}
			else if (daily.showers_sum[0] > 0) {
				msg += ', Showers: ' + daily.showers_sum[0] + ' ' + units.showers_sum;
				if (daily.precipitation_hours[0] > 0) msg += ' (' + daily.precipitation_hours[0] + ' ' + Tools.pluralize('hour', daily.precipitation_hours[0]) + ')';
			}
			else if (daily.rain_sum[0] > 0) {
				msg += ', Rain: ' + daily.rain_sum[0] + ' ' + units.rain_sum;
				if (daily.precipitation_hours[0] > 0) msg += ' (' + daily.precipitation_hours[0] + ' ' + Tools.pluralize('hour', daily.precipitation_hours[0]) + ')';
			}
			
			// wind speed
			msg += ', Wind: ';
			if (cur.windspeed >= 1.0) {
				msg += cur.windspeed + ' ' + units.windspeed_10m_max;
				msg += " " + self.degToCompass(cur.winddirection);
			}
			else msg += 'Calm';
			
			// radiation
			if (daily.shortwave_radiation_sum[0]) {
				msg += ', Radiation: ' + daily.shortwave_radiation_sum[0] + ' ' + units.shortwave_radiation_sum;
			}
			
			if (opts.append) msg += opts.append;
			
			self.doReply(chat, msg, { quiet: 1 });
		}); // getWeatherData
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
	
	getWeatherSummary: function(code) {
		var emoji = '';
		var summary = '';
		switch (code) {
			case 0: emoji = 'sunny'; summary = 'clear skies'; break;
			case 1: emoji = 'mostly_sunny'; summary = 'mostly clear'; break;
			case 2: emoji = 'partly_sunny'; summary = 'mostly cloudy'; break;
			case 3: emoji = 'cloud'; summary = 'overcast'; break;
			case 45: emoji = 'fog'; summary = 'fog'; break;
			case 48: emoji = 'fog'; summary = 'depositing rime fog'; break;
			case 51: emoji = 'rain_cloud'; summary = 'light drizzle'; break;
			case 53: emoji = 'rain_cloud'; summary = 'moderate drizzle'; break;
			case 55: emoji = 'rain_cloud'; summary = 'dense drizzle'; break;
			case 56: emoji = 'snowflake'; summary = 'light freezing drizzle'; break;
			case 57: emoji = 'snowflake'; summary = 'dense freezing drizzle'; break;
			case 61: emoji = 'rain_cloud'; summary = 'slight rain'; break;
			case 63: emoji = 'rain_cloud'; summary = 'moderate rain'; break;
			case 65: emoji = 'rain_cloud'; summary = 'heavy rain'; break;
			case 66: emoji = 'snow_cloud'; summary = 'light freezing rain'; break;
			case 67: emoji = 'snow_cloud'; summary = 'heavy freezing rain'; break;
			case 71: emoji = 'snow_cloud'; summary = 'light snow fall'; break;
			case 73: emoji = 'snow_cloud'; summary = 'moderate snow fall'; break;
			case 75: emoji = 'snow_cloud'; summary = 'heavy snow fall'; break;
			case 77: emoji = 'snow_cloud'; summary = 'snow grains'; break;
			case 80: emoji = 'umbrella_with_rain_drops'; summary = 'light rain showers'; break;
			case 81: emoji = 'umbrella_with_rain_drops'; summary = 'moderate rain showers'; break;
			case 82: emoji = 'umbrella_with_rain_drops'; summary = 'violent rain showers'; break;
			case 85: emoji = 'snowflake'; summary = 'light snow showers'; break;
			case 86: emoji = 'snowflake'; summary = 'heavy snow showers'; break;
			case 95: emoji = 'thunder_cloud_and_rain'; summary = 'thunderstorm'; break;
			case 96: emoji = 'thunder_cloud_and_rain'; summary = 'thunderstorm with light hail'; break;
			case 99: emoji = 'thunder_cloud_and_rain'; summary = 'thunderstorm with heavy hail'; break;
			default: emoji = 'tornado'; summary = 'unknown conditions'; break;
		}
		return ':' + emoji + ': ' + Tools.ucfirst(summary);
	},
	
	getWeatherData: function(coords, callback) {
		// fetch weather current conditions and forecast, given user coords
		var self = this;
		var url = "https://api.open-meteo.com/v1/forecast?latitude=" + coords.latitude + "&longitude=" + coords.longitude + "&daily=temperature_2m_max,temperature_2m_min,rain_sum,showers_sum,snowfall_sum,precipitation_hours,weathercode,windspeed_10m_max,winddirection_10m_dominant,shortwave_radiation_sum&current_weather=true&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch&timezone=America/Los_Angeles";
		
		this.logDebug(9, "Fetching weather: " + url);
		
		this.request.json( url, null, function(err, resp, data, perf) {
			if (err) {
				self.logError('api', "Failed to fetch weather: " + err);
			}
			callback(err, data);
		}); // request.json
	},
	
	shutdown: function(callback) {
		// bot is shutting down
		callback();
	}
	
});
