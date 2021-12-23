const express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	fs = require('fs'),
	ip = require('ip'),

	port = 8080,
	views_dir = '/views';

app.use('/static', express.static(__dirname + '/static'));
app.use('/media', express.static(__dirname + '/media'));

// No favicon to serve
app.use(function(req, res, next) {
	if (req.originalUrl && req.originalUrl.split('/').pop().includes('favicon'))
		return res.sendStatus(204);
	return next();
});

app.get('/', function (req, res) {
	res.redirect('/buzzers');
});

app.get('/player', function (req, res) {
	res.sendFile(__dirname + views_dir + '/player.html');
});

app.get('/admin', function (req, res) {
	res.sendFile(__dirname + views_dir + '/admin.html');
});

app.get('/receiver', function (req, res) {
	res.sendFile(__dirname + views_dir + '/receiver.html');
});

app.get('/buzzers(/[0-9]+)?', function (req, res) {
	res.sendFile(__dirname + views_dir + '/buzzers.html');
});

const rawdata = [
	fs.readFileSync(__dirname + '/media/_data/quiz.json'),
	fs.readFileSync(__dirname + '/media/_data/teams.json'),
	fs.readFileSync(__dirname + '/media/_data/scores.json')
];

const riddles = JSON.parse(rawdata[0]),
	teams = JSON.parse(rawdata[1]),
	scores = JSON.parse(rawdata[2]);

var buzzers_enabled = true;

io.sockets.on('connection', function (socket) {
	
	/* Connections */
	
	socket.on('connection_player', function() {
		console.info('Player connected');
		socket.emit('update_scores', scores);
		socket.emit('set_buzzers_enabled', buzzers_enabled);
	});
	
	socket.on('connection_admin', function() {
		console.info('Admin connected');
		socket.emit('update_scores', scores);
		socket.emit('set_buzzers_enabled', buzzers_enabled);
	});
	
	socket.on('connection_receiver', function() {
		console.info('Receiver connected');
	});
	
	socket.on('connection_buzzer', function(team_id) {
		if (teams[team_id] !== undefined)
			console.info('Buzzer #' + team_id + ' (' + teams[team_id].name + ') connected');
		else
			console.info('Buzzer of undefined team tried to connect: #' + team_id);
	});
	
	/* Single score change (inc) and update */
	
	socket.on('change_score', function(data) {
		
		var team_id = data.team_id,
			inc = data.inc;
		
		if (teams[team_id] === undefined)
			return;
		
		scores[team_id] = parseInt(scores[team_id]) + parseInt(inc);
		
		send_scores();
		socket.broadcast.emit('change_score', {team_id: team_id, inc: inc});
		
	});
	
	socket.on('reset_scores', function(data) {
		
		for (let i in scores)
			scores[i] = 0;
		
		send_scores();
		
	});
	
	socket.on('update_score', function(data) {
		
		var team_id = data.team_id,
			score = data.score;
		
		if (teams[team_id] === undefined)
			return;
		
		scores[team_id] = parseInt(score);
		
		send_scores();
		
	});
	
	var send_scores = function() {
		
		fs.writeFileSync(__dirname + '/media/_data/scores.json', JSON.stringify(scores));
		
		socket.emit('update_scores', scores);
		socket.broadcast.emit('update_scores', scores);
		
	};
	
	/* Riddle change */
	
	socket.on('get_current_riddle', function() {
		socket.broadcast.emit('get_current_riddle');
	});
	
	socket.on('riddle_change', function(riddle_num) {
		socket.broadcast.emit('riddle_change', riddle_num);
	});
	
	socket.on('riddle_request_change', function(riddle_num) {
		socket.broadcast.emit('riddle_request_change', riddle_num);
	});
	
	/* Buzzer change */
	
	socket.on('change_buzzer', function(team_id) {
		socket.broadcast.emit('change_buzzer', team_id);
	});
	
	/* Buzzer trigger */
	
	socket.on('buzzer_press', function(team_keycode) {
		socket.broadcast.emit('buzzer_press', team_keycode);
	});
	
	/* Buzzer activation */
	
	socket.on('set_buzzers_enabled', function(enabled) {
		buzzers_enabled = enabled;
		socket.broadcast.emit('set_buzzers_enabled', buzzers_enabled);
	});
	
	/* Shortcut trigger in admin */
	
	socket.on('shortcut_press', function(keycode) {
		socket.broadcast.emit('shortcut_press', keycode);
	});
	
	socket.on('player_interact_state', function(interacted) {
		socket.broadcast.emit('player_interact_state', interacted);
	});
	
	/* QR Code Helper get IP */
	
	socket.on('get_local_ip', function(callback) {
		callback(ip.address(), port);
	});
	
});

server.listen(port);

var url = 'http://' + ip.address() + ':' + port;
console.info('Quiz server ready.\nPlayer: '+url+'/player \nAdmin: '+url+'/admin \nMobile buzzers: '+url+' (/buzzers) \nBuzzer receiver: '+url+'/receiver');
