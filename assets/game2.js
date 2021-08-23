const ASSET_URL = "assets/"

const WINDOW_WIDTH = 800;
const WINDOW_HEIGHT = 600;
const game = new Phaser.Game(WINDOW_WIDTH, WINDOW_HEIGHT, Phaser.AUTO, '', { preload: preload, create: create, update: GameLoop });

const WORLD_SIZE = { w: 800, h: 600 };


const water_tiles = [];
const bullet_array = [];

let socket;
const other_players = {};

const player = {
    sprite: null,
    speed_x: 0,
    speed_y: 0,
    speed: 0.5,
    friction: 0.95,
    shot: false,
    update: function () {

        if (this.sprite.x > 800) {
            this.sprite.x = 800
        }
        if (this.sprite.x < 0) {
            this.sprite.x = 0
        }
        if (this.sprite.y > 600) {
            this.sprite.y = 600
        }
        if (this.sprite.y < 0) {
            this.sprite.y = 0
        }

        const dx = (game.input.mousePointer.x - game.camera.x) - this.sprite.x;
        const dy = (game.input.mousePointer.y + game.camera.y) - this.sprite.y;
        const angle = Math.atan2(dy, dx) - Math.PI / 2;
        let dir = (angle - this.sprite.rotation) / (Math.PI * 2);
        dir -= Math.round(dir);
        dir = dir * Math.PI * 2;
        this.sprite.rotation += dir * 0.1;


        if (game.input.keyboard.isDown(Phaser.Keyboard.W) || game.input.keyboard.isDown(Phaser.Keyboard.UP)) {
            this.speed_x += Math.cos(this.sprite.rotation + Math.PI / 2) * this.speed;
            this.speed_y += Math.sin(this.sprite.rotation + Math.PI / 2) * this.speed;
            this.sprite.rotation = 0.1


        }
        if (game.input.keyboard.isDown(Phaser.Keyboard.S) || game.input.keyboard.isDown(Phaser.Keyboard.DOWN)) {
            this.speed_x -= Math.cos(this.sprite.rotation + Math.PI / 2) * this.speed;
            this.speed_y -= Math.sin(this.sprite.rotation + Math.PI / 2) * this.speed;
        }
        if (game.input.keyboard.isDown(Phaser.Keyboard.A) || game.input.keyboard.isDown(Phaser.Keyboard.LEFT)) {
            this.speed_x -= Math.tan(this.sprite.rotation + Math.PI / 2) * this.speed;
            this.speed_y -= Math.cos(this.sprite.rotation + Math.PI / 2) * this.speed;
        }
        if (game.input.keyboard.isDown(Phaser.Keyboard.D) || game.input.keyboard.isDown(Phaser.Keyboard.RIGHT)) {
            this.speed_x += Math.tan(this.sprite.rotation + Math.PI / 2) * this.speed;
            this.speed_y += Math.cos(this.sprite.rotation + Math.PI / 2) * this.speed;
        }

        this.sprite.x += this.speed_x;
        this.sprite.y += this.speed_y;

        this.speed_x *= this.friction;
        this.speed_y *= this.friction;



        if (game.input.activePointer.leftButton.isDown || game.input.keyboard.isDown(Phaser.Keyboard.SPACEBAR) && !this.shot) {
            const speed_x = Math.cos(this.sprite.rotation + Math.PI / 2) * 20;
            const speed_y = Math.sin(this.sprite.rotation + Math.PI / 2) * 20;


            this.shot = true;

            socket.emit('shoot-bullet', { x: this.sprite.x, y: this.sprite.y, angle: this.sprite.rotation, speed_x: speed_x, speed_y: speed_y })
        }
        if (!game.input.activePointer.leftButton.isDown) this.shot = false;


        if (this.sprite.alpha < 1) {
            this.sprite.alpha += (1 - this.sprite.alpha) * 0.16;
        } else {
            this.sprite.alpha = 1;
        }


        socket.emit('move-player', { x: this.sprite.x, y: this.sprite.y, angle: this.sprite.rotation })

    }


};

function CreateShip(type, x, y, angle) {

    const sprite = game.add.sprite(x, y, 'player');
    sprite.rotation = angle;
    sprite.anchor.setTo(0.5, 0.5);
    return sprite;
}


