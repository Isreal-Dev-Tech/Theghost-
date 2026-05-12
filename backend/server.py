#!/usr/bin/env python3
"""
TikTok Live Country Race Game - Backend Server
Connects to TikTok Live, listens for gifts, and broadcasts to frontend via WebSocket
"""

import asyncio
import json
import sys
import os
import argparse
from datetime import datetime
from flask import Flask, render_template, send_from_directory
from flask_socketio import SocketIO, emit
from threading import Thread
import logging

# Suppress verbose logs
logging.getLogger('werkzeug').setLevel(logging.ERROR)

app = Flask(__name__, static_folder='../frontend', template_folder='../frontend')
app.config['SECRET_KEY'] = 'tiktok-race-game-secret'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Load configuration
CONFIG_PATH = os.path.join(os.path.dirname(__file__), '../config/countries.json')
config = {}
game_state = {
    'countries': {},
    'leaderboard': [],
    'is_running': False,
    'winner': None,
    'total_gifts': 0,
    'recent_gifts': []
}

# Gift name normalization
GIFT_ALIASES = {
    'rose': 'Rose',
    'tiktok': 'TikTok',
    'gg': 'GG',
    'love': 'Love',
    'loveyou': 'Love You',
    'suncream': 'Sun Cream',
    'mirror': 'Mirror',
    'hat': 'Hat',
    'crown': 'Crown',
    'galaxy': 'Galaxy',
    'interstellar': 'Interstellar',
    'tiktokuniverse': 'TikTok Universe',
    'universe': 'TikTok Universe'
}

def load_config():
    """Load and initialize configuration"""
    global config, game_state
    with open(CONFIG_PATH, 'r') as f:
        config = json.load(f)

    # Initialize game state for each enabled country
    for country in config['countries']:
        if country.get('enabled', True):
            game_state['countries'][country['id']] = {
                'id': country['id'],
                'name': country['name'],
                'flag_emoji': country['flag_emoji'],
                'flag_code': country['flag_code'],
                'color': country['character_color'],
                'position': 0,
                'total_coins': 0,
                'gift_count': 0,
                'last_gift_time': None,
                'recent_gifters': [],
                'finished': False,
                'finish_time': None,
                'rank': None
            }

    update_leaderboard()
    print(f"✅ Loaded {len(game_state['countries'])} countries")
    return config

def update_leaderboard():
    """Update leaderboard based on positions"""
    countries = list(game_state['countries'].values())

    # Sort by position (descending), then by finish time
    sorted_countries = sorted(countries, key=lambda x: (
        x['position'],
        -(x['finish_time'] or float('inf')) if x['finished'] else 0
    ), reverse=True)

    game_state['leaderboard'] = [
        {
            'rank': i + 1,
            'id': c['id'],
            'name': c['name'],
            'flag_emoji': c['flag_emoji'],
            'position': c['position'],
            'finished': c['finished']
        }
        for i, c in enumerate(sorted_countries[:3])
    ]

