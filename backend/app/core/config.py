import os
from dotenv import load_dotenv

# 热重载支持：每次访问都重新加载环境变量
def reload_env():
    load_dotenv(override=True)

# 初始加载
reload_env()

class Settings:
    def __init__(self):
        self._env_cache = {}
        self._reload_settings()
    
    def _reload_settings(self):
        """重新加载所有设置"""
        reload_env()
        self._env_cache = {
            'OPENAI_API_KEY': os.getenv("OPENAI_API_KEY", ""),
            'OPENAI_API_BASE': os.getenv("OPENAI_API_BASE", "https://api.kkyyxx.xyz/v1"),
            'OPENAI_MODEL_NAME': os.getenv("OPENAI_MODEL_NAME", "openai/gpt-oss-20b"),
            'DATABASE_URL': os.getenv("DATABASE_URL", ""),
            'SECRET_KEY': os.getenv("SECRET_KEY", ""),
            'DEBUG': os.getenv("DEBUG", "False").lower() == "true",
            'CREDIBILITY_ROUNDS': int(os.getenv("CREDIBILITY_ROUNDS", "3") or 3),
            'CREDIBILITY_CONCURRENCY': int(os.getenv("CREDIBILITY_CONCURRENCY", "1") or 1),
            'CREDIBILITY_RANGE_PENALTY': float(os.getenv("CREDIBILITY_RANGE_PENALTY", "5.0") or 5.0),
            'CREDIBILITY_STAR_THRESHOLDS': [
                float(x) for x in (
                    os.getenv("CREDIBILITY_STAR_THRESHOLDS", "85,70,55,35") or "85,70,55,35"
                ).split(",") if x.strip()
            ],
        }
    
    @property
    def OPENAI_API_KEY(self) -> str:
        return self._env_cache['OPENAI_API_KEY']
    
    @property
    def OPENAI_API_BASE(self) -> str:
        return self._env_cache['OPENAI_API_BASE']
    
    @property
    def OPENAI_MODEL_NAME(self) -> str:
        return self._env_cache['OPENAI_MODEL_NAME']
    
    @property
    def DATABASE_URL(self) -> str:
        return self._env_cache['DATABASE_URL']
    
    @property
    def SECRET_KEY(self) -> str:
        return self._env_cache['SECRET_KEY']
    
    @property
    def DEBUG(self) -> bool:
        return self._env_cache['DEBUG']
    
    @property
    def CREDIBILITY_ROUNDS(self) -> int:
        return max(2, min(5, self._env_cache['CREDIBILITY_ROUNDS']))
    
    @property
    def CREDIBILITY_CONCURRENCY(self) -> int:
        return max(1, self._env_cache['CREDIBILITY_CONCURRENCY'])
    
    @property
    def CREDIBILITY_RANGE_PENALTY(self) -> float:
        return self._env_cache['CREDIBILITY_RANGE_PENALTY']
    
    @property
    def CREDIBILITY_STAR_THRESHOLDS(self) -> list:
        return self._env_cache['CREDIBILITY_STAR_THRESHOLDS']
    
    def reload(self):
        """手动重载配置"""
        self._reload_settings()
    
    @property
    def openai_api_key(self) -> str:
        if not self.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not set in environment variables")
        return self.OPENAI_API_KEY
    
    @property
    def openai_api_base(self) -> str:
        return self.OPENAI_API_BASE
    
    @property
    def openai_model_name(self) -> str:
        return self.OPENAI_MODEL_NAME

settings = Settings()