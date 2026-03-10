// =====================================================================
// BİZİM EVRENE DOĞRU - Endless Runner
// =====================================================================

// --- RENDERER & SCENE ---
let scene, camera, renderer, clock;

// --- PLAYER & TEXTURES ---
let player;
const textureLoader = new THREE.TextureLoader();

function createFallbackTexture(text, color) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 128);
    return new THREE.CanvasTexture(c);
}

let texRun = createFallbackTexture('KOŞAN', '#e84393');
let texJump = createFallbackTexture('ZIPLAYAN', '#0984e3');
let texSlide = createFallbackTexture('EĞİLEN', '#fdcb6e');

function createIconTexture(type) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');

    if (type === 'skull') {
        ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = 'black';
        ctx.beginPath(); ctx.arc(64, 52, 30, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(46, 70, 36, 26);
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(51, 48, 8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(77, 48, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'black';
        ctx.fillRect(53, 86, 3, 10); ctx.fillRect(62, 86, 3, 10); ctx.fillRect(71, 86, 3, 10);
    } else if (type === 'heart') {
        ctx.fillStyle = '#ff4757';
        ctx.beginPath();
        ctx.moveTo(64, 30);
        ctx.bezierCurveTo(64, 20, 50, 0, 30, 0);
        ctx.bezierCurveTo(0, 0, 0, 45, 0, 45);
        ctx.bezierCurveTo(0, 70, 40, 95, 64, 120);
        ctx.bezierCurveTo(88, 95, 128, 70, 128, 45);
        ctx.bezierCurveTo(128, 45, 128, 0, 98, 0);
        ctx.bezierCurveTo(78, 0, 64, 20, 64, 30);
        ctx.fill();
    } else if (type === 'sun') {
        ctx.fillStyle = '#f1c40f';
        ctx.shadowBlur = 30; ctx.shadowColor = '#e67e22';
        ctx.beginPath(); ctx.arc(64, 64, 50, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'moon') {
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath(); ctx.arc(64, 64, 45, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath(); ctx.arc(82, 50, 40, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }
    return new THREE.CanvasTexture(c);
}

const texSkull = createIconTexture('skull');
const texHeart = createIconTexture('heart');
const texSun = createIconTexture('sun');
const texMoon = createIconTexture('moon');

textureLoader.load('assets/run.png', t => { texRun = t; if (player) player.material.map = texRun; });
textureLoader.load('assets/jump.png', t => { texJump = t; });
textureLoader.load('assets/slide.png', t => { texSlide = t; });

// --- PHYSICS ---
const GRAVITY = -32;
const JUMP_FORCE = 17;
let verticalVelocity = 0;
let isJumping = false;
let isSliding = false;

// --- GAME STATE ---
let isGameRunning = false;
let animationId;
let score = 0;
let gameSpeed = 28;
let heartsCollected = 0;
let extraLives = 0;
let isInvincible = false;

// --- SCENE OBJECTS ---
let groundMesh, groundMat;
let ambientLight, directionalLight;
let sunSprite, moonSprite;

// Road
let roadSegments = [];   // Walkable platform meshes only
let pitDecos = [];   // Visual pit walls & floors
let nextRoadX = 0;
const ROAD_AHEAD = 200;  // Keep this many units of road visible ahead

// Obstacles / collectibles
let obstacles = [];
let spawnTimer = 2;
let pitCooldown = 0; // Uçurumdan sonra engel çıkmasını geciktirir

// Background decorations
let decorations = [];
let decoTimer = 0;

// --- THEMES ---
const skyColors = [
    new THREE.Color(0x87CEEB),
    new THREE.Color(0x4CA1AF),
    new THREE.Color(0xFF7E5F),
    new THREE.Color(0x2C3E50),
];
const groundColors = [
    new THREE.Color(0x3aad2c),
    new THREE.Color(0xd4a843),
    new THREE.Color(0xc0522b),
    new THREE.Color(0x1d2b38),
];

// --- DOM ELEMENTS ---
// (queried after DOMContentLoaded via init)
let scoreDisplay, heartsDisplay, livesDisplay, finalScoreDisplay;
let startScreen, gameOverScreen;

// =====================================================================
// INIT
// =====================================================================
function init() {
    // DOM refs
    scoreDisplay = document.getElementById('score');
    heartsDisplay = document.getElementById('hearts');
    livesDisplay = document.getElementById('lives');
    finalScoreDisplay = document.getElementById('final-score');
    startScreen = document.getElementById('start-screen');
    gameOverScreen = document.getElementById('game-over-screen');

    document.getElementById('start-button').addEventListener('click', startGame);
    document.getElementById('restart-button').addEventListener('click', startGame);

    // Image upload handlers
    function bindUpload(id, setFn) {
        document.getElementById(id).addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                const img = new Image();
                img.onload = () => {
                    const tex = new THREE.Texture(img);
                    tex.needsUpdate = true;
                    setFn(tex);
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
    bindUpload('upload-run', tex => { texRun = tex; if (player && !isJumping && !isSliding) player.material.map = texRun; });
    bindUpload('upload-jump', tex => { texJump = tex; });
    bindUpload('upload-slide', tex => { texSlide = tex; });

    // Scene
    scene = new THREE.Scene();
    scene.background = skyColors[0].clone();
    scene.fog = new THREE.FogExp2(skyColors[0].getHex(), 0.012);

    // Camera - side-scrolling view
    camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 500);
    camera.position.set(0, 3, 15);
    camera.lookAt(0, 2, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Lights
    ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 40, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.set(1024, 1024);
    directionalLight.shadow.camera.left = -60;
    directionalLight.shadow.camera.right = 60;
    directionalLight.shadow.camera.top = 40;
    directionalLight.shadow.camera.bottom = -10;
    directionalLight.shadow.camera.far = 200;
    scene.add(directionalLight);

    // Ground plane (far background)
    const gGeo = new THREE.PlaneGeometry(600, 120);
    groundMat = new THREE.MeshLambertMaterial({ color: groundColors[0].clone() });
    groundMesh = new THREE.Mesh(gGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(0, -0.05, -10);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Sun & Moon
    sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texSun }));
    moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texMoon }));
    sunSprite.scale.set(14, 14, 1);
    moonSprite.scale.set(12, 12, 1);
    scene.add(sunSprite, moonSprite);

    // Player
    createPlayer();

    // Build initial road
    buildInitialRoad();

    // Clock
    clock = new THREE.Clock();

    // Resize
    window.addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    });

    // Controls
    document.addEventListener('keydown', onKeyDown);
    setupSwipe();

    // First render
    renderer.render(scene, camera);
}

