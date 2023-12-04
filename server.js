/*
 * Server setup
 *
 */

const http = require('http'),
      path = require('path'),
      fs = require('fs'),
      express = require('express'),
      ejs = require('ejs'),
      i18next = require('i18next'),
      i18next_backend = require('i18next-fs-backend'),
      i18next_middleware = require('i18next-http-middleware'),
      ip = require('ip');

const app = express(),
      server = http.createServer(app),
      {Server} = require('socket.io'),
      io = new Server(server);

// Process script arguments

var argvs = {};
process.argv.slice(2).forEach(arg => {
	let ind = arg.indexOf('=');
	argvs[arg.substring(0, ind)] = arg.substring(ind + 1);
});

// Set pathes and statics

const port = argvs.port ? argvs.port : 8080,
      static_dir  = path.join(__dirname, '/static'),
      views_dir   = path.join(__dirname, '/views'),
      data_dir    = path.join(__dirname, argvs.data_dir ? argvs.data_dir : '_data'),
      media_dir   = path.join(__dirname, argvs.media_dir ? argvs.media_dir : '_media'),
      admin_route = '/' + (argvs.admin_route ? argvs.admin_route : 'admin');

app.use('/data', express.static(data_dir));
app.use('/media', express.static(media_dir));
app.use('/static', express.static(static_dir));

app.engine('html', ejs.__express);
app.set('views', views_dir);
app.set('view engine', 'html');

// Initiate i18n

i18next
	.use(i18next_backend)
	.use(i18next_middleware.LanguageDetector)
	.init({
		preload: ['en', 'fr'],
		supportedLngs: ['en', 'fr'],
		nonExplicitSupportedLngs: true,
		fallbackLng: 'en',
		backend: {
			loadPath: path.join(views_dir, '/locales/{{ns}}-{{lng}}.json')
		}
	});

app.use(i18next_middleware.handle(i18next));

app.use((req, res, next) => {
	res.locals.locale = req.i18n.resolvedLanguage; // Set `locale` (as actually used language) globally
	next();
});

/*
 * Routes
 *
 */

app.get('/', function (req, res) {
	res.redirect('/buzzers');
});

app.get('/player', function (req, res) {
	res.render('player');
});

app.get(admin_route, function (req, res) {
	res.render('admin');
});

app.get('/receiver', function (req, res) {
	res.render('receiver');
});

app.get('/buzzers(/[0-9]+)?', function (req, res) {
	res.render('buzzers');
});

/*
 * Data retrieval
 *
 */

const files = {
	quiz:         path.join(data_dir, 'quiz.json'),
	teams:        path.join(data_dir, 'teams.json'),
	scores:       path.join(data_dir, 'scores.json'),
	intro_poster: path.join(data_dir, 'intro-poster')
};

var riddles = JSON.parse(fs.readFileSync(files.quiz, 'utf8') || '[]'),
    teams   = JSON.parse(fs.readFileSync(files.teams, 'utf8') || '[]'),
    scores  = JSON.parse(fs.readFileSync(files.scores, 'utf8') || '[]');

const shortcuts = {
	13: 'next',           // Enter ↩
	37: 'backward',       // Left ←
	39: 'forward',        // Right →
	32: 'play_pause',     // Space
	27: 'clear',          // Esc
	65: 'toggle_answer',  // A
	66: 'toggle_buzzers', // B
	81: 'toggle_qr',      // Q
	83: 'toggle_scores'   // S
};

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

// Clients registry
var clients = {
	players: [],
	admins: [],
	buzzers: Array.from({length: teams.length}, () => [])
};

// Default settings
var settings = {
	buzzers_enabled: true,
	single_buzz: false,
	large_scoreboard: false
};

// Check for intro_poster
var intro_poster = false;
if (fs.existsSync(files.intro_poster + '.png'))
	intro_poster = 'intro-poster.png';
else if (fs.existsSync(files.intro_poster + '.jpg'))
	intro_poster = 'intro-poster.jpg';

if (intro_poster)
	app.use('/media/' + intro_poster, express.static(path.join(data_dir, intro_poster)));

/*
 * Socket events
 *
 */

