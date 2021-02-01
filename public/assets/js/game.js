const COLORS = {
	MAIN_BOX: Phaser.Display.Color.GetColor(7, 14, 145),
	MAIN_BOX_BORDER: Phaser.Display.Color.GetColor(222, 222, 222),
	RED: Phaser.Display.Color.GetColor(235, 0, 0),
	UI_TEXT: "rgb( 230, 230, 230)",
	UI_BOX: Phaser.Display.Color.GetColor(0, 158, 171),
	UI_BOX_BORDER: Phaser.Display.Color.GetColor(230, 230, 230),
};

class BootScene extends Phaser.Scene {
	constructor() {
		super({
			key: 'BootScene',
			active: true
		});
	}

	preload() {
		this.load.tilemapTiledJSON('map', 'assets/backgrounds/map.json');
		this.load.image('floorSheet', 'assets/spritesheet/floorSheet.png');
		this.load.image('wallSheet', 'assets/spritesheet/wallSheetE.png');
		this.load.image('chipSheet', 'assets/spritesheet/chipSheetE.png');
		this.load.image('hardwareSheet', 'assets/spritesheet/hardwareSheet.png');
		this.load.image('psuSheet', 'assets/spritesheet/psuSheet.png');
		this.load.image('cableSheet', 'assets/spritesheet/cableSheetE.png');
		this.load.image('collisionSheet', 'assets/spritesheet/collisionSheet.png');


		this.load.spritesheet('LCDTyp', 'assets/spritesheet/LCDTyp.png', { frameWidth: 50, frameHeight: 100 });

		this.load.image('lobby', 'assets/backgrounds/lobby.png');
	}

	create() {
		//this.scene.start('LobbyScene');
		this.scene.start('StartScene');
	}
}

class MultiplayerScene extends Phaser.Scene {
	constructor(sceneName) {
		super(sceneName);
		this.state = {};
	}

	// Partial class which not works on its own
	createMultiplayerIO() {

		this.otherPlayers = this.physics.add.group();

		this.socket.on('currentPlayers', function(data) {
			this.createAllPlayers(data.players);
		}.bind(this));

		this.socket.on('newPlayer', function(data) {
			this.addOtherPlayers(data.players);
		}.bind(this));

		this.socket.on('disconnectPlayer', function(playerId) {
			if (!this.sys.isActive()) {
				return
			}

			this.otherPlayers.getChildren().forEach(function(player) {
				if (playerId === player.playerId) {
					player.destroy();
					this.state.noPlayers -= 1;
				}
			}.bind(this));
		}.bind(this));

		this.socket.on('playerMoved', function(playerInfo) {
			if (!this.sys.isActive()) {
				return
			}

			this.otherPlayers.getChildren().forEach(function(player) {
				if (playerInfo.playerId === player.playerId) {
					player.setPosition(playerInfo.x, playerInfo.y);
				}
			}.bind(this));
		}.bind(this));

		this.socket.on('startGame', function(gameInfo) {
			this.scene.stop('LobbyScene');
			this.state.imposterID = gameInfo.imposterID;

			// start UI scene
			this.scene.launch("UIScene");
			// start Game
			this.scene.start('WorldScene', { socket: this.socket, players: gameInfo.players, state: this.state })
		}.bind(this));
	}


	createAllPlayers(players) {
		Object.keys(players).forEach((id) => {
			if (players[id].playerId == this.socket.id) {
				this.createPlayer(players[id]);
			} else {
				this.addOtherPlayers(players[id]);
			}
		});
	}

	addOtherPlayers(playerInfo) {
		var otherPlayer = this.add.sprite(playerInfo.x, playerInfo.y, 'LCDTyp');
		otherPlayer.setTint(Math.random() * 0xffffff);
		otherPlayer.playerId = playerInfo.playerId;
		this.otherPlayers.add(otherPlayer);
	}

	emitPlayerMovement() {
		var x = this.container.x;
		var y = this.container.y;

		if (this.container.oldPosition && (x !== this.container.oldPosition.x || y !== this.container.oldPosition.y)) {
			this.socket.emit('playerMovement', { x: this.container.x, y: this.container.y, roomKey: this.state.roomKey });
		}
		// save old position data
		this.container.oldPosition = {
			x: this.container.x,
			y: this.container.y,
		};
	}
}

class StartScene extends Phaser.Scene {
	constructor() {
		super('StartScene');
	}

	init() {
		this.socket = io();
	}

	preload() {
		this.load.html("roomform", "assets/text/codeform.html");
	}

