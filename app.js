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

const noTasksPerPlayer = 5;

io.on('connection', function (socket) {
	console.log('a user connected: ', socket.id);

	// debugging ping
	socket.on('ping', function (data) {
		socket.emit('pong', data.ts);
	});

	// Waiting room communication
	socket.on("isKeyValid", function (input) {
		console.log(input)

		if (input in gameRooms) {
			socket.emit("keyIsValid", input)
		} else {
			socket.emit("keyNotValid");
		}
	});

	socket.on("getRoomKey", async function () {
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
			console.log("Create game room: ", key)
		};
		socket.emit("roomCreated", key);
	});

	socket.on("joinRoom", (roomKey) => {
		socket.join(roomKey);
		console.log("join room ", roomKey, socket.id)

		const x = Math.floor(Math.random() * 320);
		const y = Math.floor(Math.random() * 170);

		gameRooms[roomKey].players[socket.id] = {
			x: x,
			y: y,
			playerId: socket.id,
			vote: -1,
			alive: true,
			direction: 'idle',
		};
		gameRooms[roomKey].noPlayers = Object.keys(gameRooms[roomKey].players).length;
		gameRooms[roomKey].players[socket.id].colorId = gameRooms[roomKey].noPlayers;
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

	// Lobby

	// Check if all players are ready to play
	socket.on('playerReady', function (roomKey) {

		gameRooms[roomKey].ready[socket.id] = true;
		var allReady = Object.values(gameRooms[roomKey].ready).reduce((a, item) => a && item, true);

		if (allReady) {
			// start the game on all clients
			const virusID = Math.floor(Math.random() * gameRooms[roomKey].noPlayers)

			gameRooms[roomKey].virusSocketId = Object.keys(gameRooms[roomKey].players)[virusID];
			gameRooms[roomKey].noTasks = (gameRooms[roomKey].noPlayers - 1) * noTasksPerPlayer;

			io.in(roomKey).emit('startGame', {
				players: gameRooms[roomKey].players,
				virusID: Object.keys(gameRooms[roomKey].players)[virusID],
				noTasks: gameRooms[roomKey].noTasks
			});
		}
	});

	socket.on('resetScene', function () {
		socket.emit('currentPlayers', players);
	});

	// Game Communication
	socket.on('playerMovement', function (movementData) {
		//console.log(movementData)
		gameRooms[movementData.roomKey].players[socket.id].x = movementData.x;
		gameRooms[movementData.roomKey].players[socket.id].y = movementData.y;
		gameRooms[movementData.roomKey].players[socket.id].direction = movementData.dir;
		// emit a message to all players about the player that moved
		/*
		console.log(gameRooms[movementData.roomKey].players[socket.id])
		console.log("sending: " + memorySizeOf(gameRooms[movementData.roomKey].players[socket.id]))
		*/
		socket.broadcast.to(movementData.roomKey).emit('playerMoved', gameRooms[movementData.roomKey].players[socket.id]);
	});

	socket.on('taskComplete', function (roomKey) {
		gameRooms[roomKey].gameScore += 1

		// emit number of completed tasks
		io.in(roomKey).emit('updateCompletedTasks', gameRooms[roomKey].gameScore)

		// finish the game
		if (gameRooms[roomKey].gameScore == gameRooms[roomKey].noTasks) {
			io.in(roomKey).emit('gameFinish', true)
		}
	});

	// virus kills
	socket.on('reportKill', function (data) {
		io.in(data.roomKey).emit('startVote', gameRooms[data.roomKey].players)
	});

	socket.on('killPlayer', function (data) {
		gameRooms[data.roomKey].players[data.playerId].alive = false;
		io.in(data.roomKey).emit('deactivatePlayer', data.playerId)

		// check if all players (except virus) are dead
		var allPlayerDead = true;
		var players = Object.values(gameRooms[data.roomKey].players);
		for (let p of players) {
			if (p.playerId == gameRooms[data.roomKey].virusSocketId) {
				continue
			}
			if (p.alive) {
				allPlayerDead = false;
				break
			}
		}

		// finish the game
		if (allPlayerDead) {
			io.in(data.roomKey).emit('gameFinish', false)
		}
	});

	// Voting
	socket.on('vote', function (data) {
		console.log(data)

		gameRooms[data.roomKey].players[socket.id].vote = data.vote;

		console.log(gameRooms[data.roomKey].players)
		console.log("check votes")

		var players = Object.values(gameRooms[data.roomKey].players);
		const noPlayers = Object.keys(players).length;
		var noVotes = 0;
		var noDead = 0;
		for (let p of players) {
			if (!p.alive) {
				noDead += 1;
				continue
			}

			console.log(p)
			if (p.vote > 0) {
				noVotes += 1;
			}
		}

		io.in(data.roomKey).emit('updateVoteCount', noVotes);

		if (noVotes == (noPlayers - noDead)) {
			console.log("all have voted")
			// count votes
			var voteCount = [];
			var noVotes = gameRooms[data.roomKey].noPlayers;
			// Init array 
			while (noVotes--) voteCount[noVotes] = 0;

			for (let p of players) {
				if (p.vote == -1) {
					continue
				}
				voteCount[p.vote - 1] += 1;
			}

			// check for tie in vote => no killing
			const maxVotes = Math.max(...voteCount);
			var count = 0;
			// check if any player has the same amount of votes which is a tie
			for (var i = 0; i < voteCount.length; ++i) {
				if (voteCount[i] == maxVotes) {
					count++;
				}
			}

			// reset votes
			for (let p of players) {
				p.vote = -1;
			}

			if (count > 1) {
				// emit no vote kill
				io.in(data.roomKey).emit('voteKill', { playerId: -1 });
			} else {
				// determine playerId for voted kill
				var votedPlayerNum = voteCount.indexOf(Math.max(...voteCount)) + 1;
				for (let p of players) {
					if (p.colorId == votedPlayerNum) {
						// send to all clients
						console.log(p.playerId)
						io.in(data.roomKey).emit('voteKill', {
							playerId: p.playerId
						});
					}
				}
			}
		}
	});

	// Other Communication
	// when a player disconnects, remove them from our players object
	socket.on('disconnecting', function () {

		let roomKey = 0;
		// remove from game object
		for (let roomKey of socket.rooms) {
			if (roomKey != socket.id) {
				delete gameRooms[roomKey].ready[socket.id];
				delete gameRooms[roomKey].players[socket.id];
				gameRooms[roomKey].noPlayers = gameRooms[roomKey].noPlayers - 1;

				// emit a message to all players to remove this player
				io.in(roomKey).emit('disconnectPlayer', socket.id);
				console.log('user disconnected: ', socket.id);

				// close game room if no players are present
				if (gameRooms[roomKey].noPlayers == 0) {
					delete gameRooms[roomKey];
					console.log('close game room: ', roomKey);
				}
				break
			}
		}
	});
});

// update express settings
/*
app.use(bodyParser.urlencoded({ extended: false })); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
*/
app.use(cookieParser());

app.use(express.static(__dirname + '/public'));
//app.use(express.static('public'))

/*
app.get('/game.html', passport.authenticate('jwt', { session : false }), function (req, res) {
  res.sendFile(__dirname + '/public/game.html');
});
*/

app.get('/game.html', function (req, res) {
	res.sendFile(__dirname + '/public/index.html');
	//res.sendFile(__dirname + '/index.html');
});

app.use('/fileupload', function (req, res) {

	var form = new formidable.IncomingForm();
	form.parse(req, function (err, fields, files) {
		// oldpath : temporary folder to which file is saved to
		//console.log(files)
		var oldpath = files.filetoupload.path;
		//var newpath = upload_path + files.filetoupload.name;

		var newpath = "public/game.json"
		// copy the file to a new location
		fs.copyFile(oldpath, newpath, (err) => {
			if (err) {
				console.log("Error Found:", err);
			}
			else {
				// Get the current filenames after the function 
				//getCurrentFilenames();
				console.log("\nFile Contents of copied_file:",
					fs.readFileSync(newpath, "utf8"));
			}
		});

		/*
				res.write('File uploaded and moved!');
				res.end();
				*/
		res.sendFile(__dirname + '/public/uploadFinish.html');
	});
});


app.get('/admin.html', function (req, res) {
	res.sendFile(__dirname + '/public/admin.html');
	//res.sendFile(__dirname + '/index.html');
});

function getCurrentFilenames() {
	var fileList = []
	fs.readdirSync(__dirname).forEach(file => {
		fileList.push(file);
	});
	return fileList
}

function keyGenerator() {
	let code = "";
	let chars = "abcdefghjklmnpqrstuvwxyz0123456789";
	for (let i = 0; i < 4; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}

	const fileList = getCurrentFilenames();
	if (fileList.indexOf("test") >= 0) {
		//do something
		code = 'test';
	}
	return code;
}

// catch all other routes
app.use((req, res, next) => {
	res.status(404).json({ message: '404 - Not Found' });
});

// handle errors
app.use((err, req, res, next) => {
	console.log(err.message);
	res.status(err.status || 500).json({ error: err.message });
});

// have the server start listening on the provided port
server.listen(process.env.PORT || 3000, () => {
	console.log(`Server started on port ${process.env.PORT || 3000}`);
});

//Error handler
process.on('uncaughtException', function (exception) {
	// handle or ignore error
	console.log(exception);
});


function memorySizeOf(obj) {
	var bytes = 0;

	function sizeOf(obj) {
		if (obj !== null && obj !== undefined) {
			switch (typeof obj) {
				case 'number':
					bytes += 8;
					break;
				case 'string':
					bytes += obj.length * 2;
					break;
				case 'boolean':
					bytes += 4;
					break;
				case 'object':
					var objClass = Object.prototype.toString.call(obj).slice(8, -1);
					if (objClass === 'Object' || objClass === 'Array') {
						for (var key in obj) {
							if (!obj.hasOwnProperty(key)) continue;
							sizeOf(obj[key]);
						}
					} else bytes += obj.toString().length * 2;
					break;
			}
		}
		return bytes;
	};

	function formatByteSize(bytes) {
		if (bytes < 1024) return bytes + " bytes";
		else if (bytes < 1048576) return (bytes / 1024).toFixed(3) + " KiB";
		else if (bytes < 1073741824) return (bytes / 1048576).toFixed(3) + " MiB";
		else return (bytes / 1073741824).toFixed(3) + " GiB";
	};

	return formatByteSize(sizeOf(obj));
};