function preload() {
    game.load.crossOrigin = "Anonymous";
    // game.stage.backgroundColor = "#11111";

    game.load.image('player', ASSET_URL + 'player4.png');
    game.load.image('bullet', ASSET_URL + 'cannon_ball.png');
    game.load.image('water', ASSET_URL + 'water_tile.png');
}

function create() {

    for (let i = 0; i <= WORLD_SIZE.w / 64 + 1; i++) {
        for (let j = 0; j <= WORLD_SIZE.h / 64 + 1; j++) {
            const tile_sprite = game.add.sprite(i * 64, j * 64, 'water');
            tile_sprite.anchor.setTo(0.5, 0.5);
            tile_sprite.alpha = 0.5;
            water_tiles.push(tile_sprite);
        }
    }

    game.stage.disableVisibilityChange = true;



    player.sprite = game.add.sprite(Math.random() * WORLD_SIZE.w / 2 + WORLD_SIZE.w / 2, Math.random() * WORLD_SIZE.h / 2 + WORLD_SIZE.h / 2, 'player');
    player.sprite.anchor.setTo(0.5, 0.5);


    game.world.setBounds(0, 0, WORLD_SIZE.w, WORLD_SIZE.h);

    game.camera.x = player.sprite.x - WINDOW_WIDTH / 2;
    game.camera.y = player.sprite.y - WINDOW_HEIGHT / 2;

    socket = io();
    socket.emit('new-player', { x: player.sprite.x, y: player.sprite.y, angle: player.sprite.rotation, type: 1 })

    socket.on('update-players', (players_data) => {
        const players_found = {};

        for (let id in players_data) {

            if (other_players[id] == undefined && id != socket.id) {
                const data = players_data[id];
                const p = CreateShip(data.type, data.x, data.y, data.angle);
                other_players[id] = p;
                console.log("Created new player at (" + data.x + ", " + data.y + ")");
            }
            players_found[id] = true;


            if (id != socket.id) {
                other_players[id].target_x = players_data[id].x;
                other_players[id].target_y = players_data[id].y;
                other_players[id].target_rotation = players_data[id].angle;
            }


        }

        for (let id in other_players) {
            if (!players_found[id]) {
                other_players[id].destroy();
                delete other_players[id];
            }
        }

    })

    socket.on('bullets-update', (server_bullet_array) => {

        for (let i = 0; i < server_bullet_array.length; i++) {
            if (bullet_array[i] == undefined) {
                bullet_array[i] = game.add.sprite(server_bullet_array[i].x, server_bullet_array[i].y, 'bullet');
            } else {

                bullet_array[i].x = server_bullet_array[i].x;
                bullet_array[i].y = server_bullet_array[i].y;
            }
        }

        for (let i = server_bullet_array.length; i < bullet_array.length; i++) {
            bullet_array[i].destroy();
            bullet_array.splice(i, 1);
            i--;
        }

    })


    socket.on('player-hit', (id) => {
        if (id === socket.id) {
            //If this is you
            player.sprite.alpha = 0;
        } else {
            // Find the right player 
            other_players[id].alpha = 0;
        }
    })

}

function GameLoop() {
    player.update();

    const camera_x = player.sprite.x - WINDOW_WIDTH / 2;
    const camera_y = player.sprite.y - WINDOW_HEIGHT / 2;
    game.camera.x += (camera_x - game.camera.x) * 0.08;
    game.camera.y += (camera_y - game.camera.y) * 0.08;


    for (let id in other_players) {
        if (other_players[id].alpha < 1) {
            other_players[id].alpha += (1 - other_players[id].alpha) * 0.16;
        } else {
            other_players[id].alpha = 1;
        }
    }

    for (let id in other_players) {
        const p = other_players[id];
        if (p.target_x != undefined) {
            p.x += (p.target_x - p.x) * 0.16;
            p.y += (p.target_y - p.y) * 0.16;

            const angle = p.target_rotation;
            let dir = (angle - p.rotation) / (Math.PI * 2);
            dir -= Math.round(dir);
            dir = dir * Math.PI * 2;
            p.rotation += dir * 0.16;
        }
    }



}