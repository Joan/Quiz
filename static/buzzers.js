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
	
	const json_pathes = [
		'/data/teams.json'
	];
	
	const socket = io();
	
	var teams,
		team,
	
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
			
			teams = data[0];
			
			console.info('All data retrieved');
			
			// Then initiate stuff
			write_colors();
			
			team = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[1];
			
			// Specific buzzer requested
			if (team !== undefined) {
				
				socket.emit('connection_buzzer', team);
				
				if (teams[team] !== undefined)
					buzzer.init();
				
			}
			
			// Buzzer list requested
			else
				selector.init();
			
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
	 * TEAM SELECTOR
	 *
	 */
	
	var selector = {
		
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
	
	var buzzer = {
		
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
		
		init();
		
	});
	
	/* That's all Folks! */
	
})(this, this.document);
