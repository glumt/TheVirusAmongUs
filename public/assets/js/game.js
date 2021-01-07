/**
 * 
 */

class BootScene extends Phaser.Scene {
	constructor() {
		super({
			key: 'BootScene',
			active: true
		});
	}

	preload() {
		this.load.tilemapTiledJSON('map', 'assets/tilemap.json');
		this.load.image('mainlevbuild', 'assets/mainlevbuild.png');
		this.load.image('teiletiles', 'assets/teiletiles.png');
		this.load.image('wallstileset', 'assets/wallstileset.png');
		this.load.image('objecttiles', 'assets/objecttiles.png');
		this.load.spritesheet('bluespritesheet', 'assets/bluespritesheet.png', { frameWidth: 32, frameHeight: 32 });

		this.load.image('dragonblue', 'assets/dragonblue.png');
		this.load.image('dragonred', 'assets/dragonred.png');
		this.load.image('lobby', 'assets/lobby.png');
	}

	create() {
		this.scene.start('LobbyScene');
	}
}

class LobbyScene extends Phaser.Scene {
	constructor() {
		super({
			key: 'LobbyScene'
		});
	}

	initialize() {
		Phaser.Scene.call(this, { key: 'LobbyScene' });
	}

	create() {
		// UI Scene at the same time
		this.scene.launch('LobbyUIScene');
		this.add.image(100, 100, 'lobby');
		this.background = this.add.tileSprite(100, 100, 0, 0, 'lobby');

		this.player = this.physics.add.sprite(50, 100, 'bluespritesheet');
		this.player.setCollideWorldBounds(true);
		this.player.setBounce(1);

		var map = this.make.tilemap({ key: 'map' });
		this.physics.world.bounds.width = map.widthInPixels -= 470;
		this.physics.world.bounds.height = map.heightInPixels -= 450;
		this.player.setCollideWorldBounds(true);

		//Erzeugen der Inputs	
		this.cursors = this.input.keyboard.createCursorKeys();
	}

	update(time, delta) {

		if (this.cursors.left.isDown) {
			this.player.body.setVelocityX(-40);
			//this.player.anims.play('walk', true);
		}
		else if (this.cursors.right.isDown) {
			this.player.body.setVelocityX(40);
			//this.player.anims.play('walk', true);
		}

		// Vertical movement
		if (this.cursors.up.isDown) {
			this.player.body.setVelocityY(-40);
			//this.player.anims.play('walk', true);
		}
		else if (this.cursors.down.isDown) {
			this.player.body.setVelocityY(40);
			//this.player.anims.play('walk', true);
		}

		this.timer += delta;
		while (this.timer > 1000) {
			this.resources += 1;
			this.timer -= 1000;
		}
		this.background.tilePositionY += 5;
	}
}


class LobbyUIScene extends Phaser.Scene {
	constructor() {
		super({
			key: 'LobbyUIScene'
		});
	}

	create() {
		this.graphics = this.add.graphics();
		this.graphics.lineStyle(1, 0xffffff);
		this.graphics.fillStyle(0x031f4c, 1);
		this.graphics.strokeRect(2, 185, 318, 100);
		this.graphics.fillRect(2, 185, 318, 100);

		var text = this.add.text(75, 200, 'Start the Game!');
		text.setInteractive({ useHandCursor: true });
		text.on('pointerdown', () => this.scene.start('WorldScene'));
	}
}


class WorldScene extends Phaser.Scene {
	constructor() {
		super({
			key: 'WorldScene'
		});
	}

	//Elemente die im Spiel erzeugt werden.
	create() {
		this.scene.stop('LobbyScene');

		this.socket = io();
		this.otherPlayers = this.physics.add.group();

		// create map
		this.createMap();

		// create player animations
		this.createAnimations();

		// user input
		this.cursors = this.input.keyboard.createCursorKeys();

		// create enemies
		this.createStations();

		// listen for web socket events
		this.socket.on('currentPlayers', function(players) {
			Object.keys(players).forEach(function(id) {
				if (players[id].playerId === this.socket.id) {
					this.createPlayer(players[id]);
				} else {
					this.addOtherPlayers(players[id]);
				}
			}.bind(this));
		}.bind(this));

		this.socket.on('newPlayer', function(playerInfo) {
			this.addOtherPlayers(playerInfo);
		}.bind(this));

		this.socket.on('disconnect', function(playerId) {
			this.otherPlayers.getChildren().forEach(function(player) {
				if (playerId === player.playerId) {
					player.destroy();
				}
			}.bind(this));
		}.bind(this));

		this.socket.on('playerMoved', function(playerInfo) {
			this.otherPlayers.getChildren().forEach(function(player) {
				if (playerInfo.playerId === player.playerId) {
					player.flipX = playerInfo.flipX;
					player.setPosition(playerInfo.x, playerInfo.y);
				}
			}.bind(this));
		}.bind(this));
	}


	createMap() {
		//Karte wird erstellt
		this.map = this.make.tilemap({ key: 'map' });

		//Texturvariable = Bild im Asset-Ordner (Tileset in der JSON-Map, dazugehöriges Bild im Assets-Ordner )
		var groundtiles = this.map.addTilesetImage('groundtiles', 'mainlevbuild');
		var obstacletiles = this.map.addTilesetImage('obstacleteils', 'teiletiles');
		var wallstileset = this.map.addTilesetImage('wallstileset', 'wallstileset');
		var objecttiles = this.map.addTilesetImage('objecttileset', 'objecttiles');

		//Layervariable = erzeuge Statische Schicht (oder Objekt) (Name des Layers, Tileset in der JSON-Map, Position)
		var ground = this.map.createStaticLayer('ground', groundtiles, 0, 0);
		var obstacles = this.map.createStaticLayer('obstacles', obstacletiles, 0, 0);
		this.walls = this.map.createStaticLayer('walls', wallstileset, 0, 0);
		var objects = this.map.createStaticLayer('objectlayer', objecttiles, 0, 0);

		//Collision der Layers
		this.walls.setCollisionByExclusion([-1]);
		objects.setCollisionByExclusion([-1]);

		//Erzeugen der Kartengröße und Ränder
		this.physics.world.bounds.width = this.map.widthInPixels;
		this.physics.world.bounds.height = this.map.heightInPixels;
	}

