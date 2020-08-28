/*
 * QUIZ
 * buzzers.js
 * 
 */

(function(window, document, undefined) {
	
	'use strict';
	
	const socket = io();
	socket.emit('connection_receiver');
	
	var is_meta_keydown = function(e) {
		return e.originalEvent.keyCode === undefined || e.originalEvent.metaKey || e.originalEvent.ctrlKey || e.originalEvent.altKey;
	};
	
	var buzzer_keydown = function(e) {
		
		if (is_meta_keydown(e) || e.originalEvent.keyCode == 27 || e.originalEvent.keyCode == 32) // Esc / Space
			return;
		
		e.preventDefault();
		
		socket.emit('buzzer_press', e.originalEvent.keyCode);
		
	};
	
	$(window).on('keydown', buzzer_keydown);
	
})(this, this.document);
