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
	}

	create() {
		this.scene.start('WorldScene');
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
		this.socket = io();
		this.otherPlayers = this.physics.add.group();

		// create map
		this.createMap();

		// create player animations
		this.createAnimations();

		// user input
		this.cursors = this.input.keyboard.createCursorKeys();

		// create enemies
		//this.createStations();

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
		for (var i = 0; i < 5; i++) {

			this.spawns.create(400, 80, 20, 20);
			this.spawns.create(240, 240, 20, 20);
			this.spawns.create(80, 80, 20, 20);
			this.spawns.create(432, 302, 20, 20);
			this.spawns.create(432, 465, 20, 20);
			this.spawns.create(240, 430, 20, 20);
		}
		//Trigger beim Berühren der Zonen
		this.physics.add.overlap(this.player, this.spawns, this.onMeetEnemy, false, this);
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

//Gesamteinstellungen (kein Plan warum am Ende{Hab ich wohl verkackt})
var config = {
	type: Phaser.AUTO,
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
		WorldScene
	]
};

var game = new Phaser.Game(config);
