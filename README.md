# 🏆 TikTok Country Gift Race Game

A fully customizable TikTok Live interactive game where viewers send gifts to move their country's character (horse or soccer player) in a race to the finish line!

![Game Preview](preview.png)

## ✨ Features

- 🎮 **Real-time TikTok Live integration** - Automatically detects gifts from viewers
- 🐴 **Two character types** - Switch between Horse or Soccer Player modes
- 🏔️ **3 Background themes** - Mountain, Stadium, and Desert
- 🌍 **20+ Countries pre-configured** - Fully editable
- 🏅 **Live leaderboard** - Top 3 countries displayed in real-time
- 🎁 **Gift notifications** - Animated alerts when gifts are received
- 🎊 **Winner celebration** - Confetti and trophy animation when someone wins
- 📱 **Mobile-friendly** - Works on all screen sizes
- ⚙️ **Fully configurable** - Edit countries, flags, gifts, colors without coding

---

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Step 2: Configure Your Game

Edit `config/countries.json`:

```json
{
  "streamer": {
    "tiktok_username": "YOUR_TIKTOK_USERNAME"
  },
  "game_settings": {
    "character_type": "horse",
    "background_theme": "mountain"
  }
}
```

### Step 3: Start the Server

```bash
# Test mode (manual gifts)
python backend/server.py --test

# OR Live mode (connects to TikTok)
python backend/server.py --username YOUR_TIKTOK_USERNAME
```

### Step 4: Open the Game

Open your browser to: **http://localhost:5000**

### Step 5: Go Live on TikTok!

1. Open TikTok app
2. Go LIVE
3. Share your screen showing the game
4. Tell viewers to send gifts to move their country!

---

## ⚙️ Configuration Guide

### Adding/Removing Countries

Edit `config/countries.json`:

```json
{
  "countries": [
    {
      "id": "south_africa",
      "name": "South Africa",
      "flag_emoji": "🇿🇦",
      "flag_code": "ZA",
      "character_color": "#00A859",
      "lane_color": "rgba(0, 168, 89, 0.1)",
      "enabled": true,
      "gift_multiplier": 1.0
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (lowercase, no spaces) |
| `name` | Display name |
| `flag_emoji` | Country flag emoji |
| `flag_code` | ISO country code |
| `character_color` | Character color (hex) |
| `lane_color` | Track lane background color |
| `enabled` | Show/hide this country |
| `gift_multiplier` | Speed multiplier for this country |

### Changing Gift Values

```json
{
  "gift_values": {
    "Rose": { "coins": 1, "emoji": "🌹", "color": "#ff1744" },
    "Crown": { "coins": 500, "emoji": "👑", "color": "#ffd700" }
  }
}
```

### Switching Character Type

In the game UI, use the dropdown in the Control Panel, or set in config:

```json
{
  "game_settings": {
    "character_type": "horse"  // or "soccer"
  }
}
```

### Changing Background

In the game UI, use the dropdown, or set in config:

```json
{
  "game_settings": {
    "background_theme": "mountain"  // "mountain", "stadium", or "desert"
  }
}
```

---

## 🎮 Game Controls

| Button | Action |
|--------|--------|
| **Start Race** | Begin the race countdown |
| **Reset Race** | Reset all positions to zero |
| **Send Test Gift** | Simulate a gift for testing |
| **Character Type** | Switch between Horse/Soccer |
| **Background** | Change the scene |

---

## 🔧 Troubleshooting

### "TikTokLive not installed"
```bash
pip install TikTokLive
```

### "Cannot connect to TikTok"
- Make sure you are LIVE on TikTok
- Check your username is correct
- Try running in test mode first

### "Game not loading"
- Check server is running on port 5000
- Try refreshing the browser
- Check browser console for errors

---

## 📝 Gift Name Mapping

The game automatically normalizes gift names:

| TikTok Gift | Internal Name |
|-------------|---------------|
| Rose | Rose |
| TikTok | TikTok |
| GG | GG |
| Love | Love |
| Love You | Love You |
| Sun Cream | Sun Cream |
| Mirror | Mirror |
| Hat | Hat |
| Crown | Crown |
| Galaxy | Galaxy |
| Interstellar | Interstellar |
| TikTok Universe | TikTok Universe |

---

## 🎨 Customization Ideas

1. **Add your own country** - Edit the config JSON
2. **Change colors** - Modify `character_color` and `lane_color`
3. **Adjust race distance** - Change `race_distance` in game_settings
4. **Custom gift values** - Modify `gift_values` to match your preferences
5. **Add more backgrounds** - Edit the `backgrounds` section in config

---

## 📄 License

MIT License - Feel free to use and modify!

## 🙏 Credits

Built for TikTok Live streamers who want to engage their audience with interactive games!
