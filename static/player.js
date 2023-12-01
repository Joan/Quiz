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
	      poster_path = '/media/';
	
	const socket = io();
	
	var riddles,
	    teams,
	    scores,
	    shortcuts;
	
	var current_riddle = null,
	    current_riddle_num = 0,
	    riddle_count = 0;
	
	const init = function(data) {
		
		riddles = data.riddles;
		teams = data.teams;
		scores = data.scores;
		player.intro_poster = data.intro_poster;
		shortcuts = data.shortcuts;
		
		riddle_count = riddles.length;
		
		// Then initiate stuff
		user_activation.init();
		buzzer.init(); // buzzer is initiated first because it can take over on player
		scoreboard.init();
		player.init();
		qr_helper.init();
		controls.init();
		
		buzzer.set_buzzers_enabled(data.settings.buzzers_enabled);
		buzzer.set_single_buzz(data.settings.single_buzz);
		
	};
	
	socket.on('init_data', function(data) {
		init(data);
	});
	
	socket.on('get_player_state', function() {
		player.send_riddle_change(current_riddle_num);
		socket.emit('update_player_activation_state', user_activation.has_been_active);
		buzzer.send_buzz_change();
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
	
	/* userActivation polyfill */
	// Handles the warning in admin to prevent DOMException for play events
	
	const user_activation = {
		
		has_been_active: false,
		
		init: function() {
			user_activation.queue = [];
			socket.emit('update_player_activation_state', false);
			$window.on('click.user_activation mouseup.user_activation pointerup.user_activation', user_activation.click_handler);
		},
		
		click_handler: function(e) {
			if (e.originalEvent.isTrusted) {
				user_activation.has_been_active = true;
				user_activation.trigger_queue();
				$window.off('.user_activation');
				$('.user_activation_warning').remove();
				socket.emit('update_player_activation_state', true);
			}
		},
		
		add_to_queue: function(s) {
			if (user_activation.has_been_active)
				s();
			else
				user_activation.queue.push(s);
		},
		
		trigger_queue: function() {
			for (let s of user_activation.queue)
				s();
		}
		
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
			
			audio_bars.init();
			
			player.send_riddle_change(0);
			
			// Attach event when audio or video reaches the end
			player.$video_player.add(player.$audio_player).on('ended', function() {
				player.pause();
			});
			
			if (player.intro_poster !== false) // Set at main init
				player.init_poster();
			else
				player.next();
			
			player.cursor_display_timeout = null;
			player.cursor_idle = true;
			$body.on('mousemove.cursor_display', player.handle_cursor_display);
			
			console.info('Player ready');
			
		},
		
		init_poster: function() {
			player.$poster = $(`<div class="poster"><img src="${poster_path + player.intro_poster}"></div>`).insertAfter(player.$el).css('opacity', 0);
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
			socket.emit('update_control_alt', 'play_pause', true);
			
			scoreboard.hide();
			qr_helper.hide();
		},
		
		pause: function() {
			if (player.is_playable)
				player[current_riddle.type].pause();
			player.$el.removeClass('playing');
			player.paused = true;
			socket.emit('update_control_alt', 'play_pause', false);
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
			socket.emit('update_control_alt', 'toggle_answer', true);
			
		},
		
		send_riddle_change: function(riddle_num) {
			socket.emit('riddle_change', riddle_num);
			socket.emit('update_control_alt', 'toggle_answer', false);
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
			player.cursor_display_timeout = setTimeout(later, 150);
		}
		
	};
	
	/* Audio bars */
	
	const audio_bars = {
		
		init: function() {
			
			if (!user_activation.has_been_active) {
				user_activation.add_to_queue(audio_bars.init);
				return;
			}
			
			const fftSize = 64,
			      rect_width = 5,
			      rect_gap = 5;
			
			audio_bars.rect_min_height = 4;
			audio_bars.rect_max_height = 400;
			audio_bars.visualizer_middle = audio_bars.rect_max_height / 2;
			
			audio_bars.$visualizer = $('.audio-bars svg')[0];
			
			audio_bars.bars_count = fftSize - Math.round((fftSize) * 0.3); // We remove the last bars that are almost always flat (~ 30% of frequency bin)
			audio_bars.bars = [];
			audio_bars.bars_max = [];
			
			audio_bars.audio_context = new (AudioContext || webkitAudioContext)();
			audio_bars.source = audio_bars.audio_context.createMediaElementSource(player.audio);
			audio_bars.analyser = audio_bars.audio_context.createAnalyser();
			
			audio_bars.analyser.fftSize = fftSize * 2;
			
			audio_bars.source.connect(audio_bars.analyser);
			audio_bars.analyser.connect(audio_bars.audio_context.destination);
			audio_bars.data = new Uint8Array(audio_bars.analyser.frequencyBinCount);
			
			// Adapt SVG
			
			var visualizer_width = Math.floor(rect_width * audio_bars.bars_count + rect_gap * (audio_bars.bars_count - 1));
			audio_bars.$visualizer.setAttribute('width', visualizer_width);
			audio_bars.$visualizer.setAttribute('height', audio_bars.rect_max_height);
			audio_bars.$visualizer.setAttribute('viewBox', `0 0 ${visualizer_width} ${audio_bars.rect_max_height}`);
			
			// Create rects
			
			for (let i = 0; i < audio_bars.bars_count; i++) {
				let el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
				el.setAttribute('x', (rect_width + rect_gap) * i);
				el.setAttribute('y', (audio_bars.visualizer_middle) - (audio_bars.rect_min_height / 2));
				el.setAttribute('width', rect_width);
				el.setAttribute('height', audio_bars.rect_min_height);
				el.setAttribute('rx', 1.7);
				audio_bars.$visualizer.append(el);
				audio_bars.bars[i] = el;
			}
			
			// Calcs max heights
			
			// t,b,c,d: iteration, first val, last val, iterations count
			var easeOutQuad = function(t,b,c,d) {return -c * (t /= d) * (t - 2) + b},
			    easeOutCirc = function(t,b,c,d) {return c * Math.sqrt(1 - (t = t / d - 1) * t) + b};
	
			var firsts = [], lasts = [],
			    min_val = audio_bars.rect_min_height * 2,
			    max_val = audio_bars.rect_max_height - (audio_bars.rect_min_height * 2),
			    firsts_count = Math.round(3/6 * audio_bars.bars_count),
			    lasts_count = Math.round(1/6 * audio_bars.bars_count),
			    rests_count = audio_bars.bars_count - firsts_count - lasts_count;
	
			// Easing values for first bars
			for (let i = 0; i < firsts_count; i++)
				firsts[i] = roundFloat(easeOutQuad(i, min_val, max_val, firsts_count), 1);
			// Easing values for last bars
			for (let i = 0; i < lasts_count; i++)
				lasts[i] = roundFloat(easeOutCirc(i, min_val, max_val, lasts_count), 1);
			lasts = lasts.reverse();
			// Merge these and fill
			audio_bars.bars_max = [...firsts, ...Array(rests_count).fill(audio_bars.rect_max_height), ...lasts];
			
			// Init update events
			
			player.audio.addEventListener('play', function() {
				audio_bars.request_loop();
			});
			
			player.audio.addEventListener('pause', function() {
				audio_bars.draw(false);
			});
			
		},
		
		request_loop: function() {
			setTimeout(() => requestAnimationFrame(audio_bars.loop), 20); // Throttle requestAnimationFrame to limit RAM usage
		},
		
		loop: function() {
			
			if (player.paused)
				return;
			
			audio_bars.request_loop();
			audio_bars.analyser.getByteFrequencyData(audio_bars.data);
			audio_bars.draw(audio_bars.data);
			
		},
		
		draw: function(data) {
			
			if (data === false) // Pause values
				var bars_heigh = Array(audio_bars.bars_count).fill(audio_bars.rect_min_height);
			
			else { // Playing values
				
				data = [...data]; // Uint8Array → Array
				
				var bars_heigh = [];
				
				for (let i = 0; i < audio_bars.bars_count; i++)
					bars_heigh[i] = roundFloat(data[i] * audio_bars.bars_max[i] * 2 / 255, 1); // Adapt to this bar max - 255 is the maximum frenquency value
				
			}
			
			for (let i = 0; i < audio_bars.bars_count; i++) {
				audio_bars.bars[i].setAttribute('height', Math.max(bars_heigh[i] / 2, audio_bars.rect_min_height));
				audio_bars.bars[i].setAttribute('y', (audio_bars.visualizer_middle) - (Math.max(bars_heigh[i] / 2, audio_bars.rect_min_height) / 2));
			}
			
		}
		
	};
	
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
			socket.emit('set_setting', 'buzzers_enabled', buzzer.enabled);
		},
		
		set_single_buzz: function(enabled) {
			buzzer.single_buzz = enabled;
		}
		
	};
	
	socket.on('buzzer_press', function(team_keycode) {
		buzzer.key_buzz(team_keycode);
	});
	
	socket.on('set_setting', (setting, val) => {
		switch (setting) {
			case 'buzzers_enabled':
				buzzer.set_buzzers_enabled(val);
				break;
			case 'single_buzz':
				buzzer.set_single_buzz(val);
				buzzer.send_buzz_change();
				break;
		}
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
			socket.emit('update_control_alt', 'toggle_scores', true);
		},
		
		hide: function() {
			scoreboard.$el.addClass('hide').removeClass('show');
			socket.emit('update_control_alt', 'toggle_scores', false);
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
			
			socket.emit('get_domain', function(local_domain) {
				
				var full_url = (local_domain.startsWith('http') ? '' : 'https://') + local_domain,
				    domain = full_url.split('//')[1];
				
				qr_helper.$el = $('<div class="qr_helper"/>').insertAfter($body.children(':not(script):not(style)').last()).append('<div class="qr_helper-image"/>');
				
				$('<div class="qr_helper-url"/>').text(domain).appendTo(qr_helper.$el);
				
				var $helper_image = qr_helper.$el.find('.qr_helper-image');
				
				new QRCode($helper_image[0], {
					text: full_url,
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
				socket.emit('update_control_alt', 'toggle_qr', true);
			}
		},
		
		hide: function() {
			if (qr_helper.$el) {
				qr_helper.$el.addClass('hide').removeClass('show');
				qr_helper.hidden = true;
				socket.emit('update_control_alt', 'toggle_qr', false);
			}
		},
		
		toggle: function() {
			qr_helper[qr_helper.hidden ? 'show' : 'hide']();
		}
		
	};
	
	/*
	 * CONTROLS / GLOBAL KEYBOARD MANAGEMENT
	 *
	 */
	
	const controls = {
		
		init: function() {
			
			$window.on('keydown', controls.keydown_handler);
			
			controls.teams_keycodes = [];
			for (let i in teams)
				controls.teams_keycodes.push(teams[i].keycode);
			
			controls.all_commands = Object.values(shortcuts);
			controls.commands_shortcuts = Object.fromEntries(Object.entries(shortcuts).map(([k, v]) => [v, toInt(k)]));
			
		},
		
		keydown_handler: function(e) {
			
			var keycode = e.originalEvent.keyCode;
			
			// Abort if meta
			if (keycode === undefined || e.originalEvent.metaKey || e.originalEvent.ctrlKey || e.originalEvent.altKey || e.originalEvent.shiftKey)
				return;
			
			// Teams keycodes
			if (controls.teams_keycodes.includes(keycode)) {
				e.preventDefault();
				buzzer.key_buzz(keycode);
				return;
			}
			
			// Shortcuts
			if (shortcuts.hasOwnProperty(keycode)) {
				e.preventDefault();
				controls.exec(shortcuts[keycode]);
			}
			
		},
		
		exec: function(command) {
			
			if (!controls.all_commands.includes(command)) {
				console.error(`Unknown control command “${command}”`);
				return;
			}
			
			switch(command) {
				
				// Normal next riddle
				case 'next':
					player.next();
					break;
				
				// Change riddle and play immediatly
				case 'backward':
					player.prev(true);
					break;
				case 'forward':
					player.next(true);
					break;
				
				// Play/pause media or next buzzer
				case 'play_pause':
					if (buzzer.has_queue)
						buzzer.remove_first_from_queue();
					else
						player.toggle();
					break;
				
				// Empty buzzers queue
				case 'clear':
					if (buzzer.has_queue)
						buzzer.empty_queue(true);
					break;
				
				// Display image answer
				case 'toggle_answer':
					player.reveal();
					break;
				
				// Toggle buzzer activation
				case 'toggle_buzzers':
					buzzer.toggle_enabled();
					break;
				
				// Toggle scoreboard
				case 'toggle_scores':
					scoreboard.toggle();
					break;
				
				// Toggle QR Code
				case 'toggle_qr':
					qr_helper.toggle();
					break;
				
			}
			
		}
		
	};
	
	socket.on('control', function(command) {
		controls.exec(command);
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