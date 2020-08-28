/*
 * QUIZ
 * index.js
 * 
 */

(function(window, document, undefined) {
	
	'use strict';
	
	/*
	 * INIT
	 *
	 */
	
	const $window = $(window),
		$body = $('body');
	
	// Window size
	
	var windowWidth = window.innerWidth,
	windowHeight = window.innerHeight,
	window_updateSizes = function() { // binded at the end
		windowWidth = window.innerWidth;
		windowHeight = window.innerHeight;
	};
	
	const json_pathes = [
		'/data/quiz.json',
		'/data/teams.json'
	];
	
	const videos_path = '/media/videos/',
		audios_path = '/media/audios/',
		images_path = '/media/images/',
		poster_path = '/media/intro-poster.png';
	
	const socket = io();
	
	var riddles,
		teams,
		scores,
		
		current_riddle = null,
		current_riddle_num = 0,
		riddle_count = 0,
	
	init = function() {
		
		// Retrieve data
		
		Promise.all(json_pathes.map(url =>
			fetch(url)
				.then(response => {
					if (!response.ok)
						throw Error(response.statusText + ' (' + response.url + ')');
					return response;
				})
				.then(response => response.json())
				.catch(error => {
					throw error;
				})
		))
		.then(data => {
		
			riddles = data[0];
			teams = data[1];
			
			console.info('All data retrieved');
			
			riddle_count = riddles.length;
			
			// Then initiate stuff
			write_colors();
			scoreboard.init();
			buzzer.init(); // buzzer can take over on player so initiated first
			player.init();
			qr_helper.init();
			keyboard.init();
			
			socket.emit('connection_player');
		
		})
		.catch(error => {
			throw error;
		});
		
	},
	
	write_colors = function() {
		
		var html = '<style>';
		for (let i in teams)
			html += '.team_color_' + i + '{color:' + teams[i].color + ';}';
		html += '</style>';
		$body.append(html);
		
	};
	
	/*
	 * PLAYER
	 *
	 */
	
	var player = {
		
		init: function() {
			
			player.$el = $('.player');
			
			player.$video = $('.video');
			player.$video_player = $('.video video');
			player.video = player.$video_player[0];
			
			player.$audio = $('.audio');
			player.$audio_player = $('.audio audio');
			player.audio = player.$audio_player[0];
			
			player.$image = $('.image');
			player.$image_player = $('.image img');
			player.img = player.$image_player[0];
			
			player.$players = player.$video.add(player.$audio).add(player.$image);
			
			player.loaded = false;
			player.launched = false;
			player.paused = false;
			player.poster_displayed = false;
			
			player.send_riddle_change(0);
			
			console.info('Player ready');
			
			// Try to load poster image
			player.poster = new Image();
			player.poster.onload = player.init_poster;
			player.poster.onerror = player.next; // load the first riddle if no poster
			player.poster.src = poster_path;
			
		},
		
		init_poster: function() {
			player.$poster = $('<div class="poster"/>').insertAfter(player.$el).css('opacity', 0);
			player.$poster.append(player.poster);
			player.$poster.animate({opacity: 1}, 500);
			player.poster_displayed = true;
		},
		
		hide_poster: function(callback) {
			callback = callback || function() {};
			player.$poster.fadeOut(800, callback);
			player.poster_displayed = false;
		},
		
		play: function() {
			
			if (player.launched) {
				if (player.is_playable)
					player.playable_el.play();
				player.$el.addClass('playing');
			} else {
				player.launch();
			}
			
			player.paused = false;
			
			scoreboard.hide();
			qr_helper.hide();
		},
		
		pause: function() {
			if (player.is_playable)
				player[current_riddle.type].pause();
			player.$el.removeClass('playing');
			player.paused = true;
		},
		
		toggle: function() {
			
			var paused = player.is_playable ? player[current_riddle.type].paused : !player.$el.hasClass('playing');
			
			if (paused)
				player.play();
			else
				player.pause();
			
		},
		
		unload: function() {
			
			player.$players.hide();
			player.$el.removeClass('playing');
			
			player.video.pause();
			player.audio.pause();
			
			player.video.removeAttribute('src');
			player.audio.removeAttribute('src');
			player.img.removeAttribute('src');
			
			player.video.load();
			player.audio.load();
			
			player.video.volume = 1;
			player.audio.volume = 1;
			
			player.loaded = false;
			player.launched = false;
			player.type = null;
			player.is_playable = false;
			player.playable_el = null;
			
		},
		
		load: function(riddle_num, callback) {
			
			var riddle = riddles[riddle_num - 1];
			
			// Stop and unload everything
			
			player.unload();
			
			// Load new riddle
			
			switch(riddle.type) {
				
				case 'video':
					player.$video_player.attr('src', videos_path + riddle.filename);
					player.video.load();
					player.$video.show();
					player.type = riddle.type;
					player.is_playable = true;
					player.playable_el = player.video;
					break;
				
				case 'audio':
					player.$audio_player.attr('src', audios_path + riddle.filename);
					player.audio.load();
					player.$audio.show();
					player.type = riddle.type;
					player.is_playable = true;
					player.playable_el = player.audio;
					break;
				
				case 'image':
					player.$image_player.attr('src', images_path + riddle.filename);
					player.$image.show();
					player.type = riddle.type;
					player.is_playable = false;
					break;
				
			}
			
			console.info('Loaded riddle #' + riddle_num + ' (' + riddle.type + ')');
			
			if (riddle_num > 1)
				buzzer.buzzable = false; // Allow testing before starting the quiz
			
			player.loaded = true;
			
			callback(riddle_num);
			
		},
		
		launch: function(immediate) {
			
			immediate = immediate || false;
			
			if (!player.loaded)
				return;
			
			if (player.launched) {
				player.play();
				return;
			}
			
			player.launched = true;
			buzzer.buzzable = true;
			
			console.info('Launching riddle #' + current_riddle_num + (immediate ? ' immediatly' : ' normaly'));
			
			var step_function = player.is_playable ? function(now, tween) {
				player.playable_el.volume = roundFloat(now, 2);
			} : null;
			
			var complete_function = function() {
				if (player.is_playable)
					player.playable_el.volume = 1;
				player.$el.removeAttr('style');
			};
			
			if (!immediate && player.is_playable)
				player.playable_el.volume = 0;
			
			player.$el.css('opacity', 0);
			
			player.play();
			
			if (immediate) {
				complete_function();
				
			} else {
				player.$el.animate({opacity: 1}, {
					duration: 1000,
					step: step_function,
					complete: complete_function
				});
				
			}
			
		},
		
		prev: function(immediate) {
			
			immediate = immediate === true; // Error object can be sent by player.init if no poster
			var riddle_num = current_riddle_num - 1;
			
			if (riddle_num < 1) {
				immediate = false;
				riddle_num = 1;
			}
			
			player.change_to(riddle_num, immediate);
			
		},
		
		next: function(immediate) {
			
			immediate = immediate === true; // Error object can be sent by player.init if no poster
			var riddle_num = current_riddle_num + 1;
			
			if (riddle_num > riddle_count)
				riddle_num = immediate ? 1 : 0; // if we're quicly changing, loop. Otherwise, just reinit.
			
			player.change_to(riddle_num, immediate);
			
		},
		
		change_to: function(riddle_num, immediate) {
			
			immediate = immediate || false;
			
			buzzer.empty_queue();
			scoreboard.hide();
			
			// Hide poster if displayed first
			if (player.poster_displayed) {
				player.hide_poster(function() {player.change_to(riddle_num, immediate)});
				return;
			}
			
			// Hide current
			
			player.$el.stop(true);
			
			player.$el.animate({opacity: 0}, immediate ? 0 : 200, function() {
				
				player.pause();
				
				if (riddle_num === 0) {
					player.unload();
					current_riddle_num = riddle_num;
					current_riddle = null;
					player.send_riddle_change(riddle_num);
					return;
				}
				
				// Load next one if there's any
				
				player.load(riddle_num, function(riddle_num) {
					
					current_riddle_num = riddle_num;
					current_riddle = riddles[current_riddle_num - 1];
					player.send_riddle_change(riddle_num);
					
					// Display directly if needed
					if (immediate)
						player.launch(true);
					
				});
				
			});
			
		},
		
		reveal: function() {
			
			if (player.type != 'image' || current_riddle.filename_answer === undefined || current_riddle.filename_answer === '')
				return;
			
			buzzer.empty_queue();
			buzzer.buzzable = false;
			player.$image_player.attr('src', images_path + current_riddle.filename_answer);
			player.$image.show();
			player.play();
			
		},
		
		send_riddle_change: function(riddle_num) {
			socket.emit('riddle_change', riddle_num);
		}
		
	};
	
	socket.on('get_current_riddle', function() {
		player.send_riddle_change();
	});
	
	socket.on('riddle_request_change', function(riddle_num) {
		player.change_to(toInt(riddle_num));
	});
	
	/*
	 * BUZZER
	 *
	 */
	
	var buzzer = {
		
		init: function() {
			
			buzzer.$el = $('.buzzers');
			buzzer.buzzable = true;
			buzzer.has_queue = false;
			
			buzzer.empty_queue();
			
		},
		
		key_buzz: function(keycode) {
			
			// Buzzers keys
			
			if (buzzer.buzzable) {
				for (let i in teams) {
					if (keycode === teams[i].keycode) {
						buzzer.add_to_queue(i);
						return;
						break;
					}
				}
			}
			
		},
		
		add_to_queue: function(id) {
			
			if (teams[id].queued || !buzzer.buzzable)
				return;
			
			let was_first = !buzzer.has_queue;
			
			player.pause();
			teams[id].queued = true;
			buzzer.has_queue = true;
			
			$('<div class="buzzer"/>')
				.addClass('team_color_' + id)
				.attr('data-id', id)
				.html('<span class="letter">' + teams[id].name.charAt(0) + '</span>')
				.appendTo(buzzer.$el);
			
			if (was_first)
				buzzer.update_current();
			
		},
		
		remove_first_from_queue: function() {
			
			var $target = buzzer.$el.children(':first');
			
			if ($target.length <= 0)
				return;
			
			var id = toInt($target.attr('data-id'));
			
			$target.remove();
			if (teams[id].queued)
				teams[id].queued = false;
			
			if (buzzer.$el.children().length <= 0)
				buzzer.empty_queue(true);
			else
				buzzer.update_current();
			
		},
		
		update_current: function() {
			var $target = buzzer.$el.children(':first');
			socket.emit('change_buzzer', $target.length <= 0 ? -1 : toInt($target.attr('data-id')));
		},
		
		empty_queue: function(then_play) {
			then_play = then_play === undefined ? false : then_play;
			
			buzzer.$el.children().remove();
			buzzer.has_queue = false;
			
			for (let i in teams)
				teams[i].queued = false;
			
			if (then_play && player.launched)
				player.play();
			
			buzzer.update_current();
			
		}
		
	};
	
	socket.on('buzzer_press', function(team_keycode) {
		buzzer.key_buzz(team_keycode);
	});
	
	/*
	 * SCORES
	 *
	 */
	
	var scoreboard = {
		
		init: function() {
			
			scoreboard.$el = $('.scoreboard');
			
			// Hide for real and launch the first hide animation
			scoreboard.$el.css('opacity', 0);
			setTimeout(scoreboard.hide, 1);
			
			for (let i in teams) {
				$('<li class="team"/>')
					.attr('id', 'team_' + i)
					.addClass('team_color_' + i)
					.attr('data-position', i)
					.html('<span class="name">' + teams[i].name + '</span><span class="score"></span>')
					.appendTo(scoreboard.$el);
			}
			
			// Remove opacity when last animation is finished
			scoreboard.$el.children().first().on('animationend.only-once', function() {
				setTimeout(function() {scoreboard.$el.removeAttr('style');}, 1e3);
				$(this).off('animationend.only-once');
			});
			
		},
		
		show: function() {
			scoreboard.$el.addClass('show').removeClass('hide');
		},
		
		hide: function() {
			scoreboard.$el.addClass('hide').removeClass('show');
		},
		
		toggle: function() {
			scoreboard[scoreboard.$el.hasClass('show') ? 'hide' : 'show']();
		},
		
		change_score: function(change_data) {
			
			var team_id = change_data.team_id,
				inc = change_data.inc;
			
			if (player.paused)
				scoreboard.show();
			
			$('<span class="score_change"/>')
				.text((inc > 0 ? '+' : '-') + ' ' + Math.abs(inc))
				.on('animationend.score_change', function() {$(this).remove();})
				.appendTo($('#team_' + team_id));
			
		},
		
		update_scores: function(scores_data) {
			
			if (scores_data !== undefined)
				scores = scores_data;
			
			let sorted = [];
			
			for (let team_id in scores) {
				$('#team_' + team_id + ' .score').text(scores[team_id]);
				sorted.push({team_id: team_id, score: scores[team_id]});
			}
			
			sorted.reverse()
			.sort(function(a, b) {
				return a.score - b.score;
			}).reverse();
			
			for (let i in sorted)
				$('#team_' + sorted[i].team_id).attr('data-position', parseInt(i) + 1);
			
		}
		
	};
	
	socket.on('update_scores', function(data) {
		scoreboard.update_scores(data);
	});
	
	socket.on('change_score', function(data) {
		scoreboard.change_score(data);
	});
	
	/*
	 * QR CODE
	 *
	 */
	
	var qr_helper = {
		
		init: function() {
			
			qr_helper.hidden = true;
			
		},
		
		show: function() {
			
			if (qr_helper.$script === undefined) {
				qr_helper.$script = $('<script/>').appendTo($body);
				qr_helper.$script
					.on('load', qr_helper.create_and_show_img)
					.attr('src', '/static/qrcode.min.js');
			}
			
			else
				qr_helper.show_img();
			
		},
		
		create_and_show_img: function() {
			
			socket.emit('get_local_ip', function(local_ip, local_port) {
				
				var url_short = local_ip + ':' + local_port,
					url_long = window.location.protocol + '//' + url_short;
				
				qr_helper.$el = $('<div class="qr_helper"/>').insertAfter($body.children(':not(script):not(style)').last()).append('<div class="qr_helper-image"/>');
				
				$('<div class="qr_helper-url"/>').text(url_short).appendTo(qr_helper.$el);
				
				var $helper_image = qr_helper.$el.find('.qr_helper-image');
				
				new QRCode($helper_image[0], {
					text: url_long,
					width: 1000,
					height: 1000,
					colorDark : "#fff",
					colorLight : "#000",
					correctLevel : QRCode.CorrectLevel.L // M L H Q
				});
				$helper_image.removeAttr('title');
				
				setTimeout(qr_helper.show_img, 10);
				
			});
			
		},
		
		show_img: function() {
			if (qr_helper.$el) {
				qr_helper.$el.addClass('show').removeClass('hide');
				qr_helper.hidden = false;
				player.pause();
			}
		},
		
		hide: function() {
			if (qr_helper.$el) {
				qr_helper.$el.addClass('hide').removeClass('show');
				qr_helper.hidden = true;
			}
		},
		
		toggle: function() {
			qr_helper[qr_helper.hidden ? 'show' : 'hide']();
		}
		
	};
	
	/*
	 * GLOBAL KEYBOARD MANAGEMENT
	 *
	 */
	
	var keyboard = {
		
		init: function() {
			
			// Handle the warning in admin to prevent DOMException for play event
			socket.emit('player_interact_state', false);
			$body.on('click.only-once keydown.only-once', function() {
				socket.emit('player_interact_state', true);
				$(this).off('click.only-once keydown.only-once');
			});
			
			$window.on('keydown', keyboard.keydown);
			
		},
		
		keydown: function(e) {
			
			// Abort if meta
			if (e.originalEvent.keyCode === undefined || e.originalEvent.metaKey || e.originalEvent.ctrlKey || e.originalEvent.altKey)
				return;
			
			e.preventDefault();
			
			keyboard.shortcut(e.originalEvent.keyCode);
			
		},
		
		shortcut: function(keycode) {
			
			switch(keycode) {
				
				// Enter (normal next riddle)
				case 13:
					player.next();
					break;
				
				// Left / right (change riddle and play immediatly)
				case 37:
					player.prev(true);
					break;
				case 39:
					player.next(true);
					break;
				
				// Space (play/pause media or next buzzer)
				case 32:
					if (buzzer.has_queue)
						buzzer.remove_first_from_queue();
					else
						player.toggle();
					break;
				
				// Esc (empty buzzers queue)
				case 27:
					if (buzzer.has_queue)
						buzzer.empty_queue(true);
					break;
				
				// A (display image answer)
				case 65:
					player.reveal();
					break;
				
				// S (toggle scoreboard)
				case 83:
					scoreboard.toggle();
					break;
				
				// H (toggle QR Code)
				case 72:
					qr_helper.toggle();
					break;
				
				default: // else, check for a team buzzer key
					buzzer.key_buzz(keycode);
					break;
			}
			
		}
		
	};
	
	socket.on('shortcut_press', function(keycode) {
		keyboard.shortcut(keycode);
	});
	
	/*
	 * INITIATE
	 *
	 */
	
	$(function() {
		
		window_updateSizes();
		$window.on('resize.window_updateSizes', window_updateSizes);
		
		init();
		
	});
	
	/* That's all Folks! */
	
})(this, this.document);

/* Helpers */

// Round with decimals
function roundFloat(n, dec) {
	return Math.round(n * Math.pow(10, dec)) / Math.pow(10, dec);
}

// parse(Int|Float) are buggy
function toFloat(n) {
	return +n; // or Number(n)
}
function toInt(n) {
	return n < 0 ? Math.ceil(toFloat(n)) : Math.floor(toFloat(n)); // could be "n | 0;", but this prevents a NaN result to return 0. (Equal to future Math.trunc)
}