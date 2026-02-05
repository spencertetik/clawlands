#!/bin/bash
# Generate pixel art game asset using DALL-E

PROMPT="$1"
OUTPUT="$2"
SIZE="${3:-256x256}"

if [ -z "$PROMPT" ] || [ -z "$OUTPUT" ]; then
    echo "Usage: generate-asset.sh 'prompt' output.png [size]"
    exit 1
fi

source /Users/spencertetik/.openclaw/workspace/.env

RESPONSE=$(curl -s https://api.openai.com/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d "{
    \"model\": \"dall-e-3\",
    \"prompt\": \"$PROMPT\",
    \"n\": 1,
    \"size\": \"1024x1024\",
    \"quality\": \"standard\"
  }")

URL=$(echo "$RESPONSE" | grep -o '"url": "[^"]*"' | cut -d'"' -f4)

if [ -z "$URL" ]; then
    echo "Error generating image:"
    echo "$RESPONSE"
    exit 1
fi

curl -s "$URL" -o "$OUTPUT"
echo "Saved to $OUTPUT"
