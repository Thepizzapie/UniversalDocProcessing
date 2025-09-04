#!/usr/bin/env python3
"""
Development startup script for the document processing backend.
Handles Windows-specific issues and provides robust error handling.
"""

import multiprocessing
import os
import socket
import sys
import time
import uvicorn
from contextlib import closing


def check_port_available(host: str, port: int) -> bool:
    """Check if a port is available on the given host."""
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.settimeout(1)
        try:
            result = sock.connect_ex((host, port))
            return result != 0  # 0 means connection successful (port in use)
        except:
            return True


def kill_process_on_port(port: int):
    """Attempt to kill process using the specified port (Windows only)."""
    if sys.platform != 'win32':
        return

    try:
        import subprocess
        # Use netstat to find process using the port
        result = subprocess.run(['netstat', '-ano'], capture_output=True, text=True)
        lines = result.stdout.split('\n')

        for line in lines:
            if f':{port}' in line and 'LISTENING' in line:
                parts = line.split()
                if len(parts) >= 5:
                    pid = parts[-1]
                    try:
                        subprocess.run(['taskkill', '/PID', pid, '/F'], capture_output=True)
                        print(f"DEBUG: Killed process {pid} using port {port}")
                        time.sleep(1)  # Wait for port to be freed
                        break
                    except:
                        pass
    except:
        pass


def main():
    """Start the FastAPI application with robust error handling."""

    host = "127.0.0.1"  # Use localhost instead of 0.0.0.0 to avoid permission issues
    port = 8000

    print(f"DEBUG: Checking if port {port} is available...")
    if not check_port_available(host, port):
        print(f"WARNING: Port {port} is in use. Attempting to free it...")
        kill_process_on_port(port)

        # Wait and check again
        time.sleep(2)
        if not check_port_available(host, port):
            print(f"ERROR: Port {port} is still in use. Please free the port or use a different one.")
            print("You can try: netstat -ano | findstr :8000")
            print("Then: taskkill /PID <PID> /F")
            return

    # Set multiprocessing start method for Windows compatibility
    if sys.platform == 'win32':
        try:
            multiprocessing.set_start_method('spawn', force=True)
            print("DEBUG: Set multiprocessing start method to 'spawn' for Windows compatibility")
        except RuntimeError:
            print("DEBUG: Multiprocessing start method already set")

    # Set Python path if not already set
    if 'PYTHONPATH' not in os.environ:
        der_pipeline_path = os.path.dirname(os.path.abspath(__file__))
        os.environ['PYTHONPATH'] = der_pipeline_path
        print(f"DEBUG: Set PYTHONPATH to {der_pipeline_path}")

    print(f"DEBUG: Starting server on {host}:{port}")

    try:
        # Start the server with better Windows compatibility
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            reload=True,
            reload_dirs=["app"],
            log_level="info",
            access_log=True,
            # Windows-specific settings
            workers=1,  # Single worker to avoid multiprocessing issues
            loop="asyncio"
        )
    except KeyboardInterrupt:
        print("\nDEBUG: Server shutdown requested by user")
    except Exception as e:
        print(f"ERROR: Failed to start server: {e}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