	createAnimations() {
		//Erzeugen der Animation (die nicht funktioniert)
		this.anims.create({
			key: 'walk',
			frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
			frameRate: 3,
			repeat: -1
		});

	}

	createPlayer(playerInfo) {
		this.player = this.add.sprite(0, 0, 'bluespritesheet');

		this.container = this.add.container(playerInfo.x, playerInfo.y);
		this.container.setSize(32, 32);
		this.physics.world.enable(this.container);
		this.container.add(this.player);

		// update camera
		this.updateCamera();

		this.container.body.setCollideWorldBounds(true);

		this.physics.add.collider(this.container, this.walls);
		//Trigger beim Berühren der Zonen
		this.physics.add.overlap(this.container, this.spawns, this.onMeetTask, false, this);
	}

	addOtherPlayers(playerInfo) {
		const otherPlayer = this.add.sprite(playerInfo.x, playerInfo.y, 'bluespritesheet');
		otherPlayer.setTint(Math.random() * 0xffffff);
		otherPlayer.playerId = playerInfo.playerId;
		this.otherPlayers.add(otherPlayer);
	}


	//Erzeugen der Kamera
	updateCamera() {
		this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
		this.cameras.main.startFollow(this.container);
		this.cameras.main.roundPixels = true;
	}


	createStations() {
		//Erzeugen der Zonen über den Computern
		this.spawns = this.physics.add.group({ classType: Phaser.GameObjects.Zone });

		this.spawns.create(400, 80, 20, 20);
		this.spawns.create(240, 240, 20, 20);
		this.spawns.create(80, 80, 20, 20);
		this.spawns.create(432, 302, 20, 20);
		this.spawns.create(432, 465, 20, 20);
		this.spawns.create(240, 430, 20, 20);
	}

	onMeetTask(player, zone) {
		console.log("ON ZONE")
		if (this.cursors.space.isDown) {
			this.cursors.space.reset();
			//this.cameras.main.fade(500);
			this.scene.pause();
			this.scene.launch('BattleScene');
			console.log("CONTINUE")
		}
	}


	//fortlaufende Aktualisierungen
	update() {
		if (this.container) {

			this.container.body.setVelocity(0);

			// Horizontal movement
			if (this.cursors.left.isDown) {
				this.container.body.setVelocityX(-80);
				//this.player.anims.play('walk', true);
			}
			else if (this.cursors.right.isDown) {
				this.container.body.setVelocityX(80);
				//this.player.anims.play('walk', true);
			}

			// Vertical movement
			if (this.cursors.up.isDown) {
				this.container.body.setVelocityY(-80);
				//this.player.anims.play('walk', true);
			}
			else if (this.cursors.down.isDown) {
				this.container.body.setVelocityY(80);
				//this.player.anims.play('walk', true);
			}

			// emit player movement
			var x = this.container.x;
			var y = this.container.y;
			var flipX = this.player.flipX;
			if (this.container.oldPosition && (x !== this.container.oldPosition.x || y !== this.container.oldPosition.y || flipX !== this.container.oldPosition.flipX)) {
				this.socket.emit('playerMovement', { x, y, flipX });
			}
			// save old position data
			this.container.oldPosition = {
				x: this.container.x,
				y: this.container.y,
				flipX: this.player.flipX
			};
		}
	}

}


class BattleScene extends Phaser.Scene {
	constructor() {
		super({
			key: 'BattleScene'
		});
	}

	create() {
		this.cameras.main.setBackgroundColor('rgba(0, 200, 0, 0.5)');
		var dragonblue = this.player = this.physics.add.sprite(50, 100, 'dragonblue').setInteractive();
		this.input.setDraggable(dragonblue);
		var dragonred = this.physics.add.sprite(200, 200, 'dragonred').setInteractive();
		this.input.setDraggable(dragonred);

		this.input.dragDistanceThreshold = 16;

		this.input.on('dragstart', function(pointer, gameObject) {
		});

		this.input.on('drag', function(pointer, gameObject, dragX, dragY) {
			gameObject.x = dragX;
			gameObject.y = dragY;
		});

		this.physics.add.overlap(dragonblue, dragonred, this.endTask, false, this);

		this.input.on('dragend', function(pointer, gameObject) {
			gameObject.clearTint();
		});
	}

	endTask(player, zone) {
		//this.cameras.main.fade(500);
		this.scene.stop('BattleScene');
		this.scene.resume('WorldScene');
	}
}

function loadFile(filePath) {
  var result = null;
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.open("GET", filePath, false);
  xmlhttp.send();
  if (xmlhttp.status==200) {
    result = xmlhttp.responseText;
  }
  return result;
}

console.log(loadFile("game.json"))

// Init BattleScenes with data from json
var testScene = new BattleScene();


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
	scene: [
		BootScene,
		LobbyScene,
		LobbyUIScene,
		WorldScene,
		testScene
	]
};


var game = new Phaser.Game(config);
