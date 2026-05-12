/**
 * TikTok Country Race Game - Main Game Engine
 * Handles canvas rendering, animations, WebSocket communication
 */

// ==================== GAME STATE ====================
const GameState = {
    socket: null,
    config: null,
    countries: {},
    leaderboard: [],
    isRunning: false,
    winner: null,
    canvas: null,
    ctx: null,
    camera: { x: 0, targetX: 0 },
    particles: [],
    animations: {
        frame: 0,
        lastTime: 0,
        deltaTime: 0
    },
    characterType: 'horse',
    backgroundTheme: 'mountain',
    laneHeight: 0,
    finishLineX: 0,
    raceDistance: 2000,
    images: {},
    sounds: {}
};

// ==================== SOCKET CONNECTION ====================
function connectSocket() {
    updateStatus('connecting', 'Connecting...');

    GameState.socket = io('http://localhost:5000');

    GameState.socket.on('connect', () => {
        console.log('Connected to server');
        updateStatus('online', 'Connected');
    });

    GameState.socket.on('disconnect', () => {
        console.log('Disconnected');
        updateStatus('offline', 'Disconnected');
    });

    GameState.socket.on('game_state', (data) => {
        console.log('Received game state:', data);
        GameState.config = data.config;
        GameState.countries = data.countries;
        GameState.leaderboard = data.leaderboard;
        GameState.isRunning = data.is_running;
        GameState.raceDistance = data.config.game_settings.race_distance;
        GameState.characterType = data.config.game_settings.character_type;
        GameState.backgroundTheme = data.config.game_settings.background_theme;

        // Update UI
        updateLeaderboard(data.leaderboard);
        updateRecentGifts(data.recent_gifts);
        populateCountrySelect();

        // Update character type selector
        document.getElementById('characterType').value = GameState.characterType;
        document.getElementById('backgroundTheme').value = GameState.backgroundTheme;

        // Update streamer name
        if (data.config.streamer) {
            document.getElementById('streamerName').textContent = 
                '@' + data.config.streamer.tiktok_username;
        }
    });

    GameState.socket.on('gift_received', (data) => {
        handleGiftReceived(data);
    });

    GameState.socket.on('game_started', () => {
        GameState.isRunning = true;
        showNotification('Race Started!', 'success');
    });

    GameState.socket.on('game_reset', () => {
        GameState.isRunning = false;
        GameState.winner = null;
        GameState.camera.x = 0;
        GameState.particles = [];
        showNotification('Race Reset!', 'info');
    });

    GameState.socket.on('new_comment', (data) => {
        addChatMessage(data.username, data.comment);
    });

    GameState.socket.on('tiktok_connected', (data) => {
        showNotification('Connected to @' + data.username + ' live!', 'success');
    });
}

function updateStatus(status, text) {
    const statusEl = document.getElementById('connectionStatus');
    const dot = statusEl.querySelector('.status-dot');
    const label = statusEl.querySelector('span:last-child');

    dot.className = 'status-dot ' + status;
    label.textContent = text;
}

// ==================== GIFT HANDLING ====================
function handleGiftReceived(data) {
    const country = GameState.countries[data.country_id];
    if (!country) return;

    // Update country position
    country.position = data.new_position;
    country.total_coins = (country.total_coins || 0) + data.coins;
    country.gift_count = (country.gift_count || 0) + data.gift_count;

    // Update leaderboard
    updateLeaderboard(data.leaderboard);

    // Show notification
    showGiftNotification(data);

    // Add particles
    addParticles(data.country_id, data.gift_emoji, data.coins);

    // Update recent gifts
    updateRecentGifts(data.recent_gifts);

    // Check for winner
    if (data.new_position >= GameState.raceDistance && !GameState.winner) {
        showWinnerModal(data.country_name, data.country_flag);
    }

    // Update camera target
    updateCameraTarget();
}

function showGiftNotification(data) {
    const container = document.getElementById('giftNotifications');
    const notif = document.createElement('div');
    notif.className = 'gift-notification';
    notif.innerHTML = `
        <div class="user">${escapeHtml(data.username)}</div>
        <div class="gift-info">
            ${data.gift_emoji} ${data.gift_count}x ${data.gift_name} 
            (+${data.coins} coins)
        </div>
        <div class="country">${data.country_flag} ${data.country_name}</div>
    `;
    container.appendChild(notif);

    setTimeout(() => notif.remove(), 5000);

    // Keep max 5 notifications
    while (container.children.length > 5) {
        container.removeChild(container.firstChild);
    }
}