// =====================================================================
// PLAYER
// =====================================================================
function createPlayer() {
    const mat = new THREE.SpriteMaterial({ map: texRun, color: 0xffffff });
    player = new THREE.Sprite(mat);
    player.scale.set(4, 4, 1);
    player.center.set(0.5, 0); // pivot at feet
    player.position.set(-5, 0, 0);
    scene.add(player);
}

// =====================================================================
// ROAD BUILDING
// =====================================================================
function buildInitialRoad() {
    roadSegments = [];
    pitDecos.forEach(d => scene.remove(d)); pitDecos = [];
    nextRoadX = -55;
    // Guarantee 20 solid blocks at start (no pits)
    for (let i = 0; i < 20; i++) {
        spawnSolidBlock();
    }
}

function spawnSolidBlock() {
    const shade = 0.88 + Math.random() * 0.12;
    const col = new THREE.Color(0xcc2200).multiplyScalar(shade);
    const geo = new THREE.BoxGeometry(10, 4, 10);
    const mat = new THREE.MeshPhongMaterial({ color: col, shininess: 5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(nextRoadX + 5, -2, 0); // center of block
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
    roadSegments.push(mesh);
    nextRoadX += 10;
}

function spawnPit() {
    const cx = nextRoadX + 4;
    const wallGeo = new THREE.BoxGeometry(0.6, 22, 10);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x6b1010 });

    const lw = new THREE.Mesh(wallGeo, wallMat);
    lw.position.set(nextRoadX, -11, 0);
    scene.add(lw); pitDecos.push(lw);

    const rw = new THREE.Mesh(wallGeo, wallMat);
    rw.position.set(nextRoadX + 8, -11, 0);
    scene.add(rw); pitDecos.push(rw);

    const fg = new THREE.PlaneGeometry(8, 12);
    const fm = new THREE.MeshBasicMaterial({ color: 0x060000 });
    const floor = new THREE.Mesh(fg, fm);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, -22, 0);
    scene.add(floor); pitDecos.push(floor);

    nextRoadX += 8;
    pitCooldown = 3.5; // Uçurumdan sonra 3.5sn engel çıkmasın
}