	create() {

		initBoxes(this, COLORS.MAIN_BOX, COLORS.MAIN_BOX_BORDER);

		const textStyle = { color: COLORS.UI_TEXT, fontSize: "12px", fintStyle: "bold", align: "center" };
		var inX, inY = 0;

		// request key button
		[inX, inY] = createTextField(this, 140, 100, 130, 17);
		this.requestButton = this.add.text(inX, inY, "Request room key", textStyle);
		this.requestButton.setOrigin(0.5);
		this.requestButton.setInteractive();
		this.requestButton.on("pointerdown", () => {
			this.socket.emit("getRoomKey");
		});

		// non valid key text
		this.notValidText = this.add.text(160, 120, "", {
			fill: "#ff0000",
			fontSize: "12px",
		});


		// enter room key
		[inX, inY] = createTextField(this, 140, 130, 130, 50);
		this.inputElement = this.add.dom(inX, inY).createFromCache("roomform");
		this.inputElement.addListener("click");
		this.inputElement.setScale(0.8)
		this.inputElement.on("click", function(event) {
			if (event.target.name === "enterRoom") {
				const input = this.inputElement.getChildByName("roomform");
				this.socket.emit("isKeyValid", input.value);
			}
		}.bind(this));

		// room key text
		[inX, inY] = createTextField(this, 200, 100, 40, 17);
		this.roomKeyText = this.add.text(inX, inY, "", textStyle);
		this.roomKeyText.setOrigin(0.5);

		this.socket.on("roomCreated", function(roomKey) {
			this.roomKey = roomKey,
				this.roomKeyText.setText(this.roomKey);
			this.createJoinButton();
		}.bind(this));

		this.socket.on("keyNotValid", function() {
			this.notValidText.setText("Invalid room key");
		}.bind(this));

		this.socket.on("keyIsValid", function(input) {
			this.createJoinButton();
			this.roomKeyText.setText(input);
		}.bind(this));


		// Game Title
		const titlePosX = 20;
		const titlePosY = 10;

		const titleLine1 = this.add.text(titlePosX, titlePosY, "Among", { fontFamily: "Arial Black", fontSize: 32 });
		titleLine1.setStroke('#000000', 4);
		const gradient = titleLine1.context.createLinearGradient(0, 0, 0, titleLine1.height);
		/*
		gradient.addColorStop(0, '#111111');
		gradient.addColorStop(.5, '#ffffff');
		gradient.addColorStop(.5, '#aaaaaa');
		gradient.addColorStop(1, '#111111');
		*/
		gradient.addColorStop(0, '#1f72e2');
		gradient.addColorStop(.5, '#ffffff');
		gradient.addColorStop(.5, '#630c33');
		gradient.addColorStop(1, '#f01074');

		titleLine1.setFill(gradient);

		const titleLine2 = this.add.text(titlePosX + 10, titlePosY + 35, "the v!rUS", { fontFamily: "Arial Black", fontSize: 32 });
		titleLine2.setStroke('#000000', 4);
		titleLine2.setFill(gradient);
	}

	createJoinButton() {
		const textStyle = { color: COLORS.UI_TEXT, fontSize: "12px", fintStyle: "bold", align: "center" };
		var inX, inY = 0;

		[inX, inY] = createTextField(this, 200, 200, 80, 17);
		this.joinButton = this.add.text(inX, inY, "Join Room", textStyle);
		this.joinButton.setOrigin(0.5);
		this.joinButton.setInteractive();
		this.joinButton.on("pointerdown", () => { this.joinRoom() });
	}

	joinRoom() {
		this.scene.stop('StartScene');
		this.scene.start('LobbyScene', { socket: this.socket })
		setTimeout(() => {
			this.socket.emit("joinRoom", this.roomKeyText.text);
		}, 500);
	}
};


class LobbyScene extends MultiplayerScene {
	constructor() {
		super('LobbyScene');
	}

	init(data) {
		this.socket = data.socket;
		this.createMultiplayerIO();
	}

	create() {
		this.UIBoxBound = 170;

		this.createLobbyMap();

		this.cursors = this.input.keyboard.createCursorKeys();

		initBoxes(this, COLORS.MAIN_BOX, COLORS.MAIN_BOX_BORDER);

		const textStyle = { color: COLORS.UI_TEXT, fontSize: "18px", fintStyle: "bold", align: "center" };
		var inX, inY = 0;

		[inX, inY] = createTextField(this, 315, this.UIBoxBound, 310, 65);
		this.startText = this.add.text(inX, inY, "Start the Game!", textStyle);
		this.startText.setOrigin(0.5);
		this.startText.setInteractive({ useHandCursor: true });
		this.startText.on('pointerdown', () => this.emitReady());

		this.socket.on("setState", (state) => {
			this.state = state;
		});
	}

	emitReady() {
		this.socket.emit('playerReady', this.state.roomKey);
		this.startText.setText("Waiting...");
	}