def process_gift(username, gift_name, gift_count=1, country_id=None):
    """Process a gift and update game state"""
    global game_state

    # Normalize gift name
    gift_key = gift_name.lower().replace(' ', '').replace('_', '')
    normalized_name = GIFT_ALIASES.get(gift_key, gift_name)

    # Get gift value from config
    gift_config = config.get('gift_values', {}).get(normalized_name, {})
    coins_per_gift = gift_config.get('coins', 1)
    total_coins = coins_per_gift * gift_count

    # If no country specified, find one based on username or random
    if not country_id:
        # Simple hash-based assignment for demo
        # In production, you might want viewers to choose their country
        country_ids = list(game_state['countries'].keys())
        country_id = country_ids[hash(username) % len(country_ids)]

    if country_id not in game_state['countries']:
        return False

    country = game_state['countries'][country_id]

    # Apply gift multiplier
    multiplier = config['countries'][next(
        i for i, c in enumerate(config['countries']) if c['id'] == country_id
    )].get('gift_multiplier', 1.0)

    total_coins = int(total_coins * multiplier)

    # Update country state
    old_position = country['position']
    country['position'] += total_coins * config['game_settings']['pixels_per_coin']
    country['total_coins'] += total_coins
    country['gift_count'] += gift_count
    country['last_gift_time'] = datetime.now().isoformat()

    # Add to recent gifters
    country['recent_gifters'].insert(0, {
        'username': username,
        'gift': normalized_name,
        'count': gift_count,
        'coins': total_coins,
        'time': datetime.now().isoformat()
    })
    country['recent_gifters'] = country['recent_gifters'][:10]  # Keep last 10

    # Check for finish
    if not country['finished'] and country['position'] >= config['game_settings']['race_distance']:
        country['finished'] = True
        country['finish_time'] = datetime.now().isoformat()
        finished_count = sum(1 for c in game_state['countries'].values() if c['finished'])
        country['rank'] = finished_count

        if finished_count == 1:
            game_state['winner'] = country['name']

    # Update total gifts
    game_state['total_gifts'] += gift_count

    # Add to recent gifts log
    game_state['recent_gifts'].insert(0, {
        'username': username,
        'country': country['name'],
        'country_flag': country['flag_emoji'],
        'gift': normalized_name,
        'gift_emoji': gift_config.get('emoji', '🎁'),
        'count': gift_count,
        'coins': total_coins,
        'time': datetime.now().isoformat()
    })
    game_state['recent_gifts'] = game_state['recent_gifts'][:50]

    update_leaderboard()

    # Broadcast to all connected clients
    socketio.emit('gift_received', {
        'country_id': country_id,
        'country_name': country['name'],
        'country_flag': country['flag_emoji'],
        'username': username,
        'gift_name': normalized_name,
        'gift_emoji': gift_config.get('emoji', '🎁'),
        'gift_count': gift_count,
        'coins': total_coins,
        'new_position': country['position'],
        'old_position': old_position,
        'leaderboard': game_state['leaderboard'],
        'recent_gifts': game_state['recent_gifts'][:5]
    })

    return True

# Flask routes
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

# SocketIO events
@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid if hasattr(request, 'sid') else 'unknown'}")
    emit('game_state', {
        'config': config,
        'countries': game_state['countries'],
        'leaderboard': game_state['leaderboard'],
        'is_running': game_state['is_running'],
        'recent_gifts': game_state['recent_gifts'][:10]
    })

@socketio.on('disconnect')
def handle_disconnect():
    print("Client disconnected")

@socketio.on('start_game')
def handle_start_game():
    game_state['is_running'] = True
    socketio.emit('game_started', {'timestamp': datetime.now().isoformat()})
    print("🎮 Game started!")

@socketio.on('reset_game')
def handle_reset_game():
    global game_state
    for country_id in game_state['countries']:
        game_state['countries'][country_id]['position'] = 0
        game_state['countries'][country_id]['total_coins'] = 0
        game_state['countries'][country_id]['gift_count'] = 0
        game_state['countries'][country_id]['finished'] = False
        game_state['countries'][country_id]['finish_time'] = None
        game_state['countries'][country_id]['rank'] = None
        game_state['countries'][country_id]['recent_gifters'] = []

    game_state['winner'] = None
    game_state['total_gifts'] = 0
    game_state['recent_gifts'] = []
    update_leaderboard()

    socketio.emit('game_reset', {'timestamp': datetime.now().isoformat()})
    print("🔄 Game reset!")

@socketio.on('manual_gift')
def handle_manual_gift(data):
    """For testing - simulate a gift"""
    username = data.get('username', 'TestUser')
    gift_name = data.get('gift', 'Rose')
    gift_count = data.get('count', 1)
    country_id = data.get('country_id')

    process_gift(username, gift_name, gift_count, country_id)
    print(f"🎁 Manual gift: {username} sent {gift_count}x {gift_name}")

