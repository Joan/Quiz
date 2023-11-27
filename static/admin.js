/*
 * QUIZ
 * admin.js
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
	
	const socket = io();
	
	var riddles,
	    teams,
	    scores,
	    shortcuts,
		
		current_riddle = null,
		current_riddle_num = 0,
		riddle_count = 0,
		
		teams_default_colors = ['#62b529', '#ed1d24', '#e8ae00', '#1782e1'];
	
	const init = function(data) {
		
		riddles = data.riddles;
		teams = data.teams;
		scores = data.scores;
		shortcuts = data.shortcuts;
		
		riddle_count = riddles.length;
		
		// Then initiate stuff
		scoreboard.init();
		riddleboard.init();
		settings.init(data.settings);
		controls.init();
		socket.emit('get_player_state');
		
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
	};
	
	/*
	 * TEAMS SCORES
	 *
	 */
	
	const scoreboard = {
		
		init: function() {
			
			scoreboard.$el = $('.teams_pane');
			scoreboard.$teams = $('.teams');
			
			scoreboard.$team_template = $($('#team-template').html());
			
			scoreboard.scroll_to_active_team = true;
			scoreboard.current_buzzer_team_id = -1;
			
			scoreboard.update_teams();
			scoreboard.update_scores();
			
			scoreboard.$reset_scores_button = $('#button-reset');
			scoreboard.$edit_teams_button = $('#button-edit_teams');
			scoreboard.$edit_teams_end_button = $('#button-edit_teams_end');
			scoreboard.$edit_teams_add = $('#button-add_team');
			// TODO: switch to `data-action` instead of `id`
			
			scoreboard.$reset_scores_button.on('click.scoreboard', scoreboard.reset_scores);
			scoreboard.$edit_teams_button.on('click.scoreboard', scoreboard.edit_teams.start);
			scoreboard.$edit_teams_end_button.on('click.scoreboard', scoreboard.edit_teams.end);
			
		},
		
		update_teams: function() {
			scoreboard.$teams.children().remove();
			for (let i in teams)
				scoreboard.add_team(i);
			update_css_colors();
		},
		
		add_team: function(team_id) {
			let $clone = scoreboard.$team_template.clone();
			$clone.attr('id', 'team_' + team_id).addClass('team_color_' + team_id);
			$clone.find('.team-name-text').text(teams[team_id].name);
			$clone.find('input').on('change.scoreboard', scoreboard.input_change);
			$clone.find('button').on('click.scoreboard', scoreboard.buttons_click);
			$clone.find('[data-team]').attr('data-team', team_id);
			$clone.appendTo(scoreboard.$teams);
		},
		
		input_change: function(e) {
			e.preventDefault();
			if ($(this).val() === '')
				$(this).val(0);
			scoreboard.update_score($(this).attr('data-team'), $(this).val());
			this.blur();
		},
		
		buttons_click: function(e) {
			e.preventDefault();
			scoreboard.change_score($(this).attr('data-team'), $(this).attr('data-inc'));
		},
		
		change_score: function(team_id, inc) {
			socket.emit('change_score', {team_id: team_id, inc: inc});
		},
		
		reset_scores: function() {
			if (window.confirm('Remettre les scores à zéro ?'))
				socket.emit('reset_scores');
		},
		
		update_score: function(team_id, score) {
			socket.emit('update_score', {team_id: team_id, score: score});
		},
		
		update_scores: function(scores_data) {
			if (scores_data !== undefined)
				scores = scores_data;
			
			for (let i in scores)
				scoreboard.$teams.find('.team-score input[data-team="' + i + '"]').val(scores[i]);
		},
		
		update_buzzer: function(team_id, player_state, buzzer_queue) {
			
			scoreboard.$teams.children().removeClass('current_buzzer queued_buzzer disabled_buzzer');
			
			if (team_id >= 0) {
				
				var $target = $('#team_' + team_id);
				$('#team_' + team_id).addClass('current_buzzer');
				
				if (scoreboard.scroll_to_active_team && scoreboard.current_buzzer_team_id !== team_id) {
					var scroll_target = team_id === 0 ? 0 : $target.position().top + scoreboard.$el[0].scrollTop - scoreboard.$el.offset().top - 20;
					scoreboard.$el.stop(true).animate({scrollTop: scroll_target}, 500);
				}
			}
			
			if (player_state == 'not_buzzable') {
				scoreboard.$teams.addClass('temp_disabled_buzzer');
			} else {
				scoreboard.$teams.removeClass('temp_disabled_buzzer');
				
				if (player_state == 'buzzable' && settings.single_buzz.val) {
					
					for (let i = 0, l = scoreboard.buzz_counts.length; i < l; i++) {
						let $team = $('#team_' + i);
						if (scoreboard.buzz_counts[i] > 0 && !$team.hasClass('current_buzzer'))
							$team.addClass('disabled_buzzer');
					}
					
				}
			}
			
			var buzzer_queue_length = buzzer_queue.length;
			if (buzzer_queue_length > 0) {
				for (let i = 0; i < buzzer_queue_length; i++)
					$('#team_' + buzzer_queue[i]).addClass('queued_buzzer');
			}
			
			scoreboard.current_buzzer_team_id = team_id;
			
		},
		
		edit_teams: {
			initiated: false,
			
			start: function() {
				
				scoreboard.edit_teams.initiated = true;
				
				// Check if each team has fields
				for (let i in teams) {
					if (!$('#team_' + i).hasClass('--edit_ready'))
						scoreboard.edit_teams.add_edit_fields_to_team(i);
				}
				
				// Be sure to bind event on this button
				scoreboard.$edit_teams_add.off('click.edit_teams').on('click.edit_teams', scoreboard.edit_teams.add);
				
				scoreboard.edit_teams.serialized_teams = JSON.stringify(teams);
				scoreboard.$el.addClass('--edit_teams');
				scoreboard.$edit_teams_button.hide();
				
			},
			
			add_edit_fields_to_team: function(team_id) {
				var $team = $('#team_' + team_id),
					$clone = $($('#team_edit_fields-template').html()).clone(),
					$edit_color = $clone.find('.team_edit-color'),
					$color_button = $clone.find('.team_edit-color button');
				$clone.find('.team_edit-name > input').val(teams[team_id].name);
				$clone.find('.team_edit-delete > button').on('click.edit_teams', scoreboard.edit_teams.delete);
				for (let j = 0, k = teams_default_colors.length; j < k; j++) {
					let $color_button_target = j === 0 ? $color_button : $color_button.clone().appendTo($edit_color);
					$color_button_target
						.attr('data-color', teams_default_colors[j])
						.css('color', teams_default_colors[j])
						.on('click.edit_teams', scoreboard.edit_teams.change_color);
				}
				$clone.find('.team_edit-color input')
					.appendTo($edit_color) // Putting it at the end
					.on('input.edit_teams', scoreboard.edit_teams.change_color);
				$clone.find('[data-team]').attr('data-team', team_id);
				$clone.appendTo($team);
				$team.addClass('--edit_ready');
				controls.$inputs = $('input'); // Update all page inputs
			},
			
			change_color: function(e) {
				var team_id = e.target.getAttribute('data-team'),
					color = e.target.getAttribute('data-color') || e.target.value;
				$('#team_' + team_id).css('color', color);
				teams[team_id].color = color;
			},
			
			add: function() {
				var next_keycode = 0,
					random_default_color = teams_default_colors[Math.floor(Math.random() * teams_default_colors.length)];
				
				for (let i in teams)
					next_keycode = next_keycode > teams[i].keycode ? next_keycode : teams[i].keycode + 1;
				
				var team_id = teams.push({
					name: '',
					color: random_default_color,
					keycode: next_keycode,
					keycode_name: String.fromCharCode(next_keycode)
				}) - 1;
				
				scoreboard.add_team(team_id);
				scoreboard.edit_teams.add_edit_fields_to_team(team_id);
				update_css_colors();
				socket.emit('team_added', teams[team_id]);
			},
			
			delete: function(e) {
				var team_id = parseInt(e.target.getAttribute('data-team')),
					team_name = teams[team_id].name || $('#team_' + team_id + ' .team_edit-name input').val(); // If we didn't updated the teams object yet
				
				if (!window.confirm(('Supprimer l’équipe ' + team_name + ' ?').replace('  ', ' ')))
					 return;
				
				teams.splice(team_id, 1);
				$('#team_' + team_id).remove();
				
				// Update IDs of next elements
				for (let i = team_id+1, j = teams.length; i <= j; i++) {
					let $i_team = $('#team_' + i);
					$i_team
						.attr('id', 'team_' + (i-1))
						.removeClass('team_color_'+i).addClass('team_color_'+(i-1))
						.find('[data-team]').attr('data-team', i-1);
				}
				update_css_colors();
				
				socket.emit('team_deleted', team_id);
			},
			
			save: function() {
				// Get and update names
				for (let i in teams) {
					let team_input_val = $('#team_' + i + ' .team_edit-name input').val()
					if (team_input_val !== '') {
						teams[i].name = team_input_val;
						$('#team_' + i + ' .team-name-text').text(team_input_val)
					}
				}
				
				// Get and update teams colors
				scoreboard.$teams.find('.team[style]').removeAttr('style');
				update_css_colors();
				
				// Send everything
				if (scoreboard.edit_teams.serialized_teams !== JSON.stringify(teams)) // Send only if has changes
					socket.emit('team_edited', teams);
			},
			
			end: function(abort) {
				if (abort !== true)
					scoreboard.edit_teams.save();
				scoreboard.$edit_teams_add.off('click.edit_teams')
				scoreboard.$edit_teams_button.show();
				scoreboard.$el.removeClass('--edit_teams');
			}
			
		}
		
	};
	
	socket.on('update_scores', function(data) {
		scoreboard.update_scores(data);
	});
	
	socket.on('update_buzzer', function(data) {
		scoreboard.buzz_counts = data.buzz_counts;
		scoreboard.update_buzzer(data.current, data.state, data.queue);
	});
	
	socket.on('update_teams', function(team_data) {
		if (scoreboard.edit_teams.initiated)
			scoreboard.edit_teams.end(true);
		teams = team_data;
		scoreboard.update_teams();
	});
	
	/*
	 * RIDDLES
	 *
	 */
	
	const riddleboard = {
		
		init: function() {
			
			riddleboard.$el = $('.riddles');
			riddleboard.$helper = $('.helper-list');
			
			riddleboard.$riddle_template = $($('#riddle-template').html());
			
			riddleboard.create_riddles();
			
			riddleboard.$el.on('click', '.riddle', function(e) {
				riddleboard.request_change($(this).attr('data-riddle'));
			});
			
		},
		
		create_riddles: function() {
			
			riddleboard.$el.html('');
			
			for (let i in riddles) {
				let $clone = riddleboard.$riddle_template.clone(),
					num = toInt(i) + 1;
				$clone.attr('id', 'riddle_' + num).attr('data-riddle', num);
				$clone.find('.riddle-type').text(riddles[i].type);
				$clone.find('.riddle-count').text(num + ' / ' + riddle_count);
				$clone.find('.riddle-answer').text(riddles[i].answer);
				$clone.find('.riddle-answer_subtitle').text(riddles[i].answer_subtitle);
				$clone.appendTo(riddleboard.$el);
			}
			
		},
		
		change_current: function(riddle_num) {
			
			riddleboard.$el.children('.current').removeClass('current');
			riddleboard.$el.children('.requested').removeClass('requested');
			
			if (riddle_num < 1) {
				var scroll_target = 0,
				    has_filename_answer = false;
			}
			
			else {
				
				var $target = $('#riddle_' + riddle_num),
				    scroll_target = $target.position().top + riddleboard.$el[0].scrollTop - riddleboard.$el.offset().top - 20,
				    has_filename_answer = riddles[riddle_num - 1].hasOwnProperty('filename_answer');
				
				$target.addClass('current');
			}
			
			riddleboard.$el.stop(true).animate({scrollTop: scroll_target}, 500);
			
			$('[data-command="toggle_answer"]').attr('disabled', !has_filename_answer);
			
		},
		
		request_change: function(riddle_num) {
			var $target = $('#riddle_' + riddle_num);
			$target.addClass('requested');
			socket.emit('riddle_request_change', riddle_num);
		}
		
	};
	
	socket.on('riddle_change', function(riddle_num) {
		riddleboard.change_current(riddle_num);
	});
	
	/*
	 * SETTINGS
	 *
	 */
	
	const settings = {
		
		init: function(server_settings) {
			
			var local_setting = {
				scroll_to_active_team: true
			};
			
			var all_settings = {
				...local_setting,
				...server_settings
			};
			
			// Init all settings
			for (let setting in all_settings) {
				
				settings[setting] = {
					val: all_settings[setting],
					$el: $(`[data-setting="${setting}"]`),
					$input: $(`[data-setting="${setting}"] input[type="checkbox"]`)
				};
				
				settings[setting].$input.prop('checked', settings[setting].val); // Update inputs
				settings.process(setting);
				
				let is_server_setting = !local_setting.hasOwnProperty(setting);
				
				settings[setting].$input
					.on('change.settings', function() {
						
						settings[setting].val = this.checked;
						
						if (is_server_setting)
							socket.emit('set_setting', setting, this.checked);
						
						settings.process(setting);
						
					})
					.on('change.settings_blur', function() {$(this).blur()}); // prevent focus to stay on checkbox, disabling controls shortcuts
				
			}
			
		},
		
		// Settings change processers
		
		process: function(setting) {
			if (settings.hasOwnProperty(`process_${setting}`))
				settings[`process_${setting}`](this.checked);
		},
		
		process_scroll_to_active_team: function() {
			scoreboard.scroll_to_active_team = settings.scroll_to_active_team.val;
		},
		
		process_buzzers_enabled: function() {
			scoreboard.$teams[settings.buzzers_enabled.val ? 'removeClass' : 'addClass']('all_disabled_buzzer');
		},
		
		toggle_buzzers_enabled: function() { // For keyboard shortcut
			settings.buzzers_enabled.$input.prop('checked', !settings.buzzers_enabled.$input[0].checked).trigger('change');
		}
		
	};
	
	socket.on('set_setting', (setting, val) => {

		settings[setting].val = val;
		settings[setting].$input.prop('checked', !!val);
		
		settings.process(setting);
		
	});
	
	/*
	 * CONTROLS AND KEYBOARD SHORTCUTS
	 *
	 */
	
	const controls = {
		
		init: function() {
			
			controls.$inputs = $('input');
			
			$window.on('keydown', controls.keydown_handler);
			
			$('[data-action="control"]').on('click', controls.click_handler);
			
			controls.teams_keycodes = [];
			for (let i in teams)
				controls.teams_keycodes.push(teams[i].keycode);
			
			controls.all_commands = Object.values(shortcuts);
			controls.commands_shortcuts = Object.fromEntries(Object.entries(shortcuts).map(([k, v]) => [v, toInt(k)]));
			
			controls.warning_messages = {};
			controls.virtual_buzzer_used = false;
			
		},
		
		keydown_handler: function(e) {
			
			var keycode = e.originalEvent.keyCode,
				input_focused = controls.$inputs.is(':focus');
			
			// Abort if meta or if one of inputs has focus
			if (keycode === undefined || input_focused || e.originalEvent.metaKey || e.originalEvent.ctrlKey || e.originalEvent.altKey || e.originalEvent.shiftKey)
				return;
			
			// Teams keycodes
			if (controls.teams_keycodes.includes(keycode)) {
				e.preventDefault();
				socket.emit('buzzer_press', keycode);
				return;
			}
			
			// Manage buzzer activation shortcut directly
			if (keycode === controls.commands_shortcuts.toggle_buzzers) {
				e.preventDefault();
				settings.toggle_buzzers_enabled();
				return;
			}
			
			// Shortcuts
			if (shortcuts.hasOwnProperty(keycode)) {
				e.preventDefault();
				socket.emit('control', shortcuts[keycode]);
				return;
			}
			
		},
		
		click_handler: function(e) {
			e.preventDefault();
			
			var command = $(this).attr('data-command');
			
			if (controls.all_commands.includes(command))
				socket.emit('control', command);
			
		},
		
		update_control_alt: function(command, is_alt) {
			
			var $target = $(`[data-command="${command}"][data-display-alt]`);
			
			if ($target.length >= 0) {
				
				$target.attr('data-display-alt', !!is_alt);
				
				if (['toggle_scores', 'toggle_answer', 'toggle_qr'].includes(command))
					$target[!!is_alt ? 'addClass' : 'removeClass']('--highlighted');
			}
		},
		
		check_clients: function(clients_counts) {
			
			// Check for players (not connected or multiple connected)
			controls.toggle_warning('no_player', clients_counts.players < 1);
			controls.toggle_warning('multiple_players', clients_counts.players > 1);
			
			// Show offline virtual buzzers (if at least one connects)
			if (Math.max(...clients_counts.buzzers) > 0 || controls.virtual_buzzer_used) {
				
				controls.virtual_buzzer_used = true;
				
				for (let i in teams) {
					let $team_bs = $(`#team_${i} .team-name .team-buzzer_status`);
					
					if ($team_bs.length === 0)
						$team_bs = $('<svg class="team-buzzer_status" width="32" height="32"><use href="#dis-buzzer-icon"/></svg>').appendTo(`#team_${i} .team-name`);
					
					$team_bs[clients_counts.buzzers[i] === 0 ? 'addClass' : 'removeClass']('--show');
				}
				
			}
			
		},
		
		toggle_warning: function(message, show) {
			var $warnings = $('.admin_warnings'),
			    $message = $(`.admin_warnings-message[data-message=${message}]`);
			
			if ($message) {
				if (show) {
					$message.css('height', $message.find('span').height()).addClass('--active');
					controls.warning_messages[message] = true;
				} else {
					$message.removeAttr('style').removeClass('--active');
					controls.warning_messages[message] = false;
				}
			}
			
			// Hide player_activation message if one of the others is displayed
			if (controls.warning_messages.no_player || controls.warning_messages.multiple_players)
				$('.admin_warnings-message[data-message=player_activation]').removeAttr('style').removeClass('--active');
			// And display again player_activation message if needed
			if (message !== 'player_activation')
				controls.toggle_warning('player_activation', !!controls.warning_messages.player_activation)
			
			$warnings[$('.admin_warnings-message.--active').length > 0 ? 'addClass' : 'removeClass']('--has_messages');
		}
		
	};
	
	socket.on('update_control_alt', (command, alt) => controls.update_control_alt(command, alt));
	
	socket.on('update_clients', clients_counts => controls.check_clients(clients_counts));
	
	socket.on('update_player_activation_state', has_been_active => controls.toggle_warning('player_activation', !has_been_active));
	
	/*
	 * INITIATE
	 *
	 */
	
	$(function() {
		
		socket.emit('connection_admin');
		
	});
	
	/* That's all Folks! */
	
})(this, this.document);

/* Helpers */

// parse(Int|Float) are buggy
function toFloat(n) {
	return +n; // or Number(n)
}
function toInt(n) {
	return n < 0 ? Math.ceil(toFloat(n)) : Math.floor(toFloat(n)); // could be "n | 0;", but this prevents a NaN result to return 0. (Equal to future Math.trunc)
}