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

		// create map
		this.createMap();

		// create player animations
		this.createAnimations();

		// create player
		this.createPlayer();

		//Kollision zwischen Spieler und Wänden (Objekte aktuell deaktiviert)
		this.physics.add.collider(this.player, this.walls);

		// update camera
		this.updateCamera();

		// user input
		this.cursors = this.input.keyboard.createCursorKeys();

		// create enemies
		this.createStations();
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

	createPlayer() {
		//Erzeugen des Spielers		
		this.player = this.physics.add.sprite(50, 100, 'bluespritesheet');
		//Erzeugen der Kartengröße und Ränder
		this.physics.world.bounds.width = this.map.widthInPixels;
		this.physics.world.bounds.height = this.map.heightInPixels;
		this.player.setCollideWorldBounds(true);

	}



	//Erzeugen der Kamera
	updateCamera() {
		this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
		this.cameras.main.startFollow(this.player);
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
	update(time, delta) {
		this.player.body.setVelocity(0);

		// Horizontal movement
		if (this.cursors.left.isDown) {
			this.player.body.setVelocityX(-80);
			//this.player.anims.play('walk', true);
		}
		else if (this.cursors.right.isDown) {
			this.player.body.setVelocityX(80);
			//this.player.anims.play('walk', true);
		}

		// Vertical movement
		if (this.cursors.up.isDown) {
			this.player.body.setVelocityY(-80);
			//this.player.anims.play('walk', true);
		}
		else if (this.cursors.down.isDown) {
			this.player.body.setVelocityY(80);
			//this.player.anims.play('walk', true);
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