function ensureRoad() {
    // Spawn enough road/pits so we always have ROAD_AHEAD units visible
    const targetX = player.position.x + ROAD_AHEAD;
    while (nextRoadX < targetX) {
        // Don't spawn pit right at beginning
        if (score > 500 && Math.random() < 0.12) {
            spawnPit();
        } else {
            spawnSolidBlock();
        }
    }
}

// =====================================================================
// OBSTACLES / COLLECTIBLES
// =====================================================================
function spawnObstacle() {
    const r = Math.random();

    if (r < 0.28) {
        // Heart collectible
        const mat = new THREE.SpriteMaterial({ map: texHeart, color: 0xffffff });
        const heart = new THREE.Sprite(mat);
        heart.scale.set(1.6, 1.6, 1);
        heart.position.set(55, 1.2 + Math.random() * 2.5, 0);
        heart.userData = { type: 'heart' };
        scene.add(heart);
        obstacles.push(heart);
        return;
    }

    // Chemistry tube (low = jump, high = duck)
    const isLow = Math.random() > 0.45;

    const group = new THREE.Group();

    // Glass
    const glassGeo = new THREE.CylinderGeometry(0.5, 0.5, 2.5, 16);
    const glassMat = new THREE.MeshPhongMaterial({ color: 0xddddff, transparent: true, opacity: 0.38, shininess: 120, specular: 0xffffff });
    group.add(new THREE.Mesh(glassGeo, glassMat));

    // Liquid
    const liqGeo = new THREE.CylinderGeometry(0.38, 0.38, 1.7, 16);
    const liqCol = isLow ? 0xff3344 : 0x22dd66;
    const liquid = new THREE.Mesh(liqGeo, new THREE.MeshPhongMaterial({ color: liqCol, shininess: 60 }));
    liquid.position.y = -0.35;
    group.add(liquid);

    // Bubbles
    for (let b = 0; b < 4; b++) {
        const bub = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
        );
        bub.position.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 1.3, (Math.random() - 0.5) * 0.4);
        liquid.add(bub);
    }

    // Cork
    const cork = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.4, 14),
        new THREE.MeshLambertMaterial({ color: 0xc8a96e })
    );
    cork.position.y = 1.35;
    group.add(cork);

    // Skull label on low tube
    if (isLow) {
        const label = new THREE.Mesh(
            new THREE.PlaneGeometry(0.85, 0.85),
            new THREE.MeshBasicMaterial({ map: texSkull, transparent: true })
        );
        label.position.set(0, -0.15, 0.52);
        group.add(label);
    }

    group.userData = { type: isLow ? 'low' : 'high' };

    if (isLow) {
        group.position.set(55, 1.25, 0);
    } else {
        group.position.set(55, 4.2, 0);
        group.rotation.z = Math.PI;
    }

    scene.add(group);
    obstacles.push(group);
}

// =====================================================================
// BACKGROUND DECORATION
// =====================================================================
function spawnDecoration() {
    const isFence = Math.random() > 0.5;
    let mesh;
    if (isFence) {
        mesh = new THREE.Mesh(
            new THREE.BoxGeometry(2, 1, 0.2),
            new THREE.MeshLambertMaterial({ color: 0x7B4B2A })
        );
        mesh.position.set(60, 0.5, -4.5);
    } else {
        mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.9 + Math.random() * 0.7, 7, 7),
            new THREE.MeshLambertMaterial({ color: 0x1e7a1e })
        );
        mesh.position.set(60, 0.6, -3.5 - Math.random() * 2);
    }
    mesh.castShadow = true;
    scene.add(mesh);
    decorations.push(mesh);
}

// =====================================================================
// CONTROLS
// =====================================================================
function doJump() {
    if (!isGameRunning || isJumping || isSliding) return;
    verticalVelocity = JUMP_FORCE;
    isJumping = true;
    player.material.map = texJump;
}

function doSlide() {
    if (!isGameRunning || isJumping || isSliding) return;
    isSliding = true;
    player.material.map = texSlide;
    setTimeout(() => {
        isSliding = false;
        if (!isJumping) player.material.map = texRun;
    }, 800);
}

function onKeyDown(e) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') doJump();
    if (e.code === 'ArrowDown' || e.code === 'KeyS') doSlide();
}