	createLobbyMap() {
		this.add.image(100, 100, 'lobby');
		this.background = this.add.tileSprite(100, 100, 0, 0, 'lobby');

		this.physics.world.bounds.height = this.UIBoxBound;
	}

	createPlayer(playerInfo) {
		this.player = this.add.sprite(0, 0, 'LCDTyp');

		this.container = this.add.container(playerInfo.x, playerInfo.y)
		this.container.setSize(32, 32);
		this.physics.world.enable(this.container);
		this.container.add(this.player);

		this.container.body.setBounce(1);
		this.container.body.setCollideWorldBounds(true);
	}


	update(time, delta) {
		if (this.container) {
			if (this.cursors.left.isDown) {
				this.container.body.setVelocityX(-40);
				//this.player.anims.play('walk', true);
			}
			else if (this.cursors.right.isDown) {
				this.container.body.setVelocityX(40);
				//this.player.anims.play('walk', true);
			}

			// Vertical movement
			if (this.cursors.up.isDown) {
				this.container.body.setVelocityY(-40);
				//this.player.anims.play('walk', true);
			}
			else if (this.cursors.down.isDown) {
				this.container.body.setVelocityY(40);
				//this.player.anims.play('walk', true);
			}

			this.timer += delta;
			while (this.timer > 1000) {
				this.resources += 1;
				this.timer -= 1000;
			}
			this.background.tilePositionY += 5;

			// emit player movement
			this.emitPlayerMovement()
		}
	}
}


class WorldScene extends MultiplayerScene {
	constructor() {
		super('WorldScene');
	}

	init(data) {

		this.socket = data.socket;
		this.state = data.state;

		this.initPlayers = this.initStartPosition(data.players);
		this.currentBattle = "dummy"
		this.StationLen = 20;
	}

	initStartPosition(players) {
		Object.keys(players).forEach((id) => {
			players[id].x = 50;
			players[id].y = 100;
		});
		return players
	}

	//Elemente die im Spiel erzeugt werden.
	create() {
		initBoxes(this, COLORS.MAIN_BOX, COLORS.MAIN_BOX_BORDER);

		// create map
		this.createMap();

		// create player animations
		this.createAnimations();

		// user input
		this.cursors = this.input.keyboard.createCursorKeys();

		// create enemies
		this.createStations();


		// listen for web socket events
		this.createMultiplayerIO();
		this.createGameIO();

		this.createAllPlayers(this.initPlayers);
		this.events.emit('setNoTasks', Object.keys(this.initPlayers).length * 5);
	}

	createGameIO() {
		this.socket.on('updateCompletedTasks', (score) => {
			this.events.emit('completedTask', score);
		});

		this.socket.on('gameFinish', (data) => {
			// Defender win

			// Imposter wins

		});
	}


	createMap() {
		//Karte wird erstellt
		this.map = this.make.tilemap({ key: 'map' });

		//Texturvariable = Bild im Asset-Ordner (Tileset in der JSON-Map, dazugehöriges Bild im Assets-Ordner )
		var floorTiles = this.map.addTilesetImage('floorSet', 'floorSheet');
		var wallTiles = this.map.addTilesetImage('wallSet', 'wallSheet', 16, 16, 1, 2);
		var chipTiles = this.map.addTilesetImage('chipSet', 'chipSheet', 16, 16, 1, 2);
		var hardwareTiles = this.map.addTilesetImage('hardwareSet', 'hardwareSheet');
		var psuTiles = this.map.addTilesetImage('psuSet', 'psuSheet');
		var cableTiles = this.map.addTilesetImage('cableSet', 'cableSheet', 16, 16, 1, 2);
		var collisionTiles = this.map.addTilesetImage('collisionSet', 'collisionSheet');

		//Layervariable = erzeuge Statische Schicht (oder Objekt) (Name des Layers, Tileset in der JSON-Map, Position)
		var floorLayer = this.map.createStaticLayer('floorLayer', floorTiles, 0, 0);
		var wallLayer = this.map.createStaticLayer('wallLayer', wallTiles, 0, 0);
		var chipLayer = this.map.createStaticLayer('chipLayer', chipTiles, 0, 0);
		var hardwareLayer = this.map.createStaticLayer('hardwareLayer', hardwareTiles, 0, 0);
		var psuLayer = this.map.createDynamicLayer('psuLayer', psuTiles, 0, 0);
		var cableLayer = this.map.createStaticLayer('cableLayer', cableTiles, 0, 0);
		this.collisionLayer = this.map.createStaticLayer('collisionLayer', collisionTiles, 0, 0);


		//Collision der Layers
		this.collisionLayer.setCollisionByExclusion([-1]);
		//objects.setCollisionByExclusion([-1]);

		//Erzeugen der Kartengröße und Ränder
		this.physics.world.bounds.width = this.map.widthInPixels;
		this.physics.world.bounds.height = this.map.heightInPixels;
	}

