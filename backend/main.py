#!/usr/bin/env python3
"""
智考AI平台 - 主应用入口
"""

from app.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)