#!/usr/bin/env node

/**
 * Test Web App Startup Script
 * 
 * Quick startup script for the DER Pipeline Test Web Application.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function main() {
    console.log('🎨 Starting DER Pipeline Test Web Application...');
    console.log(`📁 Working directory: ${process.cwd()}`);
    
    // Check if package.json exists
    if (!fs.existsSync('package.json')) {
        console.error('❌ package.json not found. Please run this from the test_web_app directory.');
        process.exit(1);
    }
    
    // Check if node_modules exists
    if (!fs.existsSync('node_modules')) {
        console.log('📦 Installing dependencies...');
        const install = spawn('npm', ['install'], { stdio: 'inherit', shell: true });
        
        install.on('close', (code) => {
            if (code !== 0) {
                console.error('❌ npm install failed');
                process.exit(1);
            }
            startDevServer();
        });
    } else {
        startDevServer();
    }
}

function startDevServer() {
    console.log('🌐 Starting React development server...');
    console.log('📱 Application will open at: http://localhost:3000');
    console.log('🔗 Make sure DER Pipeline API is running at: http://localhost:8080');
    console.log('\nPress Ctrl+C to stop the development server\n');
    
    const start = spawn('npm', ['start'], { stdio: 'inherit', shell: true });
    
    start.on('close', (code) => {
        if (code !== 0) {
            console.error('❌ React development server failed to start');
            process.exit(1);
        }
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Development server stopped by user');
        start.kill('SIGINT');
        process.exit(0);
    });
}

if (require.main === module) {
    main();
}
