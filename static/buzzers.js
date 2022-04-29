/*
 * QUIZ
 * buzzers.js
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
	
	var teams,
	    team = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[1];
	
	const init = function(data) {
		
		teams = data.teams;
		
		// Then initiate stuff
		update_css_colors();
		
		// Specific buzzer requested
		if (team !== undefined) {
			if (teams[team] !== undefined)
				buzzer.init();
			else
				window.location = window.location.origin + '/' + window.location.pathname.split('/')[1];
		}
		// Buzzer list requested
		else
			selector.init();
		
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
	 * TEAM SELECTOR
	 *
	 */
	
	const selector = {
		
		init: function() {
			
			selector.$template = $($('#teams-template').html());
			selector.$team_template = $($('#team-template').html());
			
			var $selector = selector.$template.clone();
			
			for (let i in teams) {
				let $team = selector.$team_template.clone();
				$team.addClass('team_color_' + i);
				$team.find('a')
					.attr('href', window.location.pathname + (window.location.pathname.slice(-1) == '/' ? '' : '/') + i)
					.text(teams[i].name);
				$team.appendTo($selector);
			}
			
			$selector.prependTo($body);
			
		}
		
	};
	
	/*
	 * BUZZER BUTTON
	 *
	 */
	
	const buzzer = {
		
		init: function() {
			
			buzzer.$template = $($('#team-buzzer-template').html());
			
			$body.addClass('disable_scroll');
			
			buzzer.$el = buzzer.$template.clone();
			buzzer.$el.addClass('team_color_' + team);
			buzzer.$el.find('.name').text(teams[team].name);
			buzzer.$el.prependTo($body);

			buzzer.$el.on('mousedown touchstart', function(e) {
				e.preventDefault();
				buzzer.buzz();
				$(this).addClass('active');
			});
			
			buzzer.$el.on('mouseup touchend', function(e) {
				e.preventDefault();
				$(this).removeClass('active');
			}); 
			
		},
		
		buzz: function() {
			socket.emit('buzzer_press', teams[team].keycode);
		}
		
	};
	
	/*
	 * INITIATE
	 *
	 */
	
	$(function() {
		
		socket.emit('connection_buzzer', team);
		
	});
	
	socket.on('update_teams', function() {
		window.location.href = '/buzzers';
	});
	
	/* That's all Folks! */
	
})(this, this.document);