	createAnimations() {
		//Erzeugen der Animation 
		this.anims.create({
			key: 'left',
			frames: this.anims.generateFrameNumbers('LCDTyp', { start: 23, end: 27 }),
			frameRate: 10,
			repeat: -1
		});

		this.anims.create({
			key: 'right',
			frames: this.anims.generateFrameNumbers('LCDTyp', { start: 30, end: 33 }),
			frameRate: 10,
			repeat: -1
		});

		this.anims.create({
			key: 'down',
			frames: this.anims.generateFrameNumbers('LCDTyp', { start: 16, end: 22 }),
			frameRate: 10,
			repeat: -1
		});

		this.anims.create({
			key: 'up',
			frames: this.anims.generateFrameNumbers('LCDTyp', { start: 3, end: 15 }),
			frameRate: 10,
			repeat: -1
		});
		
		this.anims.create({
			key: 'idle',
			frames: this.anims.generateFrameNumbers('LCDTyp', { start: 0, end: 2 }),
			frameRate: 0.5,
			repeat: -1
		});

	}


	createPlayer(playerInfo) {
		this.player = this.add.sprite(0, 0, 'LCDTyp');
		this.player.setScale(.3);

		this.container = this.add.container(playerInfo.x, playerInfo.y);
		this.container.setSize(16, 32);
		this.container.add(this.player);
		this.physics.world.enable(this.container);

		// update camera
		this.updateCamera();

		this.container.body.setCollideWorldBounds(true);

		this.physics.add.collider(this.container, this.collisionLayer);

		// add collider
		this.physics.add.overlap(this.container, this.stations, this.startTask, false, this);

		if (this.socket.id == this.state.imposterID) {
			this.events.emit('showImposter');
		}
	}

	//Erzeugen der Kamera
	updateCamera() {
		this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
		this.cameras.main.startFollow(this.container);
		this.cameras.main.roundPixels = true;
	}

	createStations() {
		var stationCoord = [
			[400, 80],
			[80, 80],
			[240, 240],
			[240, 430],
			[432, 302],
			[432, 465],
		];

		this.stations = this.physics.add.group({ classType: Phaser.GameObjects.Zone });
		for (var i = 0; i < stationCoord.length; i++) {
			var x = stationCoord[i][0]
			var y = stationCoord[i][1]
			this.stations.create(x, y, this.StationLen, this.StationLen);
		}

		// Generate n unique numbers for task selection
		var arr = [];
		while (arr.length < stationCoord.length) {
			var n = Math.floor(Math.random() * NO_TASKS) + 1;
			if (arr.indexOf(n) === -1) arr.push(n);
		}

		// assign unqiue task name to each station
		var stat = this.stations.getChildren();
		for (var i = 0; i < stat.length; i++) {
			stat[i].setDataEnabled();
			stat[i].setData("taskName", "TaskScene".concat(arr[i].toString()));
		}
	}

	startTask(player, zone) {
		if (this.cursors.space.isDown) {
			const taskName = zone.getData("taskName")
			console.log(taskName)
			this.input.keyboard.resetKeys();
			this.currentBattle = taskName
			this.scene.launch(taskName, { socket: this.socket, roomKey: this.state.roomKey });
		}

	}

	//fortlaufende Aktualisierungen
	update() {
		if (this.container) {
			this.container.body.setVelocity(0);

			if (this.scene.isActive('BattleScene')) {
				return
			}

			// Horizontal movement
			if (this.cursors.left.isDown) {
				this.container.body.setVelocityX(-80);
				this.player.anims.play('left', true);
			}
			else if (this.cursors.right.isDown) {
				this.container.body.setVelocityX(80);
				this.player.anims.play('right', true);
			}
			
			else if (this.cursors.right.isUp && this.cursors.left.isUp && this.cursors.up.isUp && this.cursors.down.isUp)  {
				
				
				 this.player.anims.play('idle', true);
			}

			// Vertical movement
			if (this.cursors.up.isDown) {
				this.container.body.setVelocityY(-80);
				this.player.anims.play('down', true);
			}
					
			
			else if (this.cursors.down.isDown) {
				this.container.body.setVelocityY(80);
				this.player.anims.play('up', true);
			}
			
			
	

			// emit player movement
			this.emitPlayerMovement()

			// IMPOSTER
			if (this.socket.id == this.state.imposterID) {

				// Add imposter stuff here
				var otherPlayers = this.otherPlayers.getChildren();
				var x = this.container.x;
				var y = this.container.y;

				for (var i = 0; i < otherPlayers.length; i++) {
					var dx = (x - otherPlayers[i].x);
					var dy = (y - otherPlayers[i].y);

					var distance = Math.sqrt(dx * dx + dy * dy)
					if (distance < 10.0) {
						this.events.emit('enableKill');
					} else {
						this.events.emit('disableKill');
					}
				}
			}
		}
		
	}
}


