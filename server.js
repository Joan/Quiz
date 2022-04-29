/*
 * Server setup
 *
 */

const express = require('express'),
      http = require('http'),
      fs = require('fs'),
      ip = require('ip');

const app = express(),
      server = http.createServer(app),
      {Server} = require('socket.io'),
      io = new Server(server);

// Process script arguments
var argvs = {};
process.argv.slice(2).forEach(arg => {
	let spl = arg.split(/:|=/)
	argvs[spl[0]] = spl[1];
});

const port = 8080,
      views_dir = '/views',
      admin_route = argvs.admin_route ? argvs.admin_route : 'admin';

app.use('/data', express.static(__dirname + '/_data'));
app.use('/media', express.static(__dirname + '/_media'));
app.use('/static', express.static(__dirname + '/static'));

/*
 * Routes
 *
 */

app.get('/', function (req, res) {
	res.redirect('/buzzers');
});

app.get('/player', function (req, res) {
	res.sendFile(__dirname + views_dir + '/player.html');
});

app.get('/' + admin_route, function (req, res) {
	res.sendFile(__dirname + views_dir + '/admin.html');
});

app.get('/receiver', function (req, res) {
	res.sendFile(__dirname + views_dir + '/receiver.html');
});

app.get('/buzzers(/[0-9]+)?', function (req, res) {
	res.sendFile(__dirname + views_dir + '/buzzers.html');
});

// No favicon to serve (send 204 No-content status)
app.use(function(req, res, next) {
	if (req.originalUrl && req.originalUrl.split('/').pop().includes('favicon'))
		return res.sendStatus(204);
	return next();
});

/*
 * Data retrieval
 *
 */

const files = {
	quiz:   __dirname + '/_data/quiz.json',
	teams:  __dirname + '/_data/teams.json',
	scores: __dirname + '/_data/scores.json',
	intro_poster: __dirname + '/_media/intro-poster.png'
};

var riddles = JSON.parse(fs.readFileSync(files.quiz)),
    teams   = JSON.parse(fs.readFileSync(files.teams)),
    scores  = JSON.parse(fs.readFileSync(files.scores));

/*
 * Scores management
 *
 */

// Write scores and teams

const save_teams = function() {
	fs.writeFileSync(files.teams, JSON.stringify(teams, null, "\t"));
},

save_scores = function() {
	fs.writeFileSync(files.scores, JSON.stringify(scores));
};

// Check if scores match teams number (and fix)

const check_scores_consistency = function() {
	if (teams.length !== scores.length) {
		var less_scores = teams.length > scores.length;
		while (teams.length !== scores.length)
			less_scores ? scores.push(0) : scores.pop();
		save_scores();
	}
};

check_scores_consistency();

/*
 * Misc
 *
 */

// Check for intro_poster
try {
	fs.accessSync(files.intro_poster);
	var has_intro_poster = true;
} catch (err) {
	var has_intro_poster = false;
}

// Default buzzer activation
var buzzers_enabled = true;

/*
 * Socket events
 *
 */

io.on('connection', function(socket) {
	
	/* Connections */
	
	socket.on('connection_player', function() {
		
		socket.emit('init_data', {
			riddles: riddles,
			teams: teams,
			scores: scores,
			buzzers_enabled: buzzers_enabled,
			has_intro_poster: has_intro_poster
		});
		
		console.info('Player connected');
	});
	
	socket.on('connection_admin', function() {
		
		socket.emit('init_data', {
			riddles: riddles,
			teams: teams,
			scores: scores,
			buzzers_enabled: buzzers_enabled
		});
		
		console.info('Admin connected');
	});
	
	socket.on('connection_receiver', function() {
		console.info('Receiver connected');
	});
	
	socket.on('connection_buzzer', function(team_id) {
		
		socket.emit('init_data', {
			teams: teams
		});
		
		if (teams[team_id] !== undefined)
			console.info(`Buzzer #${team_id} (${teams[team_id].name}) connected`);
		else if (team_id === null)
			console.info('Buzzer list displayed');
		else
			console.error('Buzzer of undefined team tried to connect: #' + team_id);
	});
	
	/* Single score change (inc) and update */
	
	const update_scores = function() {
		save_scores();
		socket.emit('update_scores', scores);
		socket.broadcast.emit('update_scores', scores);
	};
	
	socket.on('change_score', function(data) {
		
		var team_id = data.team_id,
			inc = data.inc;
		
		if (teams[team_id] === undefined)
			return;
		
		scores[team_id] = parseInt(scores[team_id]) + parseInt(inc);
		
		update_scores();
		socket.broadcast.emit('change_score', {team_id: team_id, inc: inc});
		
	});
	
	socket.on('reset_scores', function(data) {
		
		for (let i in scores)
			scores[i] = 0;
		
		update_scores();
		
	});
	
	socket.on('update_score', function(data) {
		
		var team_id = data.team_id,
			score = data.score;
		
		if (teams[team_id] === undefined)
			return;
		
		scores[team_id] = parseInt(score);
		
		update_scores();
		
	});
	
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
	
	/* Buzzers */
	
	socket.on('change_buzzer', function(team_id) {
		socket.broadcast.emit('change_buzzer', team_id);
	});
	
	socket.on('buzzer_press', function(team_keycode) {
		socket.broadcast.emit('buzzer_press', team_keycode);
	});
	
	// Buzzer activation
	
	socket.on('set_buzzers_enabled', function(enabled) {
		buzzers_enabled = enabled;
		socket.broadcast.emit('set_buzzers_enabled', buzzers_enabled);
	});
	
	/* Shortcut triggers in admin */
	
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
	
	/* Team edition */
	
	socket.on('team_added', function(team_data) {
		
		teams.push(team_data);
		scores.push(0);
		check_scores_consistency();
		
		save_teams();
		socket.broadcast.emit('update_teams', teams);
		update_scores();
		
	});
	
	socket.on('team_deleted', function(team_id) {
		
		teams.splice(team_id, 1);
		scores.splice(team_id, 1);
		check_scores_consistency();
		
		save_teams();
		socket.broadcast.emit('update_teams', teams);
		update_scores();
		
	});
	
	socket.on('team_edited', function(teams_data) {
		
		teams = teams_data;
		check_scores_consistency();
		
		save_teams();
		socket.broadcast.emit('update_teams', teams);
		update_scores();
		
	});
	
});

/*
 * Server init
 *
 */

server.listen(port);

var url = 'http://' + ip.address() + ':' + port;
console.info(`Quiz server ready.
Player: ${url}/player
Admin: ${url}/${admin_route}
Mobile buzzers: ${url} (/buzzers)
Buzzer receiver: ${url}/receiver`);