function setupSwipe() {
    let sx = 0, sy = 0;
    const on = (ex, ey) => {
        const dx = ex - sx, dy = ey - sy;
        if (Math.abs(dx) < 40 && Math.abs(dy) < 40) return;
        if (Math.abs(dy) >= Math.abs(dx)) {
            if (dy < 0) doJump(); else doSlide();
        }
    };
    document.addEventListener('touchstart', e => { sx = e.changedTouches[0].screenX; sy = e.changedTouches[0].screenY; });
    document.addEventListener('touchend', e => on(e.changedTouches[0].screenX, e.changedTouches[0].screenY));
    let down = false;
    document.addEventListener('mousedown', e => { down = true; sx = e.screenX; sy = e.screenY; });
    document.addEventListener('mouseup', e => { if (!down) return; down = false; on(e.screenX, e.screenY); });
}

// =====================================================================
// GAME LIFECYCLE
// =====================================================================
function startGame() {
    if (isGameRunning) return;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    document.getElementById('mobile-controls').classList.remove('hidden');

    // Reset state
    score = 0; gameSpeed = 28;
    heartsCollected = 0; extraLives = 0; isInvincible = false;
    isJumping = false; isSliding = false; verticalVelocity = 0;
    pitCooldown = 0;

    scoreDisplay.innerText = 0;
    heartsDisplay.innerText = 0;
    livesDisplay.innerText = 0;

    player.position.set(-5, 0, 0);
    player.scale.set(4, 4, 1);
    player.material.map = texRun;
    player.material.color.setHex(0xffffff);

    // Clear scene objects
    obstacles.forEach(o => scene.remove(o)); obstacles = [];
    decorations.forEach(d => scene.remove(d)); decorations = [];
    roadSegments.forEach(s => scene.remove(s)); roadSegments = [];
    pitDecos.forEach(d => scene.remove(d)); pitDecos = [];

    buildInitialRoad();

    spawnTimer = 2;
    decoTimer = 0.3;
    isGameRunning = true;
    clock.start();
    animate();
}

function takeDamage() {
    if (isInvincible) return false;
    if (extraLives > 0) {
        extraLives--;
        livesDisplay.innerText = extraLives;
        isInvincible = true;
        player.material.color.setHex(0xff2222);
        setTimeout(() => {
            player.material.color.setHex(0xffffff);
            isInvincible = false;
        }, 1500);
        return false; // survived
    }
    gameOver();
    return true; // dead
}

function gameOver() {
    isGameRunning = false;
    cancelAnimationFrame(animationId);
    finalScoreDisplay.innerText = Math.floor(score);
    gameOverScreen.classList.remove('hidden');
    document.getElementById('mobile-controls').classList.add('hidden');
}

