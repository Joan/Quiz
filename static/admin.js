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
			scoreboard.$reset_template = $($('#reset-template').html());
			
			scoreboard.create_teams();
			
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
			
			scoreboard.$reset_template
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
			if (window.confirm("Remettre à zéro ?"))
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
			scoreboard.$el.children('.current_buzzer').removeClass('current_buzzer');
			if (team_id >= 0)
				$('#team_' + team_id).addClass('current_buzzer');
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
			riddleboard.$helper = $('.helper');
			
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
			socket.emit('riddle_request_change', riddle_num);
		}
		
	};
	
	socket.on('riddle_change', function(data) {
		riddleboard.change_current(data);
	});
	
	/*
	 * DELEGATED KEYBOARD MANAGEMENT
	 *
	 */
	
	var keydown = function(e) {
		
		// Abort if meta
		if (e.originalEvent.keyCode === undefined || e.originalEvent.metaKey || e.originalEvent.ctrlKey || e.originalEvent.altKey)
			return;
		
		switch(e.originalEvent.keyCode) {
			
			// Player shortcuts
			case 13: // Enter
			case 37: // Left
			case 39: // Right
			case 32: // Space
			case 27: // Esc
			case 65: // A
			case 83: // S
			case 72: // H
				// Send to player
				e.preventDefault();
				socket.emit('shortcut_press', e.originalEvent.keyCode);
				break;
			
			default: // Else, nothing yet.
				break;
		}
		
	};
	
	$window.on('keydown', keydown);
	
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