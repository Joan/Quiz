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
	
	const videos_path = '/media/videos/',
	      audios_path = '/media/audios/',
	      images_path = '/media/images/',
	      poster_path = '/media/intro-poster.png';
	
	const socket = io();
	
	var riddles,
	    teams,
	    scores,
	    init_data = null;
	
	var current_riddle = null,
	    current_riddle_num = 0,
	    riddle_count = 0;
	
	const init = function(data) {
		
		riddles = data.riddles;
		teams = data.teams;
		scores = data.scores;
		player.has_poster = data.has_intro_poster;
		
		riddle_count = riddles.length;
		
		// Then initiate stuff
		buzzer.init(); // buzzer can take over on player so initiated first
		scoreboard.init();
		player.init();
		qr_helper.init();
		keyboard.init();
		
		buzzer.set_buzzers_enabled(data.buzzers_enabled);
		buzzer.set_single_buzz(data.single_buzz);
		
	};
	
	socket.on('init_data', function(data) {
		init(data);
	});
	
	/* Specific CSS styles */
	
	const update_css_colors = function() {
		$('#teams_colors').remove();
		var css = '';
		for (let i in teams)
			css += '.team_color_' + i + '{color:' + teams[i].color + ';}';
		$('body').append('<style id="teams_colors">' + css + '</style>');
	},
	
	update_css_misc = function() {
		$('#teams_misc').remove();
		var css = '',
			l = teams.length;
		
		// Buzzers position
		for (let i = 1; i <= l; i++)
			css += `.buzzer:nth-child(${i}){left: ${i!==1 ? (i*10+5)+'vh' : '0'};}`;
		// Scoreboard height (.5 for the bottom margin)
		css += `.scoreboard{height: ${l*2+.5}em;}`;
		// Scoreboard teams position
		for (let i = 1; i <= l; i++)
			css += `.scoreboard .team[data-position="${i}"]{top: ${(i-1)*2}em;}`;
		// Scoreboard teams apparition
		for (let i = 1; i <= l; i++)
			css += `.scoreboard.show .team[data-position="${i}"],.scoreboard.hide .team[data-position="${l+1-i}"] {animation-delay: ${(i-1)*50}ms;}`;
		
		$('body').append('<style id="teams_misc">' + css + '</style>');
	};
	
	/*
	 * PLAYER
	 *
	 */
	
	const player = {
		
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
			
			// Attach event when audio or video reaches the end
			player.$video_player.add(player.$audio_player).on('ended', function() {
				player.pause();
			});
			
			if (player.has_poster) // Set at main init
				player.init_poster();
			else
				player.next();
			
			player.cursor_display_timeout = null;
			player.cursor_idle = true;
			$body.on('mousemove.cursor_display', player.handle_cursor_display);
			
			console.info('Player ready');
			
		},
		
		init_poster: function() {
			player.$poster = $(`<div class="poster"><img src="${poster_path}"></div>`).insertAfter(player.$el).css('opacity', 0);
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
			
			if (riddle_num > 1) // Allow testing buzzers before starting the quiz
				buzzer.buzzable = false;
			
			player.loaded = true;
			
			callback(riddle_num);
			
		},
		
		set_volume: function(vol) {
			player.playable_el.volume = roundFloat(vol, 2);
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
			buzzer.reset_buzz_counts();
			
			console.info('Launching riddle #' + current_riddle_num + (immediate ? ' immediatly' : ' normaly'));
			
			var step_function = player.is_playable ? player.set_volume : null;
			
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
			
			var step_function = player.is_playable ? player.set_volume : null;
			
			player.$el.animate({opacity: 0}, {
				duration: immediate ? 0 : 200,
				step: step_function,
				complete: function() {
					
					player.pause();
					
					if (riddle_num === 0) { // Fired when looped back (not at first init)
						player.unload();
						current_riddle_num = riddle_num;
						current_riddle = null;
						player.send_riddle_change(riddle_num);
						buzzer.reset_buzz_counts();
						return;
					}
					
					// Load next one if there's any
					
					player.load(riddle_num, function(riddle_num) {
						
						current_riddle_num = riddle_num;
						current_riddle = riddles[current_riddle_num - 1];
						player.send_riddle_change(riddle_num);
						buzzer.reset_buzz_counts();
						
						// Display directly if needed
						if (immediate)
							player.launch(true);
						
					});
					
				}
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
		},
		
		handle_cursor_display: function() {
			if (player.cursor_idle)
				$body.addClass('--cursor_moving');
			var later = function() {
				$body.removeClass('--cursor_moving');
				player.cursor_idle = true;
			};
			player.cursor_idle = false;
			clearTimeout(player.cursor_display_timeout);
			player.cursor_display_timeout = setTimeout(later, 50);
		}
		
	};
	
	socket.on('get_player_state', function() {
		player.send_riddle_change(current_riddle_num);
		socket.emit('player_interact_state', keyboard.has_interacted);
		buzzer.send_buzz_change();
	});
	
	socket.on('riddle_request_change', function(riddle_num) {
		player.change_to(toInt(riddle_num));
	});
	
	/*
	 * BUZZER
	 *
	 */
	
	const buzzer = {
		
		init: function() {
			
			buzzer.$el = $('.buzzers');
			buzzer.buzzable = true;
			buzzer.has_queue = false;
			buzzer.enabled = null;
			buzzer.single_buzz = null;
			buzzer.buzz_counts = [];
			buzzer.current = -1;
			
			buzzer.reset_buzz_counts();
			buzzer.empty_queue();
			
		},
		
		key_buzz: function(keycode) {
			
			// Buzzers keys
			
			if (buzzer.buzzable && buzzer.enabled) {
				for (let i in teams) {
					if (keycode === teams[i].keycode) {
						if (!(buzzer.single_buzz && buzzer.buzz_counts[i] > 0) || !player.launched)
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
			else
				buzzer.send_buzz_change();
			
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
			var $target = buzzer.$el.children(':first'),
			    team_id = $target.length > 0 ? toInt($target.attr('data-id')) : -1;
			
			if ($target.length > 0)
				buzzer.buzz_counts[team_id]++;
			
			buzzer.current = team_id;
			buzzer.send_buzz_change();
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
		},
		
		reset_buzz_counts: function() {
			buzzer.buzz_counts = [];
			for (let i = 0, c = teams.length; i < c; i++)
				buzzer.buzz_counts[i] = 0;
			
			buzzer.send_buzz_change();
		},
		
		send_buzz_change: function() {
			
			if (player.loaded === undefined) // prevent firing this too many times at init
				return;
			
			if (current_riddle_num > 1)
				var state = buzzer.buzzable ? 'buzzable' : 'not_buzzable';
			 else
				var state = (buzzer.buzzable && !player.launched) ? 'test_buzzable' : 'buzzable';
			
			var queue = [];
			if (buzzer.has_queue) {
				for (let i = 0, c = teams.length; i < c; i++)
					if (i !== buzzer.current && teams[i].queued)
						queue.push(i);
			}
			
			socket.emit('update_buzzer', {
				current: buzzer.current,
				queue: queue,
				state: state,
				buzz_counts: buzzer.buzz_counts
			});
		},
		
		set_buzzers_enabled: function(enabled) {
			buzzer.enabled = enabled;
			player.$el[enabled ? 'removeClass' : 'addClass']('--buzzer_disabled');
		},
		
		toggle_enabled: function() {
			buzzer.set_buzzers_enabled(!buzzer.enabled);
			socket.emit('set_buzzers_enabled', buzzer.enabled);
		},
		
		set_single_buzz: function(enabled) {
			buzzer.single_buzz = enabled;
		}
		
	};
	
	socket.on('buzzer_press', function(team_keycode) {
		buzzer.key_buzz(team_keycode);
	});
	
	socket.on('set_buzzers_enabled', function(enabled) {
		buzzer.set_buzzers_enabled(enabled);
	});
	
	socket.on('set_single_buzz', function(enabled) {
		buzzer.set_single_buzz(enabled);
		buzzer.send_buzz_change();
	});
	
	/*
	 * SCORES
	 *
	 */
	
	const scoreboard = {
		
		init: function() {
			
			scoreboard.$el = $('.scoreboard');
			scoreboard.update_teams();
			scoreboard.update_scores();
			
		},
		
		update_teams: function() {
			
			if (!scoreboard.$el.hasClass('show')) {
				// Hide for real and launch the first hide animation
				scoreboard.$el.css('opacity', 0);
				setTimeout(scoreboard.hide, 1);
			}
			
			update_css_colors();
			update_css_misc();
			scoreboard.$el.attr('data-teams-count', teams.length);
			
			var $unprocessed_teams = scoreboard.$el.children();
			
			for (let i in teams) {
				let $team = $('#team_' + i);
				if ($team.length <= 0)
					$team = $('<li class="team"/>')
						.attr('id', 'team_' + i)
						.addClass('team_color_' + i)
						.attr('data-position', +i+1)
						.appendTo(scoreboard.$el);
				
				$team.html('<span class="name">' + teams[i].name + '</span><span class="score"></span>');
				
				$unprocessed_teams = $unprocessed_teams.not($team);
				
			}
			
			$unprocessed_teams.remove();
			buzzer.empty_queue();
			
			// Remove opacity when last animation is finished
			scoreboard.$el.children().first().on('animationend.update_teams', function() {
				setTimeout(function() {scoreboard.$el.removeAttr('style');}, 1e3);
				$(this).off('animationend.update_teams');
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
	
	socket.on('update_teams', function(team_data) {
		teams = team_data;
		scoreboard.update_teams();
	});
	
	/*
	 * QR CODE
	 *
	 */
	
	const qr_helper = {
		
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
					correctLevel : QRCode.CorrectLevel.L // L M H Q
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
	
	const keyboard = {
		
		init: function() {
			
			// Handle the warning in admin to prevent DOMException for play event
			socket.emit('player_interact_state', false);
			keyboard.has_interacted = false;
			$body.on('click.only-once keydown.only-once', function() {
				socket.emit('player_interact_state', true);
				keyboard.has_interacted = true;
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
				
				// B (toggle buzzer activation)
				case 66:
					buzzer.toggle_enabled();
					break;
				
				// S (toggle scoreboard)
				case 83:
					scoreboard.toggle();
					break;
				
				// Q (toggle QR Code)
				case 81:
					qr_helper.toggle();
					break;
				
				// W (TEST)
				case 87: scoreboard.update_teams(); scoreboard.update_scores(); break;
				
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
		
		socket.emit('connection_player');
		
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