// UI updates on events
class UIScene extends Phaser.Scene {
	constructor() {
		super({
			key: "UIScene"
		});
		this.noTasks = 0;
		this.completedTasks = 0;
	}


	create() {
		initBoxes(this, COLORS.UI_BOX, COLORS.UI_BOX_BORDER);

		const textStyle = { color: COLORS.UI_TEXT, fontSize: "10px", fintStyle: "bold", align: "center" };
		var inX, inY = 0;

		[inX, inY] = createTextField(this, 80, 5, 75, 15);
		this.taskText = this.add.text(inX, inY, "Tasks: " + this.completedTasks + "/" + this.noTasks, textStyle);
		this.taskText.setOrigin(0.5);

		//  Listen for events from it
		var ourGame = this.scene.get('WorldScene');
		ourGame.events.on('showImposter', () => {
			[inX, inY] = createTextField(this, 150, 5, 65, 15);
			this.imposterField = this.add.text(inX, inY, "Imposter", textStyle);
			this.imposterField.setOrigin(0.5);
		});


		//  Listen for events from it
		ourGame.events.on('setNoTasks', (noTasks) => {
			this.noTasks = noTasks;
			this.taskText.setText("Tasks: " + this.completedTasks + "/" + this.noTasks);
		});

		//  Listen for events from it
		ourGame.events.on('completedTask', () => {
			this.completedTasks += 1;
			this.taskText.setText("Tasks: " + this.completedTasks + "/" + this.noTasks);
		});

		this.createKillNotification();

		ourGame.events.on('enableKill', () => {
			this.killBox.setVisible(true)
			this.killText.setVisible(true)
		});

		ourGame.events.on('disableKill', () => {
			this.killBox.setVisible(false)
			this.killText.setVisible(false)
		});
	}

	createKillNotification() {
		this.killBox = this.add.graphics();
		this.killBox.lineStyle(1, COLORS.MAIN_BOX_BORDER);
		this.killBox.fillStyle(COLORS.RED, 1);

		var width = 130;
		var height = 15;
		var inX = 315 - width;
		var inY = 220;
		this.killBox.strokeRect(inX, inY, width, height);
		this.killBox.fillRect(inX, inY, width, height);

		// Returning coordinates for text
		inX = 315 - width / 2;
		inY = 220 + height / 2;
		this.killText = this.add.text(inX, inY, "SCHLACHTE DIE SAU AB", { color: COLORS.UI_TEXT, fontSize: "10px", fintStyle: "bold", align: "center" });
		this.killText.setOrigin(0.5);

		this.killBox.setVisible(false)
		this.killText.setVisible(false)
	}

	update() {
		if (this.showKillNote) {
		}
	}
}


// Class master object defines abort button and end Task method
class TaskScene extends Phaser.Scene {
	constructor(gameData) {
		super({
			key: gameData.key
		});
		this.gameData = gameData;
	}

	init(data) {
		this.socket = data.socket;
		this.roomKey = data.roomKey;
		this.emitComplete = true;
	}

	create() {
		initBoxes(this, COLORS.UI_BOX, COLORS.UI_BOX_BORDER);

		this.createTask();

		// make abort key
		this.createAbortButton();
	}

	createAbortButton() {
		const textStyle = { color: COLORS.UI_TEXT, fontSize: "24px", fintStyle: "bold", align: "center" };
		var inX, inY = 0;

		[inX, inY] = createTextField(this, this.physics.world.bounds.width, 0, 30, 30);
		this.abortButton = this.add.text(inX, inY, "X", textStyle);
		this.abortButton.setOrigin(0.5);
		this.abortButton.setInteractive();
		this.abortButton.on("pointerdown", () => {
			this.abortTask();
		});
	}

	abortTask() {
		this.scene.stop(this.scene.key);
		this.scene.resume('WorldScene');
	}
}

function initBoxes(scene, fillColor, lineColor) {
	scene.boxes = scene.add.graphics();
	scene.boxes.lineStyle(1, lineColor);
	scene.boxes.fillStyle(fillColor, 1);
}

function createTextField(scene, x, y, width, height) {
	var inX = x - width;
	var inY = y;
	scene.boxes.strokeRect(inX, inY, width, height);
	scene.boxes.fillRect(inX, inY, width, height);

	// Returning coordinates for text
	inX = x - width / 2;
	inY = y + height / 2;
	return [inX, inY]
}