@socketio.on('set_country')
def handle_set_country(data):
    """Allow setting country for a user"""
    username = data.get('username')
    country_id = data.get('country_id')
    # Store in a user-country mapping (implement as needed)
    emit('country_set', {'username': username, 'country_id': country_id})

# TikTok Live integration (async)
async def tiktok_live_listener(username):
    """Connect to TikTok Live and listen for gifts"""
    try:
        from TikTokLive import TikTokLiveClient
        from TikTokLive.events import ConnectEvent, GiftEvent, CommentEvent

        client = TikTokLiveClient(unique_id=f"@{username}")

        @client.on(ConnectEvent)
        async def on_connect(event: ConnectEvent):
            print(f"✅ Connected to @{username}'s live stream!")
            print(f"   Room ID: {event.room_id}")
            game_state['is_running'] = True
            socketio.emit('tiktok_connected', {
                'username': username,
                'room_id': event.room_id
            })

        @client.on(GiftEvent)
        async def on_gift(event: GiftEvent):
            try:
                gift_name = event.gift.name if hasattr(event.gift, 'name') else str(event.gift)
                gift_count = event.repeat_count if hasattr(event, 'repeat_count') else 1
                sender = event.user.unique_id if hasattr(event, 'user') else 'anonymous'

                print(f"🎁 Gift from {sender}: {gift_count}x {gift_name}")

                # Process the gift
                process_gift(sender, gift_name, gift_count)

            except Exception as e:
                print(f"Error processing gift: {e}")

        @client.on(CommentEvent)
        async def on_comment(event: CommentEvent):
            try:
                comment = event.comment if hasattr(event, 'comment') else ''
                user = event.user.unique_id if hasattr(event, 'user') else 'anonymous'

                # Check if comment contains country selection
                # e.g., "!country nigeria" or "#teamghana"
                socketio.emit('new_comment', {
                    'username': user,
                    'comment': comment,
                    'time': datetime.now().isoformat()
                })

            except Exception as e:
                print(f"Error processing comment: {e}")

        print(f"🔌 Connecting to @{username}...")
        await client.connect()

    except ImportError:
        print("⚠️ TikTokLive library not installed. Running in manual/test mode.")
        print("   Install with: pip install TikTokLive")
        print("   Or use manual gift sending for testing.")

        # Keep running for manual mode
        while True:
            await asyncio.sleep(1)

    except Exception as e:
        print(f"❌ TikTok connection error: {e}")
        print("   Make sure you are LIVE on TikTok!")

        # Retry connection
        await asyncio.sleep(5)
        await tiktok_live_listener(username)

def run_flask():
    """Run Flask-SocketIO server"""
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, use_reloader=False)

async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='TikTok Country Race Game')
    parser.add_argument('--username', '-u', help='TikTok username to connect to')
    parser.add_argument('--test', '-t', action='store_true', help='Run in test mode (no TikTok connection)')
    args = parser.parse_args()

    # Load configuration
    load_config()

    # Start Flask server in background thread
    flask_thread = Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()

    print("=" * 50)
    print("🎮 TikTok Country Race Game Server")
    print("=" * 50)
    print(f"📁 Config loaded: {len(game_state['countries'])} countries")
    print(f"🌐 Game URL: http://localhost:5000")
    print("=" * 50)

    if args.test or not args.username:
        print("⚠️ Running in TEST MODE")
        print("   Use the web interface to send manual gifts")
        print("   Or connect with: python server.py --username YOUR_TIKTOK_USERNAME")

        # Keep running
        while True:
            await asyncio.sleep(1)
    else:
        username = args.username.lstrip('@')
        print(f"🔌 Connecting to TikTok Live: @{username}")
        print("   Make sure you are LIVE before starting!")
        await tiktok_live_listener(username)

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
