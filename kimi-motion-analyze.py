#!/usr/bin/env python3
"""
Motion analysis - send multiple frames to Kimi for animation feedback
Usage: python kimi-motion-analyze.py <frames_dir> [prompt]
"""

import openai
import base64
import os
import sys
import glob

def main():
    api_key = os.environ.get('NVIDIA_API_KEY')
    if not api_key:
        print("❌ Set NVIDIA_API_KEY environment variable")
        sys.exit(1)
    
    frames_dir = sys.argv[1] if len(sys.argv) > 1 else 'playtest-videos/frames'
    custom_prompt = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Get frame files (sample every 5th frame for efficiency)
    frames = sorted(glob.glob(f'{frames_dir}/frame_*.png'))
    if not frames:
        print(f"❌ No frames found in {frames_dir}")
        sys.exit(1)
    
    # Sample frames for motion analysis (first, middle, last + some in between)
    sample_indices = [0, len(frames)//4, len(frames)//2, 3*len(frames)//4, len(frames)-1]
    sample_frames = [frames[i] for i in sample_indices if i < len(frames)]
    
    print(f"🎬 Analyzing {len(sample_frames)} frames from {len(frames)} total...")
    
    # Encode frames
    content = []
    
    default_prompt = """Analyze this sequence of game frames for motion/animation issues:

1. WALK ANIMATION: Is the walking cycle smooth? Look for jerky movements, missing frames, or wrong directions
2. CHARACTER MOVEMENT: Does the character move naturally? Check for sliding, teleporting, or unnatural speeds
3. TRANSITIONS: Are building entries/exits smooth? Check for pop-in or jarring scene changes
4. SHADOWS: Do shadows move correctly with characters?
5. SPRITE DIRECTION: Does the character face the right direction when walking?

These frames are sequential - analyze the motion between them. Be specific about timing issues."""

    content.append({'type': 'text', 'text': custom_prompt or default_prompt})
    
    for i, frame_path in enumerate(sample_frames):
        with open(frame_path, 'rb') as f:
            b64 = base64.b64encode(f.read()).decode('utf-8')
        content.append({
            'type': 'text', 
            'text': f'\n--- Frame {i+1}/{len(sample_frames)} (from sequence) ---'
        })
        content.append({
            'type': 'image_url',
            'image_url': {'url': f'data:image/png;base64,{b64}'}
        })
    
    client = openai.OpenAI(
        api_key=api_key,
        base_url="https://integrate.api.nvidia.com/v1"
    )
    
    print("🔍 Sending to Kimi K2.5...")
    
    try:
        response = client.chat.completions.create(
            model='moonshotai/kimi-k2.5',
            messages=[
                {'role': 'system', 'content': 'You are a pixel art game animator/motion analyst. Analyze frame sequences for animation quality.'},
                {'role': 'user', 'content': content}
            ],
            max_tokens=2048,
            extra_body={'thinking': {'type': 'disabled'}}
        )
        
        print("-" * 50)
        print("\n💡 MOTION ANALYSIS:")
        print(response.choices[0].message.content)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