class TaskScenePairs extends TaskScene {
	constructor(gameData) {
		super(gameData)
	}

	createTask() {
		this.cameras.main.setBackgroundColor('rgba(0, 200, 0, 0.5)');

		this.noPairs = this.gameData.part1.length;
		this.pairsOverlapping = new Array(this.noPairs);
		this.noOverlap = 0;

		this.containers1 = this.add.group();
		this.containers2 = this.add.group();

		for (var i = 0; i < this.noPairs; i++) {

			// part 1
			this.pairs1 = this.add.text(0, 0, this.gameData.part1[i])
			this.pairs1.setOrigin(0.5);

			this.container1 = this.add.container(
				Phaser.Math.RND.between(0, this.physics.world.bounds.width),
				Phaser.Math.RND.between(0, this.physics.world.bounds.height)
			);

			this.container1.setSize(64, 24);
			this.container1.add(this.pairs1);
			this.container1.setInteractive();
			this.input.setDraggable(this.container1);

			this.physics.world.enable(this.container1);

			this.containers1.add(this.container1);

			// part 2
			this.pairs2 = this.add.text(0, 0, this.gameData.part2[i])
			this.pairs2.setOrigin(0.5);

			this.container2 = this.add.container(
				Phaser.Math.RND.between(0, this.physics.world.bounds.width),
				Phaser.Math.RND.between(0, this.physics.world.bounds.height)
			);

			this.container2.setSize(64, 24);
			this.container2.add(this.pairs2);
			this.container2.setInteractive();
			this.input.setDraggable(this.container2);

			this.physics.world.enable(this.container2);

			this.containers2.add(this.container2);

			//Trigger beim Berühren der Zonen
			this.physics.add.overlap(this.container1, this.container2, this.endTask, false, this);
		}

		var cons1 = this.containers1.getChildren();
		var cons2 = this.containers2.getChildren();

		for (var i = 0; i < cons1.length; i++) {
			var c1 = cons1[i];
			var c2 = cons2[i];

			if (checkOverlap(c1, c2)) {
				this.pairsOverlapping[i] = true;
				this.switchOn();
			} else {
				this.pairsOverlapping[i] = false;
			}
		}

		this.input.dragDistanceThreshold = 16;

		this.input.on('dragstart', function(pointer, gameObject) {
		});

		this.input.on('drag', function(pointer, gameObject, dragX, dragY) {
			gameObject.x = dragX;
			gameObject.y = dragY;
		});

		this.input.on('dragend', function(pointer, gameObject) {
		});
	}

	update(time, delta) {
		var cons1 = this.containers1.getChildren();
		var cons2 = this.containers2.getChildren();

		for (var i = 0; i < cons1.length; i++) {
			var c1 = cons1[i];
			var c2 = cons2[i];

			if (checkOverlap(c1, c2)) {
				if (!this.pairsOverlapping[i]) {
					this.switchOn();
					this.pairsOverlapping[i] = true;
				}
			} else {
				if (this.pairsOverlapping[i]) {
					this.switchOff();
					this.pairsOverlapping[i] = false;
				}
			}
		}
	}

	switchOn() {
		this.noOverlap += 1;
	}

	switchOff() {
		this.noOverlap -= 1;
	}

	endTask() {
		if (this.noOverlap == this.noPairs) {
			if (this.emitComplete) {
				this.socket.emit("taskComplete", this.roomKey);
				this.emitComplete = false;
			}
			this.scene.stop(this.scene.key);
			this.scene.resume('WorldScene');
		}
	}
}

function checkOverlap(spriteA, spriteB) {
	var boundsA = spriteA.getBounds();
	var boundsB = spriteB.getBounds();

	isOverlapping = Phaser.Geom.Rectangle.Overlaps(boundsA, boundsB);
	return isOverlapping
}


class TaskSceneGroup extends TaskScene {
	constructor(gameData) {
		super(gameData)
	}

