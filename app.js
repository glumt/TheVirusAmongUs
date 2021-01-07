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

const players = {};

io.on('connection', function(socket) {
	console.log('a user connected: ', socket.id);

	// create a new player and add it to our players object
	players[socket.id] = {
		flipX: false,
		//x: Math.floor(Math.random() * 400) + 50,
		//y: Math.floor(Math.random() * 500) + 50,
		x: 50,
		y: 100,
		playerId: socket.id
	};

	// send the players object to the new player
	socket.emit('currentPlayers', players);
	// update all other players of the new player
	socket.broadcast.emit('newPlayer', players[socket.id]);

	// when a player disconnects, remove them from our players object
	socket.on('disconnect', function() {
		console.log('user disconnected: ', socket.id);
		delete players[socket.id];
		// emit a message to all players to remove this player
		io.emit('disconnect', socket.id);
	});

	// when a plaayer moves, update the player data
	socket.on('playerMovement', function(movementData) {
		players[socket.id].x = movementData.x;
		players[socket.id].y = movementData.y;
		players[socket.id].flipX = movementData.flipX;
		// emit a message to all players about the player that moved
		socket.broadcast.emit('playerMoved', players[socket.id]);
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
