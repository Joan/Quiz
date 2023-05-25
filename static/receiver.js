/*
 * QUIZ
 * buzzers.js
 * 
 */

(function(window, document, undefined) {
	
	'use strict';
	
	const socket = io();
	
	const teams_keycodes = [];
	
	const init = function(data) {
		
		for (let i in data.teams)
			teams_keycodes.push(data.teams[i].keycode);
		
		$(window).on('keydown', keydown_handler);
		
	};
	
	socket.on('init_data', function(data) {
		init(data);
	});
	
	const keydown_handler = function(e) {
		
		var keycode = e.originalEvent.keyCode;
		
		if (keycode === undefined || e.originalEvent.metaKey || e.originalEvent.ctrlKey || e.originalEvent.altKey || e.originalEvent.shiftKey)
			return;
		
		if (teams_keycodes.includes(keycode)) {
			e.preventDefault();
			socket.emit('buzzer_press', keycode);
			return;
		}
		
	};
	
	$(function() {
		socket.emit('connection_receiver');
	});
	
})(this, this.document);
