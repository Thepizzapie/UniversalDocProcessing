#!/usr/bin/env python3
"""
DER Pipeline Master Startup Script

Starts both the DER Pipeline API and Test Web Application.
"""

import os
import sys
import time
import subprocess
import threading
from pathlib import Path

def start_component(component_dir, start_command, component_name):
    """Start a component in its directory."""
    print(f"🚀 Starting {component_name}...")
    
    # Change to component directory
    original_dir = os.getcwd()
    component_path = Path(component_dir)
    
    if not component_path.exists():
        print(f"❌ Directory not found: {component_dir}")
        return None
    
    try:
        os.chdir(component_path)
        
        if component_name == "DER Pipeline API":
            # For Python component
            process = subprocess.Popen([sys.executable, "start.py"], 
                                     stdout=subprocess.PIPE, 
                                     stderr=subprocess.PIPE)
        else:
            # For Node.js component
            process = subprocess.Popen(["node", "start.js"], 
                                     stdout=subprocess.PIPE, 
                                     stderr=subprocess.PIPE,
                                     shell=True)
        
        print(f"✅ {component_name} started (PID: {process.pid})")
        return process
        
    except Exception as e:
        print(f"❌ Failed to start {component_name}: {e}")
        return None
    finally:
        os.chdir(original_dir)

def monitor_process(process, name):
    """Monitor a process and print its output."""
    while True:
        output = process.stdout.readline()
        if output == b'' and process.poll() is not None:
            break
        if output:
            print(f"[{name}] {output.decode().strip()}")

def main():
    """Start both components."""
    print("🌟 DER Pipeline - Complete System Startup")
    print("=" * 50)
    
    # Check prerequisites
    print("🔍 Checking prerequisites...")
    
    # Check Python
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ required")
        return 1
    
    # Check Node.js
    try:
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        if result.returncode != 0:
            print("❌ Node.js not found. Please install Node.js 16+")
            return 1
        print(f"✅ Node.js: {result.stdout.strip()}")
    except:
        print("❌ Node.js not found. Please install Node.js 16+")
        return 1
    
    print(f"✅ Python: {sys.version.split()[0]}")
    
    processes = []
    
    try:
        # Start DER Pipeline API
        api_process = start_component("der_pipeline", "start.py", "DER Pipeline API")
        if api_process:
            processes.append((api_process, "API"))
        
        # Wait a bit for API to start
        print("⏳ Waiting for API to initialize...")
        time.sleep(3)
        
        # Start Test Web App
        web_process = start_component("test_web_app", "start.js", "Test Web Application")
        if web_process:
            processes.append((web_process, "Web"))
        
        if not processes:
            print("❌ No components started successfully")
            return 1
        
        print("\n🎉 System startup complete!")
        print("📊 DER Pipeline API: http://localhost:8080")
        print("📚 API Documentation: http://localhost:8080/docs")
        print("🎨 Test Web App: http://localhost:3000")
        print("\nPress Ctrl+C to stop all components\n")
        
        # Monitor processes
        threads = []
        for process, name in processes:
            thread = threading.Thread(target=monitor_process, args=(process, name))
            thread.daemon = True
            thread.start()
            threads.append(thread)
        
        # Wait for interruption
        try:
            while all(p.poll() is None for p, _ in processes):
                time.sleep(1)
        except KeyboardInterrupt:
            pass
        
    except KeyboardInterrupt:
        pass
    finally:
        # Clean up processes
        print("\n🛑 Shutting down components...")
        for process, name in processes:
            if process.poll() is None:
                print(f"🔄 Stopping {name}...")
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
        
        print("✅ All components stopped")
        return 0

if __name__ == "__main__":
    sys.exit(main())
