#!/usr/bin/env python3
"""
Quick Kimi K2.5 image analysis - analyze existing screenshots
Usage: python kimi-analyze.py <image_path> [prompt]
"""

import openai
import base64
import os
import sys

def main():
    # Get API key
    api_key = os.environ.get('NVIDIA_API_KEY')
    if not api_key:
        print("❌ Set NVIDIA_API_KEY environment variable first")
        print("   export NVIDIA_API_KEY='nvapi-...'")
        sys.exit(1)
    
    # Get image path
    if len(sys.argv) < 2:
        print("Usage: python kimi-analyze.py <image_path> [custom_prompt]")
        print("\nExamples:")
        print("  python kimi-analyze.py playtest-screenshots/01_game_start.png")
        print("  python kimi-analyze.py screenshot.png 'Why does this character look wrong?'")
        sys.exit(1)
    
    image_path = sys.argv[1]
    custom_prompt = sys.argv[2] if len(sys.argv) > 2 else None
    
    if not os.path.exists(image_path):
        print(f"❌ File not found: {image_path}")
        sys.exit(1)
    
    # Default prompt for game analysis
    default_prompt = """Analyze this pixel art game screenshot for visual issues:

1. SPRITES: Check character/NPC sprites for scaling issues, wrong directions, animation problems
2. BUILDINGS: Check building alignment, door positions, doormat placement
3. UI: Check text readability, element alignment, z-ordering
4. TILES: Check for tile misalignment, gaps, or rendering issues
5. OVERALL: Note any visual bugs, glitches, or layout problems

Be specific about what you see and suggest fixes. Include pixel coordinates if relevant."""

    prompt = custom_prompt or default_prompt
    
    # Encode image
    with open(image_path, 'rb') as f:
        base64_image = base64.b64encode(f.read()).decode('utf-8')
    
    # Setup client
    client = openai.OpenAI(
        api_key=api_key,
        base_url="https://integrate.api.nvidia.com/v1"
    )
    
    print(f"🔍 Analyzing: {image_path}")
    print("-" * 50)
    
    try:
        response = client.chat.completions.create(
            model='moonshotai/kimi-k2.5',
            messages=[
                {
                    'role': 'system',
                    'content': 'You are a pixel art game visual debugger. Be specific and actionable.'
                },
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': prompt},
                        {
                            'type': 'image_url',
                            'image_url': {'url': f'data:image/png;base64,{base64_image}'}
                        }
                    ]
                }
            ],
            max_tokens=2048,
            extra_body={'thinking': {'type': 'disabled'}}  # Instant mode - faster
        )
        
        # Print reasoning if available
        reasoning = getattr(response.choices[0].message, 'reasoning_content', None)
        if reasoning:
            print("\n🧠 REASONING:")
            print(reasoning)
            print("-" * 50)
        
        print("\n💡 ANALYSIS:")
        print(response.choices[0].message.content)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