function updateLeaderboard(leaderboard) {
    const container = document.getElementById('leaderboardSlots');
    container.innerHTML = '';

    const medals = ['🥇', '🥈', '🥉'];

    leaderboard.forEach((entry, index) => {
        const slot = document.createElement('div');
        slot.className = 'leaderboard-slot active';
        slot.innerHTML = `
            <span class="medal">${medals[index]}</span>
            <span class="flag">${entry.flag_emoji}</span>
            <span class="name">${entry.name}</span>
            <span class="score">${Math.floor(entry.position)}</span>
        `;
        container.appendChild(slot);
    });

    // Fill empty slots
    for (let i = leaderboard.length; i < 3; i++) {
        const slot = document.createElement('div');
        slot.className = 'leaderboard-slot empty';
        slot.innerHTML = `
            <span class="medal">${medals[i]}</span>
            <span class="flag">🏳️</span>
            <span class="name">---</span>
            <span class="score">0</span>
        `;
        container.appendChild(slot);
    }
}

function updateRecentGifts(gifts) {
    const container = document.getElementById('giftsList');
    container.innerHTML = '';

    gifts.forEach(gift => {
        const item = document.createElement('div');
        item.className = 'gift-item';
        item.innerHTML = `
            <span class="flag">${gift.country_flag}</span>
            <span class="gift-emoji">${gift.gift_emoji}</span>
            <span>${escapeHtml(gift.username)}</span>
            <span style="margin-left:auto; color: var(--accent);">+${gift.coins}</span>
        `;
        container.appendChild(item);
    });
}

function addChatMessage(username, message) {
    const container = document.getElementById('chatMessages');
    const msg = document.createElement('div');
    msg.className = 'chat-message';
    msg.innerHTML = `<span class="user">${escapeHtml(username)}:</span> ${escapeHtml(message)}`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;

    // Keep max 50 messages
    while (container.children.length > 50) {
        container.removeChild(container.firstChild);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(text, type) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#00ff88' : '#ff0050'};
        color: white;
        padding: 12px 24px;
        border-radius: 20px;
        font-weight: bold;
        z-index: 10000;
        animation: fadeIn 0.3s;
    `;
    notif.textContent = text;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}

// ==================== CANVAS GAME ENGINE ====================
function initCanvas() {
    GameState.canvas = document.getElementById('gameCanvas');
    GameState.ctx = GameState.canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Start game loop
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    GameState.canvas.width = container.clientWidth;
    GameState.canvas.height = container.clientHeight;

    // Calculate lane height based on country count
    const countryCount = Object.keys(GameState.countries || {}).length;
    GameState.laneHeight = countryCount > 0 ? 
        Math.min(60, GameState.canvas.height / countryCount) : 60;

    GameState.finishLineX = GameState.canvas.width - 100;
}

function gameLoop(timestamp) {
    const dt = timestamp - GameState.animations.lastTime;
    GameState.animations.lastTime = timestamp;
    GameState.animations.deltaTime = dt;
    GameState.animations.frame++;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
}

function update(dt) {
    // Update camera
    GameState.camera.x += (GameState.camera.targetX - GameState.camera.x) * 0.05;

    // Update particles
    GameState.particles = GameState.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= dt / 1000;
        p.alpha = Math.max(0, p.life / p.maxLife);
        return p.life > 0;
    });
}

function render() {
    const ctx = GameState.ctx;
    const w = GameState.canvas.width;
    const h = GameState.canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw background
    drawBackground(ctx, w, h);

    // Draw tracks
    drawTracks(ctx, w, h);

    // Draw finish line
    drawFinishLine(ctx, h);

    // Draw countries
    drawCountries(ctx, h);

    // Draw particles
    drawParticles(ctx);

    // Draw distance markers
    drawDistanceMarkers(ctx, h);
}

// ==================== BACKGROUND RENDERING ====================
function drawBackground(ctx, w, h) {
    const theme = GameState.backgroundTheme;
    const bg = GameState.config?.backgrounds?.[theme] || GameState.config?.backgrounds?.mountain;

    if (!bg) {
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, w, h);
        return;
    }

    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, h * 0.6);
    if (bg.sky_gradient) {
        bg.sky_gradient.forEach((color, i) => {
            gradient.addColorStop(i / (bg.sky_gradient.length - 1), color);
        });
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h * 0.6);

    // Ground
    ctx.fillStyle = bg.ground_color || '#c4a35a';
    ctx.fillRect(0, h * 0.6, w, h * 0.4);

    // Draw theme-specific elements
    if (theme === 'mountain') {
        drawMountains(ctx, w, h, bg);
    } else if (theme === 'stadium') {
        drawStadium(ctx, w, h, bg);
    } else if (theme === 'desert') {
        drawDesert(ctx, w, h, bg);
    }
}

function drawMountains(ctx, w, h, bg) {
    const colors = bg.mountain_colors || ['#2d3561', '#3d4a7a', '#5a6fa8'];
    const offset = GameState.camera.x * 0.2;

    colors.forEach((color, layer) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.6);

        for (let x = 0; x <= w + 100; x += 50) {
            const mountainX = x - offset * (layer + 1) * 0.3;
            const mountainH = 80 + Math.sin(mountainX * 0.01 + layer) * 40 + layer * 30;
            ctx.lineTo(x, h * 0.6 - mountainH);
        }

        ctx.lineTo(w, h * 0.6);
        ctx.closePath();
        ctx.fill();
    });
}

function drawStadium(ctx, w, h, bg) {
    const colors = bg.crowd_colors || ['#1a1a2e', '#16213e'];

    colors.forEach((color, i) => {
        ctx.fillStyle = color;
        const y = h * 0.3 + i * 40;
        ctx.fillRect(0, y, w, 35);

        // Crowd dots
        ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + i * 0.05})`;
        for (let x = 0; x < w; x += 8) {
            for (let cy = y + 5; cy < y + 30; cy += 8) {
                if (Math.random() > 0.5) {
                    ctx.fillRect(x, cy, 3, 3);
                }
            }
        }
    });

    // Stadium lights
    ctx.fillStyle = '#ffffff';
    for (let x = 50; x < w; x += 200) {
        ctx.fillRect(x, h * 0.2, 20, 60);
        const glow = ctx.createRadialGradient(x + 10, h * 0.25, 0, x + 10, h * 0.25, 80);
        glow.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
        glow.addColorStop(1, 'rgba(255, 255, 200, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - 70, h * 0.15, 160, 100);
    }
}

