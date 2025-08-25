#!/usr/bin/env python3
"""Test OpenAI API connection"""
import os
import json

def test_openai_connection():
    """Test the OpenAI API connection with the stored API key"""
    try:
        # Load config from file
        config_file = "config.json"
        if not os.path.exists(config_file):
            print("ERROR: config.json not found")
            return False

        with open(config_file, 'r') as f:
            config = json.load(f)

        api_key = config.get('openai_api_key')
        model = config.get('llm_model', 'gpt-4o')

        if not api_key:
            print("ERROR: No API key found in config.json")
            return False

        print(f"Testing API connection with model: {model}")

        # Import OpenAI with proper error handling
        try:
            from openai import OpenAI
        except ImportError:
            print("ERROR: OpenAI library not installed")
            return False

        # Create client
        client = OpenAI(api_key=api_key)

        # Test the connection
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say 'Hello, API is working!'"}],
            max_tokens=50,
            temperature=0.1
        )

        result = response.choices[0].message.content.strip()
        print(f"SUCCESS: API Response: {result}")
        return True

    except Exception as e:
        print(f"ERROR: API connection failed: {e}")
        return False

if __name__ == "__main__":
    success = test_openai_connection()
    exit(0 if success else 1)