io.on('connection', function(socket) {
	
	/*
	socket.emit() → to the sender only
	socket.broadcast.emit() → to all clients except the sender
	io.emit() → to all clients
	*/
	
	{
		let url = socket.handshake.headers.referer,
		    host = socket.request.headers.host,
		    path = url.slice(url.indexOf(host) + host.length),
		    reg = /\/(\w+)\/?(\w*)/g.exec(path);
		
		socket.client_view = reg[1];
		socket.client_subview = reg[2];
	}
	
	const update_clients = function() {
		io.emit('update_clients', {
			players: clients.players.length,
			buzzers: clients.buzzers.map(a => a.length)
		});
	};
	
	/* Connections */
	
	socket.on('connection_player', function() {
		
		socket.emit('init_data', {
			riddles: riddles,
			teams: teams,
			scores: scores,
			intro_poster: intro_poster,
			shortcuts: shortcuts,
			settings: settings
		});
		
		clients.players.push(socket.id);
		update_clients();
		console.info('Player connected');
		
	});
	
	socket.on('connection_admin', function() {
		
		socket.emit('init_data', {
			riddles: riddles,
			teams: teams,
			scores: scores,
			shortcuts: shortcuts,
			settings: settings
		});
		
		clients.admins.push(socket.id);
		update_clients();
		console.info('Admin connected');
		
	});
	
	socket.on('connection_receiver', function() {
		
		socket.emit('init_data', {
			teams: teams
		});
		
		console.info('Receiver connected');
		
	});
	
	socket.on('connection_buzzer', function(team_id) {
		
		socket.emit('init_data', {
			teams: teams
		});
		
		if (teams[team_id] !== undefined) {
			
			clients.buzzers[team_id].push(socket.id);
			update_clients();
			console.info(`Buzzer #${team_id} (${teams[team_id].name}) connected`);
			
		} else if (team_id === null)
			console.info('Buzzer list displayed');
			
		else
			console.error('Buzzer of undefined team tried to connect: #' + team_id);
		
	});
	
	/* Disconnections */
	
	socket.on('disconnect', (reason) => {
		
		switch (socket.client_view) {
			case 'player':
			case 'admin':
				clients[`${socket.client_view}s`].splice(clients[`${socket.client_view}s`].indexOf(socket.id), 1);
				console.info(socket.client_view.charAt(0).toUpperCase() + socket.client_view.slice(1) + ' disconnected');
				break;
			case 'buzzers':
				if (socket.client_subview) {
					clients.buzzers[socket.client_subview].splice(clients.buzzers[socket.client_subview].indexOf(socket.id), 1);
					console.info(`Buzzer #${socket.client_subview} (${teams[socket.client_subview].name}) disconnected`);
				}
				break;
		}
		
		update_clients();
		
	});
	
	/* Single score change (inc) and update */
	
	const update_scores = function() {
		save_scores();
		io.emit('update_scores', scores);
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
	
	socket.on('get_player_state', function() {
		socket.broadcast.emit('get_player_state');
	});
	
	socket.on('riddle_change', function(riddle_num) {
		socket.broadcast.emit('riddle_change', riddle_num);
	});
	
	socket.on('riddle_request_change', function(riddle_num) {
		socket.broadcast.emit('riddle_request_change', riddle_num);
	});
	
	/* Buzzers */
	
	socket.on('update_buzzer', function(buzzer_data) {
		socket.broadcast.emit('update_buzzer', buzzer_data);
	});
	
	socket.on('buzzer_press', function(team_keycode) {
		socket.broadcast.emit('buzzer_press', team_keycode);
	});
	
	/* Settings and controls */
	
	socket.on('set_setting', (setting, val) => {
		settings[setting] = val;
		socket.broadcast.emit('set_setting', setting, val);
	});
	
	socket.on('control', function(command) {
		socket.broadcast.emit('control', command);
	});
	
	socket.on('update_control_alt', function(command, alt) {
		socket.broadcast.emit('update_control_alt', command, alt);
	});
	
	socket.on('update_player_activation_state', function(has_been_active) {
		socket.broadcast.emit('update_player_activation_state', has_been_active);
	});
	
	/* QR Code Helper get IP */
	
	socket.on('get_domain', function(callback) {
		callback(argvs.buzzer_domain ? argvs.buzzer_domain : `${ip.address()}:${port}`);
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
Admin: ${url}${admin_route}
Mobile buzzers: ${url} (/buzzers)
Buzzer receiver: ${url}/receiver`);