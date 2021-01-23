/**
 * 
 */
// reads in our .env file and makes those values available as environment variables

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const formidable = require('formidable');


// create an instance of an express app
const app = express();

const server = require('http').Server(app);
const io = require('socket.io')(server);

var gameRooms = {
}

io.on('connection', function(socket) {
	console.log('a user connected: ', socket.id);

	// Waiting room communication
	socket.on("isKeyValid", function(input) {
		const keyArray = Object.keys(gameRooms)
			? socket.emit("keyIsValid", input)
			: socket.emit("keyNotValid");
	});

	socket.on("getRoomKey", async function() {
		let key = keyGenerator();

		if (!(key in gameRooms)) {
			gameRooms[key] = {
				roomKey: key,
				randomTasks: [],
				gameScore: 0,
				scores: {},
				players: {},
				ready: {},
				noPlayers: 0,
			};
		};
		socket.emit("roomCreated", key);
	});

	socket.on("joinRoom", (roomKey) => {
		socket.join(roomKey);
		console.log("join room ", roomKey, socket.id)

		gameRooms[roomKey].players[socket.id] = {
			x: 50,
			y: 100,
			playerId: socket.id
		};
		gameRooms[roomKey].noPlayers = Object.keys(gameRooms[roomKey].players).length;
		gameRooms[roomKey].ready[socket.id] = false;

		//sending to sender-client only
		socket.emit("setState", gameRooms[roomKey]);

		socket.emit("currentPlayers", {
			players: gameRooms[roomKey].players,
		});

		// update all other players of the new player
		socket.broadcast.to(roomKey).emit('newPlayer', {
			players: gameRooms[roomKey].players[socket.id],
		});
	});

	// Lobby and Game Communication

	// Check if all players are ready to play
	socket.on('playerReady', function(roomKey) {

		gameRooms[roomKey].ready[socket.id] = true;
		console.log(gameRooms[roomKey].ready)
		var allReady = Object.values(gameRooms[roomKey].ready).reduce((a, item) => a && item, true);

		if (allReady) {
			// send to all clients
			io.in(roomKey).emit('startGame', gameRooms[roomKey].players);
		}
	});

	socket.on('resetScene', function() {
		socket.emit('currentPlayers', players);
	});

	// when a plaayer moves, update the player data
	socket.on('playerMovement', function(movementData) {
		//console.log(movementData)
		gameRooms[movementData.roomKey].players[socket.id].x = movementData.x;
		gameRooms[movementData.roomKey].players[socket.id].y = movementData.y;
		// emit a message to all players about the player that moved
		socket.broadcast.to(movementData.roomKey).emit('playerMoved', gameRooms[movementData.roomKey].players[socket.id]);
	});

	// Other Communication

	// when a player disconnects, remove them from our players object
	socket.on('disconnecting', function() {

		let roomKey= 0;
		// remove from game object
		for (let roomKey of socket.rooms) {
			if (roomKey != socket.id) {
				delete gameRooms[roomKey].ready[socket.id];
				delete gameRooms[roomKey].players[socket.id];

				// emit a message to all players to remove this player
				io.in(roomKey).emit('disconnectPlayer', socket.id);
			}
		}
		console.log('user disconnected: ', socket.id);
	});
});

// update express settings
app.use(bodyParser.urlencoded({ extended: false })); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
app.use(cookieParser());

app.use(express.static(__dirname + '/public'));
//app.use(express.static('public'))

/*
app.get('/game.html', passport.authenticate('jwt', { session : false }), function (req, res) {
  res.sendFile(__dirname + '/public/game.html');
});
*/

app.get('/game.html', function(req, res) {
	res.sendFile(__dirname + '/public/index.html');
	//res.sendFile(__dirname + '/index.html');
});

app.use('/fileupload', function(req, res) {

	var form = new formidable.IncomingForm();
	form.parse(req, function(err, fields, files) {
		// oldpath : temporary folder to which file is saved to
		var oldpath = files.filetoupload.path;
		//var newpath = upload_path + files.filetoupload.name;

		var newpath = "public/game.json"
		// copy the file to a new location
		fs.copyFile(oldpath, newpath, (err) => {
			if (err) {
				console.log("Error Found:", err);
			}
			else {

				// Get the current filenames 
				// after the function 
				getCurrentFilenames();
				console.log("\nFile Contents of copied_file:",
					fs.readFileSync(newpath, "utf8"));
			}
		});

		//res.write('File uploaded and moved!');
		res.end();
	});
});


app.get('/admin.html', function(req, res) {
	res.sendFile(__dirname + '/public/admin.html');
	//res.sendFile(__dirname + '/index.html');
});

function getCurrentFilenames() {
	console.log("\nCurrent filenames:");
	fs.readdirSync(__dirname).forEach(file => {
		console.log(file);
	});
}

function keyGenerator() {
	let code = "";
	let chars = "abcdefghjklmnpqrstuvwxyz0123456789";
	for (let i = 0; i < 4; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

/*
// catch all other routes
app.use((req, res, next) => {
	res.status(404).json({ message: '404 - Not Found' });
});

// handle errors
app.use((err, req, res, next) => {
	console.log(err.message);
	res.status(err.status || 500).json({ error: err.message });
});
*/

// have the server start listening on the provided port
server.listen(process.env.PORT || 3000, () => {
	console.log(`Server started on port ${process.env.PORT || 3000}`);
});