	createTask() {

		//this.cameras.main.setBackgroundColor('rgba(245, 66, 66)');
		this.cameras.main.setBackgroundColor('rgba(0,0,0)');

		this.graphics = this.add.graphics();

		// group field 1
		this.noItems1 = this.gameData.items1.length;
		this.overlapG1 = new Array(this.noItems1);

		this.group1Field = this.add.container(
			this.physics.world.bounds.width / 4,
			this.physics.world.bounds.height / 2
		);
		this.group1Field.setSize(
			this.physics.world.bounds.width / 2,
			this.physics.world.bounds.height
		);
		var area = this.add.rectangle(
			0,
			0,
			this.physics.world.bounds.width / 2,
			this.physics.world.bounds.height,
			0xf54242
		);
		this.group1Field.add(area);
		this.physics.world.enable(this.group1Field);
		this.add.text(0, 0, this.gameData.group1);

		// group field 2
		this.noItems2 = this.gameData.items2.length;
		this.overlapG2 = new Array(this.noItems2);

		this.group2Field = this.add.container(
			this.physics.world.bounds.width * 3 / 4,
			this.physics.world.bounds.height / 2
		);
		this.group2Field.setSize(
			this.physics.world.bounds.width / 2,
			this.physics.world.bounds.height
		);
		var area2 = this.add.rectangle(
			0,
			0,
			this.physics.world.bounds.width / 2,
			this.physics.world.bounds.height,
			0x031f4c
		);
		this.group2Field.add(area2);
		this.physics.world.enable(this.group2Field);
		this.add.text(this.physics.world.bounds.width / 2, 0, this.gameData.group2);

		// add text fields

		this.containers1 = this.add.group();
		for (var i = 0; i < this.noItems1; i++) {

			var text = this.add.text(0, 0, this.gameData.items1[i])
			text.setOrigin(0.5);

			this.container1 = this.add.container(
				Phaser.Math.RND.between(0, this.physics.world.bounds.width),
				Phaser.Math.RND.between(0, this.physics.world.bounds.height)
			);

			this.container1.setSize(64, 24);
			this.container1.add(text);
			this.container1.setInteractive();
			this.input.setDraggable(this.container1);

			this.physics.world.enable(this.container1);
			this.physics.add.overlap(this.group1Field, this.container1, this.endTask, false, this);

			this.containers1.add(this.container1);
		}

		this.containers2 = this.add.group();
		for (var i = 0; i < this.noItems2; i++) {

			var text = this.add.text(0, 0, this.gameData.items2[i])
			text.setOrigin(0.5);

			this.container2 = this.add.container(
				Phaser.Math.RND.between(0, this.physics.world.bounds.width),
				Phaser.Math.RND.between(0, this.physics.world.bounds.height)
			);

			this.container2.setSize(64, 24);
			this.container2.add(text);
			this.container2.setInteractive();
			this.input.setDraggable(this.container2);

			this.physics.world.enable(this.container2);
			this.physics.add.overlap(this.group2Field, this.container2, this.endTask, false, this);

			this.containers2.add(this.container2);
		}

		// Init
		var cons1 = this.containers1.getChildren();

		for (var i = 0; i < cons1.length; i++) {
			var c1 = cons1[i];
			if (checkOverlap(c1, this.group1Field)) {
				this.overlapG1[i] = true;
			} else {
				this.overlapG1[i] = false;
			}
		}

		var cons2 = this.containers2.getChildren();
		for (var i = 0; i < cons2.length; i++) {
			var c2 = cons2[i];

			if (checkOverlap(c2, this.group2Field)) {
				this.overlapG2[i] = true;
			} else {
				this.overlapG2[i] = false;
			}
		}

		this.input.dragDistanceThreshold = 16;

		this.input.on('dragstart', function(pointer, gameObject) {
		});

		this.input.on('drag', function(pointer, gameObject, dragX, dragY) {
			gameObject.x = dragX;
			gameObject.y = dragY;
		});

		this.input.on('dragend', function(pointer, gameObject) {
		});


	}

	update(time, delta) {
		var cons1 = this.containers1.getChildren();

		for (var i = 0; i < cons1.length; i++) {
			var c1 = cons1[i];

			if (checkOverlap(c1, this.group1Field)) {
				if (!this.overlapG1[i]) {
					this.overlapG1[i] = true;
				}
			} else {
				if (this.overlapG1[i]) {
					this.overlapG1[i] = false;
				}
			}
		}

		var cons2 = this.containers2.getChildren();

		for (var i = 0; i < cons2.length; i++) {
			var c2 = cons2[i];

			if (checkOverlap(c2, this.group2Field)) {
				if (!this.overlapG2[i]) {
					this.overlapG2[i] = true;
				}
			} else {
				if (this.overlapG2[i]) {
					this.overlapG2[i] = false;
				}
			}
		}

	}

	endTask() {
		const noOverlapsG1 = this.overlapG1.filter(Boolean).length;
		const noOverlapsG2 = this.overlapG2.filter(Boolean).length;

		if (noOverlapsG1 == this.noItems1 && noOverlapsG2 == this.noItems2) {
			if (this.emitComplete) {
				this.socket.emit("taskComplete", this.roomKey);
				this.emitComplete = false;
			}
			this.scene.stop(this.scene.key);
			this.scene.resume('WorldScene');
		}
	}
}



class TaskSceneOrder extends TaskScene {
	constructor(gameData) {
		super(gameData)
	}



