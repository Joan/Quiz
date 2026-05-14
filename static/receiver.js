/*
 * QUIZ
 * buzzers.js
 * 
 */

(function(window, document, undefined) {
	
	'use strict';
	
	const socket = io();
	
	var all_teams_keycodes = [],
	    all_shortcuts_keycodes = [];
	
	const update_teams_data = function(teams_data) {
		for (let i = 0, il = teams.length; i < il; i++)
			all_teams_keycodes.push(teams[i].buzzer_keycode);
	};
	
	const init = function(data) {
		
		for (const team of data.teams)
			all_teams_keycodes.push(team.buzzer_keycode);
		
		all_shortcuts_keycodes = Object.keys(data.shortcuts).map(Number);
		
		$(window).on('keydown', keydown_handler);
		
	};
	
	socket.on('init_data', function(data) {
		init(data);
	});
	
	socket.on('update_teams', function(teams_data) {
		update_teams_data(teams_data);
	});
	
	const keydown_handler = function(e) {
		
		var keycode = e.originalEvent.keyCode;
		
		if (keycode === undefined || e.originalEvent.metaKey || e.originalEvent.ctrlKey || e.originalEvent.altKey || e.originalEvent.shiftKey)
			return;
		
		if (all_teams_keycodes.includes(keycode)) {
			e.preventDefault();
			socket.emit('team_keycode_press', keycode);
			return;
		}
		
	};
	
	$(function() {
		socket.emit('connection_receiver');
	});
	
})(this, this.document);