function drawDesert(ctx, w, h, bg) {
    const colors = bg.dune_colors || ['#C4956A', '#B8860B'];
    const offset = GameState.camera.x * 0.15;

    colors.forEach((color, layer) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.6);

        for (let x = 0; x <= w + 100; x += 30) {
            const duneX = x - offset * (layer + 1) * 0.2;
            const duneH = 40 + Math.sin(duneX * 0.008 + layer * 2) * 25;
            ctx.lineTo(x, h * 0.6 - duneH);
        }

        ctx.lineTo(w, h * 0.6);
        ctx.closePath();
        ctx.fill();
    });

    // Sun
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(w - 100, h * 0.15, 40, 0, Math.PI * 2);
    ctx.fill();

    const sunGlow = ctx.createRadialGradient(w - 100, h * 0.15, 40, w - 100, h * 0.15, 100);
    sunGlow.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
    sunGlow.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(w - 100, h * 0.15, 100, 0, Math.PI * 2);
    ctx.fill();
}

// ==================== TRACK RENDERING ====================
function drawTracks(ctx, w, h) {
    const countryIds = Object.keys(GameState.countries);
    const laneHeight = GameState.laneHeight;
    const startY = (h - countryIds.length * laneHeight) / 2;

    const bg = GameState.config?.backgrounds?.[GameState.backgroundTheme];

    countryIds.forEach((id, index) => {
        const country = GameState.countries[id];
        const y = startY + index * laneHeight;

        // Lane background
        ctx.fillStyle = country.lane_color || 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(0, y, w, laneHeight);

        // Lane border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + laneHeight);
        ctx.lineTo(w, y + laneHeight);
        ctx.stroke();

        // Track lines
        ctx.strokeStyle = bg?.track_lines || 'rgba(255, 255, 255, 0.05)';
        ctx.setLineDash([20, 20]);
        ctx.beginPath();
        ctx.moveTo(130, y + laneHeight / 2);
        ctx.lineTo(w, y + laneHeight / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Country name on track
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.font = `bold ${laneHeight * 0.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(country.name.toUpperCase(), w / 2, y + laneHeight * 0.7);
    });
}

// ==================== FINISH LINE ====================
function drawFinishLine(ctx, h) {
    const x = GameState.finishLineX - GameState.camera.x;

    if (x < -60 || x > GameState.canvas.width + 60) return;

    const size = 15;
    for (let y = 0; y < h; y += size) {
        for (let i = 0; i < 4; i++) {
            const isBlack = ((y / size) + i) % 2 === 0;
            ctx.fillStyle = isBlack ? '#000' : '#fff';
            ctx.fillRect(x + i * size, y, size, size);
        }
    }

    ctx.save();
    ctx.translate(x + 30, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 5;
    ctx.fillText('FINISH', 0, 0);
    ctx.restore();
}

// ==================== COUNTRY CHARACTERS ====================
function drawCountries(ctx, h) {
    const countryIds = Object.keys(GameState.countries);
    const laneHeight = GameState.laneHeight;
    const startY = (h - countryIds.length * laneHeight) / 2;

    countryIds.forEach((id, index) => {
        const country = GameState.countries[id];
        const y = startY + index * laneHeight;
        const x = 140 + country.position - GameState.camera.x;

        if (x < -100 || x > GameState.canvas.width + 100) return;

        // Draw flag
        ctx.font = `${laneHeight * 0.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(country.flag_emoji, 60, y + laneHeight / 2);

        // Draw country name
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${laneHeight * 0.22}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(country.name, 85, y + laneHeight / 2);

        // Draw character
        const charY = y + laneHeight / 2;

        if (GameState.characterType === 'horse') {
            drawHorse(ctx, x, charY, country.color, country.position);
        } else {
            drawSoccerPlayer(ctx, x, charY, country.color, country.position);
        }

        // Position indicator
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(Math.floor(country.position) + 'm', x, charY - 25);

        // Progress bar
        const progress = Math.min(1, country.position / GameState.raceDistance);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x - 25, charY + 20, 50, 6);
        ctx.fillStyle = country.color;
        ctx.fillRect(x - 25, charY + 20, 50 * progress, 6);

        // Finished indicator
        if (country.finished) {
            ctx.font = '24px Arial';
            ctx.fillText('🏁', x + 40, charY - 20);

            if (country.rank) {
                const badges = ['🥇', '🥈', '🥉'];
                ctx.font = '30px Arial';
                ctx.fillText(badges[country.rank - 1] || '🏅', x, charY - 40);
            }
        }
    });
}

// ==================== HORSE CHARACTER ====================
function drawHorse(ctx, x, y, color, position) {
    const frame = Math.floor(GameState.animations.frame / 5) % 4;
    const bounce = Math.sin(GameState.animations.frame * 0.15) * 3;
    const scale = 0.8;

    ctx.save();
    ctx.translate(x, y + bounce);
    ctx.scale(scale, scale);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 25, 30, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, -5, 25, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Neck
    ctx.beginPath();
    ctx.moveTo(15, -10);
    ctx.lineTo(30, -30);
    ctx.lineTo(20, -5);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.ellipse(32, -32, 12, 8, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.fillStyle = '#f0d5b8';
    ctx.beginPath();
    ctx.ellipse(40, -30, 6, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(34, -34, 2, 0, Math.PI * 2);
    ctx.fill();

    // Ear
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(28, -38);
    ctx.lineTo(30, -45);
    ctx.lineTo(32, -38);
    ctx.closePath();
    ctx.fill();

    // Mane
    ctx.fillStyle = darkenColor(color, 30);
    ctx.beginPath();
    ctx.moveTo(25, -35);
    ctx.quadraticCurveTo(20, -40, 15, -30);
    ctx.quadraticCurveTo(18, -25, 22, -28);
    ctx.fill();

    // Tail
    ctx.strokeStyle = darkenColor(color, 20);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-22, -5);
    const tailWave = Math.sin(GameState.animations.frame * 0.2 + frame) * 10;
    ctx.quadraticCurveTo(-35, -15 + tailWave, -30, -5);
    ctx.stroke();

    // Legs
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';

    const legOffset = frame * Math.PI / 2;
    const frontLeg1 = Math.sin(legOffset) * 10;
    const frontLeg2 = Math.sin(legOffset + Math.PI) * 10;
    const backLeg1 = Math.sin(legOffset + Math.PI / 2) * 10;
    const backLeg2 = Math.sin(legOffset + Math.PI * 1.5) * 10;

    ctx.beginPath(); ctx.moveTo(15, 5); ctx.lineTo(15 + frontLeg1, 25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, 5); ctx.lineTo(10 + frontLeg2, 25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, 5); ctx.lineTo(-10 + backLeg1, 25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-15, 5); ctx.lineTo(-15 + backLeg2, 25); ctx.stroke();

    // Hooves
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(15 + frontLeg1, 25, 3, 0, Math.PI * 2);
    ctx.arc(10 + frontLeg2, 25, 3, 0, Math.PI * 2);
    ctx.arc(-10 + backLeg1, 25, 3, 0, Math.PI * 2);
    ctx.arc(-15 + backLeg2, 25, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ==================== SOCCER PLAYER CHARACTER ====================
function drawSoccerPlayer(ctx, x, y, color, position) {
    const frame = Math.floor(GameState.animations.frame / 6) % 6;
    const bounce = Math.sin(GameState.animations.frame * 0.2) * 2;
    const scale = 0.9;

    ctx.save();
    ctx.translate(x, y + bounce);
    ctx.scale(scale, scale);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 28, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const skinColor = '#f0d5b8';

    // Jersey
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-12, -20);
    ctx.lineTo(12, -20);
    ctx.lineTo(15, 5);
    ctx.lineTo(-15, 5);
    ctx.closePath();
    ctx.fill();

    // Jersey stripe
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(-5, -20, 10, 25);

    // Jersey number
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('10', 0, -5);

    // Shorts
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-15, 5);
    ctx.lineTo(15, 5);
    ctx.lineTo(12, 15);
    ctx.lineTo(-12, 15);
    ctx.closePath();
    ctx.fill();

    // Shorts stripe
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 5); ctx.lineTo(-12, 15);
    ctx.moveTo(12, 5); ctx.lineTo(12, 15);
    ctx.stroke();

    // Head
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(0, -30, 10, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#2c1810';
    ctx.beginPath();
    ctx.arc(0, -33, 10, Math.PI, 0);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-3, -30, 1.5, 0, Math.PI * 2);
    ctx.arc(3, -30, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -27, 3, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Arms
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';

    const armSwing = Math.sin(GameState.animations.frame * 0.25 + frame) * 20;
    ctx.beginPath(); ctx.moveTo(-12, -15); ctx.lineTo(-20, -5 + armSwing); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, -15); ctx.lineTo(20, -5 - armSwing); ctx.stroke();

    // Legs
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 5;
    const legSwing = Math.sin(GameState.animations.frame * 0.3 + frame) * 15;

    ctx.beginPath(); ctx.moveTo(-8, 15); ctx.lineTo(-8 + legSwing, 28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 15); ctx.lineTo(8 - legSwing, 28); ctx.stroke();

    // Socks
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-8 + legSwing * 0.7, 22); ctx.lineTo(-8 + legSwing, 28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8 - legSwing * 0.7, 22); ctx.lineTo(8 - legSwing, 28); ctx.stroke();

    // Shoes
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(-8 + legSwing, 29, 5, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(8 - legSwing, 29, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soccer ball
    if (GameState.config?.character_presets?.soccer?.show_ball) {
        const ballBounce = Math.abs(Math.sin(GameState.animations.frame * 0.2)) * 8;
        drawSoccerBall(ctx, 15, 25 - ballBounce, 6);
    }

    ctx.restore();
}

function drawSoccerBall(ctx, x, y, radius) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, -radius * 0.4, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-radius * 0.4, radius * 0.2, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(radius * 0.4, radius * 0.2, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ==================== PARTICLES ====================
function addParticles(countryId, emoji, intensity) {
    const countryIds = Object.keys(GameState.countries);
    const index = countryIds.indexOf(countryId);
    const laneHeight = GameState.laneHeight;
    const h = GameState.canvas.height;
    const startY = (h - countryIds.length * laneHeight) / 2;
    const y = startY + index * laneHeight + laneHeight / 2;

    const count = Math.min(20, Math.max(5, intensity / 10));

    for (let i = 0; i < count; i++) {
        GameState.particles.push({
            x: 140 + GameState.countries[countryId].position - GameState.camera.x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 5 - 2,
            life: 2,
            maxLife: 2,
            alpha: 1,
            emoji: emoji,
            size: 12 + Math.random() * 8,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.2
        });
    }
}

function drawParticles(ctx) {
    GameState.particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.font = p.size + 'px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 0);
        ctx.restore();
    });
}

// ==================== DISTANCE MARKERS ====================
function drawDistanceMarkers(ctx, h) {
    const interval = 500;
    const startX = 140 - GameState.camera.x;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';

    for (let dist = 0; dist <= GameState.raceDistance + interval; dist += interval) {
        const x = startX + dist;
        if (x < 0 || x > GameState.canvas.width) continue;

        ctx.fillRect(x, h - 5, 1, 5);
        ctx.fillText(dist + 'm', x, h - 8);
    }

    const finishX = startX + GameState.raceDistance;
    if (finishX > 0 && finishX < GameState.canvas.width) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(GameState.raceDistance + 'm', finishX, h - 15);
    }
}