	createTask() {

		this.cameras.main.setBackgroundColor('rgba(0,0,0)');

		this.noItems = this.gameData.items.length;
		this.overlaps = new Array(this.noItems);
		this.gameData.items.sort();

		const borderWidth = 50;
		const rowDist = 30;
		const maxConsInRow = 3;
		const boxWidth = 50;
		const boxHeight = 50;
		const boxGap = (this.physics.world.bounds.width - 2 * borderWidth - maxConsInRow * boxWidth) / (maxConsInRow - 1);

		this.containers1 = this.add.group();
		this.containers2 = this.add.group();
		for (var i = 0; i < this.noItems; i++) {
			// make target box
			var area = this.add.rectangle(0, 0, boxWidth, boxHeight, 0xf54242);

			this.container1 = this.add.container(
				borderWidth + boxWidth / 2 + (i % maxConsInRow) * (boxWidth + boxGap),
				this.physics.world.bounds.height / 2 + (Math.ceil((i + 1) / maxConsInRow) - 1) * (boxHeight + rowDist)
			);
			this.container1.setSize(boxWidth, boxHeight);
			this.container1.add(area);
			this.physics.world.enable(this.container1);
			this.add.text(0, 0, this.gameData.group1);

			this.containers1.add(this.container1);

			// make text field
			var text = this.add.text(0, 0, this.gameData.items[i])
			text.setOrigin(0.5);

			this.container2 = this.add.container(
				Phaser.Math.RND.between(0, this.physics.world.bounds.width),
				Phaser.Math.RND.between(0, this.physics.world.bounds.height)
			);

			this.container2.setSize(64, 24);
			this.container2.add(text);
			this.container2.setDepth(this.noItems + i);
			this.container2.setInteractive();
			this.input.setDraggable(this.container2);

			this.physics.world.enable(this.container2);
			this.physics.add.overlap(this.container1, this.container2, this.endTask, false, this);

			this.containers2.add(this.container2);
		}

		this.input.dragDistanceThreshold = 16;

		this.input.on('dragstart', function(pointer, gameObject) {
		});

		this.input.on('drag', function(pointer, gameObject, dragX, dragY) {
			gameObject.x = dragX;
			gameObject.y = dragY;
		});

		this.input.on('dragend', function(pointer, gameObject) {
		});

		this.createAbortButton()
	}


	update(time, delta) {
		var cons1 = this.containers1.getChildren();
		var cons2 = this.containers2.getChildren();

		for (var i = 0; i < cons1.length; i++) {
			var c1 = cons1[i];
			var c2 = cons2[i];

			if (checkOverlap(c1, c2)) {
				if (!this.overlaps[i]) {
					this.overlaps[i] = true;
				}
			} else {
				if (this.overlaps[i]) {
					this.overlaps[i] = false;
				}
			}
		}
	}

	endTask() {
		const noOverlaps = this.overlaps.filter(Boolean).length;

		if (noOverlaps == this.noItems) {
			if (this.emitComplete) {
				this.socket.emit("taskComplete", this.roomKey);
				this.emitComplete = false;
			}
			this.scene.stop(this.scene.key);
			this.scene.resume('WorldScene');
		}
	}
}


// load game configuration file from server
function loadFile(filePath) {
	var result = null;
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("GET", filePath, false);
	xmlhttp.send();
	if (xmlhttp.status == 200) {
		result = xmlhttp.responseText;
	}
	return result;
}

gameData = JSON.parse(loadFile("game.json"))

var taskScenes = [];
var taskString = "TaskScene";
var taskCounter = 1;
for (const task in gameData) {
	var key = taskString.concat(taskCounter.toString());
	taskDescription = gameData[task];
	taskDescription.key = key;
	console.log(taskDescription)

	switch (taskDescription.taskType) {
		case "pairs":
			var scene = new TaskScenePairs(taskDescription);
			break;
		case "group":
			var scene = new TaskSceneGroup(taskDescription);
			break;
		case "order":
			var scene = new TaskSceneOrder(taskDescription);
			break;
		default:
			console.log("Something went wrong")
	}
	taskScenes.push(scene);

	taskCounter += 1;
}

const NO_TASKS = taskCounter - 1;

var gameScenes = [
	BootScene,
	StartScene,
	LobbyScene,
	WorldScene,
	UIScene,
];

allScenes = gameScenes.concat(taskScenes);


var config = {
	type: Phaser.WEBGL,
	parent: 'content',
	width: 320,
	height: 240,
	zoom: 2,
	pixelArt: true,
	physics: {
		default: 'arcade',
		arcade: {
			gravity: { y: 0 },
			debug: true
		}
	},
	dom: {
		createContainer: true,
	},
	// append all tasks
	scene: allScenes,
};

var game = new Phaser.Game(config);
