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

		//Karte wird erstellt
		var map = this.make.tilemap({ key: 'map' });

		//Texturvariable = Bild im Asset-Ordner (Tileset in der JSON-Map, dazugehöriges Bild im Assets-Ordner )
		var groundtiles = map.addTilesetImage('groundtiles', 'mainlevbuild');
		var obstacletiles = map.addTilesetImage('obstacleteils', 'teiletiles');
		var wallstileset = map.addTilesetImage('wallstileset', 'wallstileset');
		var objecttiles = map.addTilesetImage('objecttileset', 'objecttiles');

		//Layervariable = erzeuge Statische Schicht (oder Objekt) (Name des Layers, Tileset in der JSON-Map, Position)
		var ground = map.createStaticLayer('ground', groundtiles, 0, 0);
		var obstacles = map.createStaticLayer('obstacles', obstacletiles, 0, 0);
		var walls = map.createStaticLayer('walls', wallstileset, 0, 0);
		var objects = map.createStaticLayer('objectlayer', objecttiles, 0, 0);
		//Collision der Layers
		walls.setCollisionByExclusion([-1]);
		objects.setCollisionByExclusion([-1]);

		//Erzeugen des Spielers		
		this.player = this.physics.add.sprite(50, 100, 'bluespritesheet');
		//Erzeugen der Kartengröße und Ränder
		this.physics.world.bounds.width = map.widthInPixels;
		this.physics.world.bounds.height = map.heightInPixels;
		this.player.setCollideWorldBounds(true);

		//Erzeugen der Inputs	
		this.cursors = this.input.keyboard.createCursorKeys();

		//Erzeugen der Kamera
		this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
		this.cameras.main.startFollow(this.player);
		this.cameras.main.roundPixels = true;

		//Erzeugen der Animation (die nicht funktioniert)
		this.anims.create({
			key: 'walk',
			frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
			frameRate: 3,
			repeat: -1
		});

		//Kollision zwischen Spieler und Wänden (Objekte aktuell deaktiviert)
		this.physics.add.collider(this.player, walls);
		//this.physics.add.collider(this.player, objects);

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