// ==================== CAMERA ====================
function updateCameraTarget() {
    let maxPos = 0;
    Object.values(GameState.countries).forEach(c => {
        if (c.position > maxPos) maxPos = c.position;
    });

    const targetX = Math.max(0, maxPos - GameState.canvas.width * 0.4);
    GameState.camera.targetX = targetX;
}

// ==================== UI CONTROLS ====================
function populateCountrySelect() {
    const select = document.getElementById('testCountry');
    select.innerHTML = '<option value="">Random Country</option>';

    Object.values(GameState.countries).forEach(country => {
        const option = document.createElement('option');
        option.value = country.id;
        option.textContent = country.flag_emoji + ' ' + country.name;
        select.appendChild(option);
    });
}

function sendTestGift() {
    const countryId = document.getElementById('testCountry').value;
    const giftName = document.getElementById('testGift').value;
    const count = parseInt(document.getElementById('testCount').value) || 1;

    if (GameState.socket) {
        GameState.socket.emit('manual_gift', {
            username: 'TestUser' + Math.floor(Math.random() * 1000),
            gift: giftName,
            count: count,
            country_id: countryId || undefined
        });
    }
}

function startGame() {
    if (GameState.socket) {
        GameState.socket.emit('start_game');
    }
}

function resetGame() {
    if (GameState.socket) {
        GameState.socket.emit('reset_game');
    }
}

