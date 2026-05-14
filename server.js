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
      data_dir    = path.join(__dirname, argvs.data_dir ? argvs.data_dir : 'data'),
      media_dir   = path.join(__dirname, argvs.media_dir ? argvs.media_dir : 'media'),
      _media_dir  = path.join(__dirname, argvs.data_dir ? argvs.data_dir : 'data', 'temp_media'),
      admin_route = '/' + (argvs.admin_route ? argvs.admin_route : 'admin');

app.use('/data', express.static(data_dir));
app.use('/media', express.static(media_dir));
app.use('/_media', express.static(_media_dir));
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

app.get(['/buzzers', '/buzzers/:id'], function (req, res) {
	res.render('touch_buzzer');
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
};

const save_scores = function() {
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
	teams_buzzers: Array.from({length: teams.length}, () => []),
	buzzers: []
};

// Default settings
var settings = {
	buzzers_enabled: true,
	single_buzz: false,
	large_scoreboard: false,
	loop_media: false,
	video_end_visible: false
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
		    reg;
		
		if (url && host) {
			let path = url.slice(url.indexOf(host) + host.length);
			reg = /\/(\w+)\/?(\w*)/g.exec(path);
			socket.client_view = reg[1];
			socket.client_subview = reg[2];
			if (socket.client_view === 'buzzers')
				socket.client_view = 'touch_buzzer'; // Touch buzzers are at the `buzzers` route.
		}
		// Without any referer, assuming this is a buzzers bridge
		else
			socket.client_view = 'buzzers';
		
	}
	
	const update_clients = function() {
		io.emit('update_clients', {
			players: clients.players.length,
			teams_buzzers: clients.teams_buzzers.map(a => a.length)
		});
	};
	
	/* Connections */
	
	socket.on('connection_player', function() {
		
		socket.emit('init_data', {
			riddles,
			teams,
			scores,
			intro_poster,
			shortcuts,
			settings
		});
		
		clients.players.push(socket.id);
		update_clients();
		console.info('Player connected');
		
	});
	
	socket.on('connection_admin', function() {
		
		socket.emit('init_data', {
			riddles,
			teams,
			scores,
			shortcuts,
			settings
		});
		
		clients.admins.push(socket.id);
		console.info('Admin connected');
		
	});
	
	socket.on('connection_receiver', function() {
		
		socket.emit('init_data', {
			teams,
			shortcuts
		});
		
		console.info('Receiver connected');
		
	});
	
	socket.on('connection_touch_buzzer', function(team_id) {
		
		socket.emit('init_data', {
			teams
		});
		
		if (teams[team_id] !== undefined) {
			
			clients.teams_buzzers[team_id].push(socket.id);
			update_clients();
			console.info(`Touch buzzer of team ${teams[team_id].name} (#${team_id}) connected`);
			
		}
		else if (team_id === null) {
			// console.info('Touch buzzer list displayed');
		}
		else
			console.error('Touch buzzer of undefined team tried to connect: #' + team_id);
		
	});
	
	socket.on('connection_buzzers', function(bz) {
		
		clients.buzzers.push(socket.id);
		console.info(`Buzzers connected: Xbox BB ${bz.xbox_bb ? '✓' : '✗'} | PS3 Wbuzz ${bz.ps3_wbuzz ? '✓' : '✗'}`);
		
	});
	
	/* Disconnections */
	
	socket.on('disconnect', () => {
		
		var [client_key, client_name] = ({
			player: ['players', 'Player'],
			admin: ['admins', 'Admin'],
			buzzers: ['buzzers', 'Buzzers'],
			receiver: ['receiver', 'Receiver']
		}[socket.client_view] ?? [socket.client_view, '']);
		
		switch (socket.client_view) {
			case 'player':
			case 'admin':
			case 'buzzers':
				clients[client_key].splice(clients[client_key].indexOf(socket.id), 1);
			case 'receiver':
				console.info(client_name + ' disconnected');
				break;
			case 'touch_buzzer':
				if (socket.client_subview) {
					clients.teams_buzzers[socket.client_subview].splice(clients.teams_buzzers[socket.client_subview].indexOf(socket.id), 1);
					console.info(`Touch buzzer of team ${teams[socket.client_subview].name} (#${socket.client_subview}) disconnected`);
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
	
	socket.on('team_keycode_press', function(keycode) {
		socket.broadcast.emit('team_keycode_press', keycode);
	});
	
	socket.on('buzzer_press', function(data) {
		if (data.buzzer)
			socket.broadcast.emit('buzzer_press', data.buzzer);
	});
	
	/* Settings and controls */
	
	socket.on('set_setting', (setting, val) => {
		settings[setting] = val;
		socket.broadcast.emit('set_setting', setting, val);
	});
	
	socket.on('control', function(command) {
		socket.broadcast.emit('control', command);
	});
	
	socket.on('update_control_state', function(command, state) {
		socket.broadcast.emit('update_control_state', command, state);
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
	
	socket.on('teams_edited', function(teams_data) {
		
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
Touch buzzers: ${url} (/buzzers)
Keycodes receiver: ${url}/receiver`);