// =====================================================================
// UPDATE
// =====================================================================
function update(dt) {
    // 1. Score & speed
    score += gameSpeed * dt;
    gameSpeed += 0.08 * dt;
    scoreDisplay.innerText = Math.floor(score);

    // 2. Day/night theme
    const stage = Math.floor((score % 2000) / 500);
    const nextStage = (stage + 1) % 4;
    const lerp = (score % 500) / 500;

    const sky = skyColors[stage].clone().lerp(skyColors[nextStage], lerp);
    scene.background = sky;
    scene.fog.color = sky;
    groundMat.color.copy(groundColors[stage].clone().lerp(groundColors[nextStage], lerp));

    // 3. Sun & Moon orbit
    const angle = (score % 2000) / 2000 * Math.PI * 2;
    sunSprite.position.set(-5 + Math.cos(angle) * 55, Math.sin(angle) * 28, -20);
    moonSprite.position.set(-5 + Math.cos(angle + Math.PI) * 55, Math.sin(angle + Math.PI) * 28, -20);

    // 4. Player physics
    if (isJumping) {
        player.position.y += verticalVelocity * dt;
        verticalVelocity += GRAVITY * dt;

        // Stretch while jumping
        player.scale.y += (4 - player.scale.y) * 12 * dt;
        player.scale.x += (4 - player.scale.x) * 12 * dt;

        if (player.position.y <= 0) {
            player.position.y = 0;
            isJumping = false;
            verticalVelocity = 0;
            if (!isSliding) player.material.map = texRun;
            player.scale.y = 2.8; player.scale.x = 4.6; // squash on land
        }
    } else {
        if (isSliding) {
            player.scale.y += (1.9 - player.scale.y) * 18 * dt;
            player.scale.x += (4.8 - player.scale.x) * 18 * dt;
        } else {
            player.scale.y += (4 - player.scale.y) * 9 * dt;
            player.scale.x += (4 - player.scale.x) * 9 * dt;
        }
    }

    // 5. Move road and pits
    const playerX = player.position.x; // fixed at -5

    for (let i = roadSegments.length - 1; i >= 0; i--) {
        const seg = roadSegments[i];
        seg.position.x -= gameSpeed * dt;
        if (seg.position.x < playerX - 70) {
            scene.remove(seg);
            roadSegments.splice(i, 1);
        }
    }
    for (let i = pitDecos.length - 1; i >= 0; i--) {
        pitDecos[i].position.x -= gameSpeed * dt;
        if (pitDecos[i].position.x < playerX - 80) {
            scene.remove(pitDecos[i]);
            pitDecos.splice(i, 1);
        }
    }
    nextRoadX -= gameSpeed * dt;
    ensureRoad();

    // 6. Ground detection / pit fall
    let onGround = false;
    for (const seg of roadSegments) {
        // Block center is at seg.position.x, block is 10 wide, so it spans [cx-5, cx+5]
        if (Math.abs(seg.position.x - playerX) < 5.2) {
            onGround = true;
            break;
        }
    }

    if (!onGround && player.position.y <= 0 && !isJumping) {
        player.position.y -= 18 * dt;
        if (player.position.y < -6) {
            const died = takeDamage();
            if (!died) {
                // Respawn above next solid block
                player.position.y = 6;
                verticalVelocity = 0;
            }
        }
    }

    // 7. Spawn obstacles & decorations
    spawnTimer -= dt;
    if (pitCooldown > 0) pitCooldown -= dt; // Uçurum sonrası bekleme süresi azalsın
    if (spawnTimer <= 0 && pitCooldown <= 0) {
        spawnObstacle();
        spawnTimer = Math.max(1.5, 2.2 - gameSpeed / 55); // Min 1.5sn aralık
    }
    decoTimer -= dt;
    if (decoTimer <= 0) {
        spawnDecoration();
        decoTimer = 0.5 + Math.random() * 0.8;
    }

    // 8. Move decorations
    for (let i = decorations.length - 1; i >= 0; i--) {
        decorations[i].position.x -= gameSpeed * dt;
        if (decorations[i].position.x < playerX - 40) {
            scene.remove(decorations[i]);
            decorations.splice(i, 1);
        }
    }

    // 9. Move obstacles & collision
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.position.x -= gameSpeed * dt;

        // Collision zone: player is at x=-5
        // Kalpler için hem X hem Y ekseninde gerçek temas kontrolü
        if (obs.userData.type === 'heart') {
            const inX = obs.position.x > playerX - 1.3 && obs.position.x < playerX + 1.3;
            const pBottom = player.position.y + 0.3;
            const pTop = player.position.y + player.scale.y * 0.85;
            const heartY = obs.position.y;
            const inY = pTop > heartY - 0.9 && pBottom < heartY + 0.9;
            if (inX && inY) {
                heartsCollected++;
                if (heartsCollected >= 10) {
                    heartsCollected = 0;
                    extraLives++;
                    livesDisplay.innerText = extraLives;
                }
                heartsDisplay.innerText = heartsCollected;
                scene.remove(obs);
                obstacles.splice(i, 1);
            }
            // Ekrandan çıktıysa sil
            if (obs.position.x < playerX - 20) { scene.remove(obs); obstacles.splice(i, 1); }
            continue;
        }

        // Engeller için çarpışma (X alanı sabit)
        if (obs.position.x > playerX - 2.5 && obs.position.x < playerX + 2.5) {
            const pBottom = player.position.y + 0.4;
            const pTop = player.position.y + player.scale.y * 0.82;

            let hit = false;
            if (obs.userData.type === 'low' && pBottom < 2.5) hit = true;
            if (obs.userData.type === 'high' && pTop > 2.8) hit = true;

            if (hit && !isInvincible) {
                const died = takeDamage();
                if (!died) { scene.remove(obs); obstacles.splice(i, 1); }
            }
        }

        // Cull off-screen
        if (obs.position.x < playerX - 20) {
            scene.remove(obs);
            obstacles.splice(i, 1);
        }
    }
}

// =====================================================================
// ANIMATE LOOP
// =====================================================================
function animate() {
    if (!isGameRunning) return;
    animationId = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05); // cap delta to avoid huge jumps
    update(dt);
    renderer.render(scene, camera);
}

// =====================================================================
// BOOT
// =====================================================================
window.addEventListener('load', init);