function changeCharacterType() {
    GameState.characterType = document.getElementById('characterType').value;
    if (GameState.config) {
        GameState.config.game_settings.character_type = GameState.characterType;
    }
}

function changeBackground() {
    GameState.backgroundTheme = document.getElementById('backgroundTheme').value;
    if (GameState.config) {
        GameState.config.game_settings.background_theme = GameState.backgroundTheme;
    }
}

function togglePanel() {
    const panel = document.getElementById('giftsList');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function toggleControls() {
    const body = document.getElementById('controlBody');
    body.classList.toggle('collapsed');
}

function showWinnerModal(countryName, flag) {
    GameState.winner = countryName;
    document.getElementById('winnerCountry').textContent = flag;
    document.getElementById('winnerName').textContent = countryName;
    document.getElementById('winnerModal').classList.add('show');

    for (let i = 0; i < 100; i++) {
        GameState.particles.push({
            x: Math.random() * GameState.canvas.width,
            y: -20,
            vx: (Math.random() - 0.5) * 5,
            vy: Math.random() * 5 + 2,
            life: 5,
            maxLife: 5,
            alpha: 1,
            emoji: ['🎉', '🎊', '✨', '🌟', '💫', '🏆'][Math.floor(Math.random() * 6)],
            size: 20 + Math.random() * 15,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.3
        });
    }
}

function closeWinnerModal() {
    document.getElementById('winnerModal').classList.remove('show');
}

function hideInstructions() {
    document.getElementById('instructions').style.display = 'none';
}

// ==================== UTILITY ====================
function darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max((num >> 16) - amt, 0);
    const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
    const B = Math.max((num & 0x0000FF) - amt, 0);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    connectSocket();

    setTimeout(() => {
        if (document.getElementById('instructions').style.display !== 'none') {
            hideInstructions();
        }
    }, 10000);
});
