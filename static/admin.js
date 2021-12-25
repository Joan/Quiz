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
	
	const json_pathes = [
		'/media/_data/quiz.json',
		'/media/_data/teams.json'
	];
	
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
			riddleboard.init();
			settings.init();
			keyboard.init();
			
			socket.emit('connection_admin');
		
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
		$('body').append(html);
		
	};
	
	/*
	 * TEAMS SCORES
	 *
	 */
	
	var scoreboard = {
		
		init: function() {
			
			scoreboard.$el = $('.scores');
			
			scoreboard.$team_template = $($('#team-template').html());
			scoreboard.$options_template = $($('#options-template').html());
			
			scoreboard.create_teams();
			scoreboard.scroll_to_active_team = true;
			
		},
		
		create_teams: function() {
			
			scoreboard.$el.html('');
			
			for (let i in teams) {
				let $clone = scoreboard.$team_template.clone();
				$clone.attr('id', 'team_' + i).addClass('team_color_' + i);
				$clone.find('.team-name').text(teams[i].name);
				$clone.find('input').on('change.scoreboard', scoreboard.input_change);
				$clone.find('button').on('click.scoreboard', scoreboard.buttons_click);
				$clone.find('[data-team]').attr('data-team', i);
				$clone.appendTo(scoreboard.$el);
			}
			
			scoreboard.$options_template
				.appendTo(scoreboard.$el)
				.find('.reset-button').on('click.scoreboard', scoreboard.reset_scores);
			
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
			if (window.confirm("Remettre les scores à zéro ?"))
				socket.emit('reset_scores');
		},
		
		update_score: function(team_id, score) {
			socket.emit('update_score', {team_id: team_id, score: score});
		},
		
		update_scores: function(scores_data) {
			if (scores_data !== undefined)
				scores = scores_data;
			
			for (let i in scores)
				scoreboard.$el.find('input[data-team="' + i + '"]').val(scores[i]);
		},
		
		change_buzzer: function(team_id) {
			
			if (team_id >= 0) {
				
				scoreboard.$el.children('.current_buzzer').removeClass('current_buzzer');
				
				var $target = $('#team_' + team_id);
				$('#team_' + team_id).addClass('current_buzzer');
				
				if (scoreboard.scroll_to_active_team) {
					var scroll_target = team_id === 0 ? 0 : $target.position().top + scoreboard.$el[0].scrollTop - scoreboard.$el.offset().top - 20;
					scoreboard.$el.stop(true).animate({scrollTop: scroll_target}, 500);
				}
				
			}
			
		},
		
		edit_teams: {
			initiated: false,
			
			init: function() {
				
				scoreboard.$team_edit_fields_template = $($('#team_edit_fields-template').html());
				
				for (let i in teams) {
					// this has to go in a fn to fire it again when adding a team
					let $team = scoreboard.$el.find('#team_' + i),
						$clone = scoreboard.$team_edit_fields_template.clone();
					$clone.find('.team_edit-name > input')
						.val(teams[i].name)
						.on('change.scoreboard', scoreboard.aaa);
					$clone.find('.team_edit-delete > button').on('click.scoreboard', scoreboard.aaa);
					$clone.filter('.team_edit-color').find('button')
						.each(function() {
							console.log($(this).attr('data-color'));
							$(this).css('color', $(this).attr('data-color'));})
						.on('click.scoreboard', scoreboard.aaa);
					$clone.filter('.team_edit-color').find('input').on('click.scoreboard', scoreboard.aaa);
					$clone.find('[data-team]').attr('data-team', i);
					$clone.appendTo($team);
					$team.find('.team-infos, .team-actions').hide();
				}
				
				// Add team_edit-add as well
				
				// keyboard.$inputs = $('input'); // update all inputs
				
				scoreboard.edit_teams.initiated = true;
				
			},
			
			save: function() {
				
				// pretify JSON when saving it server side
			},
			
			show: function() {
			
				if (!scoreboard.edit_teams.initiated)
					scoreboard.edit_teams.init();
				
				scoreboard.$el.find('.team_edit').show();
				scoreboard.$el.find('.team-infos, .team-actions').hide();
				scoreboard.$el.addClass('edit_teams');
				
			},
			
			hide: function() {
				
				// save teams here
				
				scoreboard.$el.find('.team_edit').hide();
				scoreboard.$el.find('.team-infos, .team-actions').show();
				scoreboard.$el.removeClass('edit_teams');
				
			}
			
		}
		
	};
	
	socket.on('update_scores', function(data) {
		scoreboard.update_scores(data);
	});
	
	socket.on('change_buzzer', function(data) {
		scoreboard.change_buzzer(data);
	});
	
	/*
	 * RIDDLES
	 *
	 */
	
	var riddleboard = {
		
		init: function() {
			
			riddleboard.$el = $('.riddles');
			riddleboard.$helper = $('.helper-list');
			
			riddleboard.$riddle_template = $($('#riddle-template').html());
			
			riddleboard.create_riddles();
			riddleboard.get_current();
			
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
		
		get_current: function() {
			socket.emit('get_current_riddle');
		},
		
		change_current: function(riddle_num) {
			
			riddleboard.$el.children('.current').removeClass('current');
			riddleboard.$el.children('.requested').removeClass('requested');
			
			if (riddle_num < 1) {
				var scroll_target = 0,
					current_riddle_type = '';
			}
			
			else {
				var $target = $('#riddle_' + riddle_num),
					scroll_target = $target.position().top + riddleboard.$el[0].scrollTop - riddleboard.$el.offset().top - 20,
					current_riddle_type = riddles[riddle_num - 1].type;
				$target.addClass('current');
			}
			
			riddleboard.$el.stop(true).animate({scrollTop: scroll_target}, 500);
			riddleboard.$helper.attr('data-current-riddle-type', current_riddle_type);
			
		},
		
		request_change: function(riddle_num) {
			var $target = $('#riddle_' + riddle_num);
			$target.addClass('requested');
			socket.emit('riddle_request_change', riddle_num);
		}
		
	};
	
	socket.on('riddle_change', function(data) {
		riddleboard.change_current(data);
	});
	
	/*
	 * SETTINGS
	 *
	 */
	
	const settings = {
		
		init: function() {
			[
				['buzzers_enabled', true],
				['scroll_to_active_team', true],
				['edit_teams', false],
			].forEach(s => {
				settings[s[0]] = s[1];
				settings['$'+s[0]+'_label'] = $('#option-'+s[0]);
				settings['$'+s[0]+'_input'] = $('#option-'+s[0]+'-input');
				settings['$'+s[0]+'_input'].on('change.settings', settings['set_'+s[0]]);
			});
		},
		
		set_buzzers_enabled: function() {
			socket.emit('set_buzzers_enabled', settings.$buzzers_enabled_input[0].checked);
		},
		
		toggle_buzzers_enabled: function() {
			settings.$buzzers_enabled_input[0].checked = !settings.$buzzers_enabled_input[0].checked;
			settings.set_buzzers_enabled();
		},
		
		set_scroll_to_active_team: function() {
			scoreboard.scroll_to_active_team = settings.$scroll_to_active_team_input[0].checked;
		},
		
		set_edit_teams: function() {
			scoreboard.edit_teams[settings.$edit_teams_input[0].checked ? 'show' : 'hide']();
		}
		
	};
	
	socket.on('set_buzzers_enabled', function(enabled) {
		settings.$buzzers_enabled_input.prop('checked', enabled || false);
	});
	
	/*
	 * DELEGATED KEYBOARD MANAGEMENT
	 *
	 */
	
	var keyboard = {
		
		init: function() {
			
			keyboard.$inputs = $('input');
			$window.on('keydown', keyboard.keydown);
			
		},
		
		keydown: function(e) {
			
			var keycode = e.originalEvent.keyCode,
				input_focused = keyboard.$inputs.is(':focus'); // If one of inputs has focus
			
			// Abort if meta
			if (keycode === undefined || input_focused || e.originalEvent.metaKey || e.originalEvent.ctrlKey || e.originalEvent.altKey || e.originalEvent.shiftKey)
				return;
			
			// Team keycodes
			for (let i in teams) {
				if (keycode === teams[i].keycode) {
					e.preventDefault();
					socket.emit('buzzer_press', keycode);
					return;
					break;
				}
			}
			
			// Manage buzzer activation shortcut directly
			if (keycode === 66) // B
				settings.toggle_buzzers_enabled();
			
			// Player shortcuts
			switch(keycode) {
				case 13: // Enter
				case 37: // Left
				case 39: // Right
				case 32: // Space
				case 27: // Esc
				case 65: // A
				case 83: // S
				case 81: // Q
					// Send to player
					e.preventDefault();
					socket.emit('shortcut_press', e.originalEvent.keyCode);
					break;
			}
			
		}
		
	};
	
	socket.on('player_interact_state', function(interacted) {
		$('.helper-warning')[interacted ? 'hide' : 'show']();
	});
	
	/*
	 * INITIATE
	 *
	 */
	
	$(function() {
		
		init();
		
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