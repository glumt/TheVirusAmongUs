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
		this.load.image('begriff1', 'assets/Begriff1.png');
		this.load.image('begriff2', 'assets/Begriff2.png');
		this.load.image('begriff3', 'assets/Begriff3.png');


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
		this.physics.add.overlap(this.container, this.station2, this.onMeetTask3, false, this);
		this.physics.add.overlap(this.container, this.station1, this.onMeetTask1, false, this);
		this.physics.add.overlap(this.container, this.station3, this.onMeetTask2, false, this);
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
		this.station1 = this.physics.add.group({ classType: Phaser.GameObjects.Zone });
		this.station1.create(400, 80, 20, 20);

		this.station2 = this.physics.add.group({ classType: Phaser.GameObjects.Zone });
		this.station2.create(80, 80, 20, 20);

		this.station3 = this.physics.add.group({ classType: Phaser.GameObjects.Zone });
		this.station3.create(240, 240, 20, 20);

		this.spawns = this.physics.add.group({ classType: Phaser.GameObjects.Zone });
		this.spawns.create(432, 302, 20, 20);
		this.spawns.create(432, 465, 20, 20);
		this.spawns.create(240, 430, 20, 20);
	}

	onMeetTask1(player, zone) {
		if (this.cursors.space.isDown) {
			this.input.keyboard.resetKeys();
			this.scene.pause();
			this.scene.launch('TaskScene1');
		}
	}

	onMeetTask2(player, zone) {
		if (this.cursors.space.isDown) {
			//this.cursors.space.reset();
			this.input.keyboard.resetKeys();
			this.scene.pause();
			this.scene.launch('TaskScene2');
		}
	}
	onMeetTask3(player, zone) {
		if (this.cursors.space.isDown) {
			this.input.keyboard.resetKeys();
			this.scene.pause();
			this.scene.launch('TaskScene3');
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


class TaskScene1 extends Phaser.Scene {
	constructor(gameData) {
		super({
			key: 'TaskScene1'
		});
		this.gameData = gameData;
	}

	create() {
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
			this.scene.stop('TaskScene1');
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

class TaskScene2 extends Phaser.Scene {
	constructor(gameData) {
		super({
			key: 'TaskScene2'
		});
		this.gameData = gameData;
	}

	create() {

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
			console.log(c1.getBounds(), this.group1Field.getBounds())
			if (checkOverlap(c1, this.group1Field)) {
				console.log(true)
				this.overlapG1[i] = true;
			} else {
				console.log(false)
				this.overlapG1[i] = false;
			}
		}

		var cons2 = this.containers2.getChildren();
		for (var i = 0; i < cons2.length; i++) {
			var c2 = cons2[i];

			if (checkOverlap(c2, this.group2Field)) {
				console.log(true)
				this.overlapG2[i] = true;
			} else {
				console.log(false)
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
					console.log("overlap")
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
					console.log("overlap")
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
			this.scene.stop('TaskScene2');
			this.scene.resume('WorldScene');
		}
	}
}


class TaskScene3 extends Phaser.Scene {
	constructor(gameData) {
		super({
			key: 'TaskScene3'
		});
		this.gameData = gameData;
	}

	create() {

		this.cameras.main.setBackgroundColor('rgba(240, 240, 240)');
		/*

		this.graphics = this.add.graphics();
		this.graphics.lineStyle(1, 240, 240, 240);
		this.graphics.fillStyle(0x031f4c, 1);
		this.graphics.strokeRect(50, 100, 50, 50);
		this.graphics.fillRect(50, 100, 50, 50);

		this.graphics = this.add.graphics();
		this.graphics.lineStyle(1, 0x031f4c);
		this.graphics.fillStyle(0x031f4c, 1);
		this.graphics.strokeRect(150, 100, 50, 50);
		this.graphics.fillRect(150, 100, 50, 50);

		this.graphics = this.add.graphics();
		this.graphics.lineStyle(1, 0x031f4c);
		this.graphics.fillStyle(0x031f4c, 1);
		this.graphics.strokeRect(250, 100, 50, 50);
		this.graphics.fillRect(250, 100, 50, 50);



		this.falseField = this.physics.add.group({ classType: Phaser.GameObjects.Zone });
		this.falseField.create(0, 0, 700, 400);

		this.Field1 = this.physics.add.group({ classType: Phaser.GameObjects.Zone });
		this.Field1.create(75, 125, 50, 50);

		this.Field2 = this.physics.add.group({ classType: Phaser.GameObjects.Zone });
		this.Field2.create(175, 125, 50, 50);

		this.Field3 = this.physics.add.group({ classType: Phaser.GameObjects.Zone });
		this.Field3.create(275, 125, 50, 50);


		for (var i = 0; i < 1; i++) {
			var begriff1 = this.player = this.physics.add.sprite(Phaser.Math.RND.between(0, this.physics.world.bounds.width), Phaser.Math.RND.between(0, this.physics.world.bounds.height), 'begriff1').setInteractive();
			this.input.setDraggable(begriff1);
			var begriff2 = this.physics.add.sprite(Phaser.Math.RND.between(0, this.physics.world.bounds.width), Phaser.Math.RND.between(0, this.physics.world.bounds.height), 'begriff2').setInteractive();
			this.input.setDraggable(begriff2);
			var begriff3 = this.physics.add.sprite(Phaser.Math.RND.between(0, this.physics.world.bounds.width), Phaser.Math.RND.between(0, this.physics.world.bounds.height), 'begriff3').setInteractive();
			this.input.setDraggable(begriff3);
		}
		*/


		// new code

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
			this.scene.stop('TaskScene3');
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

// Init BattleScenes with data from json
gameData = JSON.parse(loadFile("game.json"))

var taskScene1 = new TaskScene1(gameData.task1);
var taskScene2 = new TaskScene2(gameData.task2);
var taskScene3 = new TaskScene3(gameData.task3);


//Gesamteinstellungen (kein Plan warum am Ende{Hab ich wohl verkackt})
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
		taskScene1,
		taskScene2,
		taskScene3,
	]
};

var game = new Phaser.Game(config);
