#!/bin/bash
# Script to check PixelLab generation status

API_KEY="2673d860-88b5-4c4e-a543-6ba5cd63eb21"

echo "🦞 Checking PixelLab Asset Generation Status..."
echo ""

# Character
echo "📦 Character (Humanoid Lobster):"
CHARACTER_ID="4f0a7076-32fc-4e97-8b4f-592c868037b5"
curl -s "https://api.pixellab.ai/v2/characters/$CHARACTER_ID" \
  -H "Authorization: Bearer $API_KEY" | \
  python3 -c "import sys, json; data = json.load(sys.stdin); print(f\"  Status: {data.get('status', 'unknown')}\"); print(f\"  URL: {data.get('image_url', 'not ready yet')}\"); print()"

# Tileset 1 - Sand/Water
echo "🏖️  Tileset 1 (Sand/Water):"
TILESET1_ID="62c30bca-a3ce-460b-9d38-bc953715340d"
curl -s "https://api.pixellab.ai/v2/tilesets/$TILESET1_ID" \
  -H "Authorization: Bearer $API_KEY" | \
  python3 -c "import sys, json; data = json.load(sys.stdin); print(f\"  Status: {data.get('status', 'unknown')}\"); print(f\"  URL: {data.get('image_url', 'not ready yet')}\"); print()"

# Tileset 2 - Grass
echo "🌱 Tileset 2 (Grass/Dirt):"
TILESET2_ID="9e8074bb-a707-4c2e-9810-165c9846e1a6"
curl -s "https://api.pixellab.ai/v2/tilesets/$TILESET2_ID" \
  -H "Authorization: Bearer $API_KEY" | \
  python3 -c "import sys, json; data = json.load(sys.stdin); print(f\"  Status: {data.get('status', 'unknown')}\"); print(f\"  URL: {data.get('image_url', 'not ready yet')}\"); print()"

echo "⏱️  Assets typically take 2-5 minutes to generate."
echo "Run this script again to check status!"
