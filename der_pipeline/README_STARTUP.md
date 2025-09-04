# Backend Startup Guide

This guide explains how to start the document processing backend on Windows, addressing common issues with multiprocessing and port conflicts.

## 🚀 Quick Start

### Option 1: Stable Mode (Recommended for Windows)
```powershell
cd der_pipeline
python start_stable.py
```

**Pros:** Most stable, no crashes, good for development
**Cons:** No auto-reload - restart manually after code changes

### Option 2: Development Mode (Experimental)
```powershell
cd der_pipeline
python start_dev.py
```

**Pros:** Auto-reload on code changes
**Cons:** May have multiprocessing issues on Windows

### Option 3: Direct Command (Production)
```powershell
cd der_pipeline
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## 🔧 Troubleshooting

### Port Already in Use
If you see `[WinError 10013]` or port conflicts:

1. **Check what's using the port:**
   ```powershell
   netstat -ano | findstr :8000
   ```

2. **Kill the process:**
   ```powershell
   taskkill /PID <PID_NUMBER> /F
   ```

3. **Or use the startup scripts** - they automatically handle port conflicts.

### Server Keeps Crashing
If the server crashes with asyncio or multiprocessing errors:

1. **Use stable mode:** `python start_stable.py`
2. **Check Python version:** Ensure you're using Python 3.8-3.11 (3.13 may have issues)
3. **Kill all Python processes:**
   ```powershell
   taskkill /IM python.exe /F
   ```

### Multiprocessing Errors
If you see `spawn_main` or `CancelledError` issues:

1. **Use stable mode** - it disables multiprocessing entirely
2. **Or try development mode** - it uses 'spawn' method which is more Windows-compatible

## 📋 Server URLs

Once running, the server will be available at:
- **API:** http://127.0.0.1:8000
- **Health Check:** http://127.0.0.1:8000/health
- **API Docs:** http://127.0.0.1:8000/docs

## 🔍 Testing the Server

```powershell
# Test health endpoint
Invoke-WebRequest -Uri http://127.0.0.1:8000/health

# Test API health
Invoke-WebRequest -Uri http://127.0.0.1:8000/api/health

# View API documentation
Start-Process http://127.0.0.1:8000/docs
```

## ⚙️ Configuration

### Environment Variables
Set these if needed:
```powershell
$env:PYTHONPATH = "C:\path\to\der_pipeline"
$env:OPENAI_API_KEY = "your-api-key"
```

### Python Path Issues
If you see import errors, the startup scripts automatically set the correct Python path.

## 🎯 Best Practices

1. **For Development:** Use `start_stable.py` - it's reliable
2. **For Testing:** Use `start_dev.py` if you need auto-reload and can handle occasional crashes
3. **For Production:** Use the direct uvicorn command with appropriate host/port settings

## 📞 Support

If issues persist:
1. Kill all Python processes: `taskkill /IM python.exe /F`
2. Check port usage: `netstat -ano | findstr :8000`
3. Try a different port: Edit the scripts to use port 8001, 8002, etc.
4. Restart your computer if all else fails
