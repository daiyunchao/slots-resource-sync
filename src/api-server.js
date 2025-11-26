#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import {
  checkResourceIntegrity,
  syncFacebookResources,
  syncNativeResources,
  updateReuseVersion
} from './tasks/index.js';
import logger from './utils/logger.js';
import { loadConfig } from './utils/config.js';

// 加载环境变量
dotenv.config();

// 初始化配置
try {
  loadConfig();
} catch (error) {
  logger.error('Failed to load config', { error: error.message });
  process.exit(1);
}

const app = express();
const PORT = process.env.API_PORT || 3000;
const API_KEY = process.env.API_KEY;
const ALLOWED_IPS = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : [];

// 配置信任代理（用于正确获取客户端IP）
// 如果应用在反向代理（Nginx, Apache等）后面运行，需要启用此设置
// 可以通过环境变量 TRUST_PROXY 配置：
// - true: 信任所有代理
// - false: 不信任代理
// - number: 信任指定数量的代理跳数
// - string: 自定义配置（如 'loopback, linklocal, uniquelocal'）
const trustProxy = process.env.TRUST_PROXY || 'true';
if (trustProxy === 'true') {
  app.set('trust proxy', true);
} else if (trustProxy === 'false') {
  app.set('trust proxy', false);
} else if (!isNaN(trustProxy)) {
  app.set('trust proxy', parseInt(trustProxy, 10));
} else {
  app.set('trust proxy', trustProxy);
}

// 安全性中间件
app.use(helmet());

// CORS配置
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// 请求体解析
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  logger.info(`API Request: ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// IP白名单中间件
const ipWhitelist = (req, res, next) => {
  if (ALLOWED_IPS.length === 0) {
    // 如果没有配置IP白名单，跳过检查但记录警告
    logger.warn('IP whitelist is not configured, allowing all IPs');
    return next();
  }

  const clientIP = req.ip || req.connection.remoteAddress;
  const normalizedClientIP = clientIP.replace('::ffff:', ''); // 处理IPv6映射的IPv4

  if (ALLOWED_IPS.includes(normalizedClientIP) || ALLOWED_IPS.includes('*')) {
    next();
  } else {
    logger.warn(`Blocked request from unauthorized IP: ${clientIP}`);
    res.status(403).json({
      success: false,
      error: 'Access denied: IP not in whitelist'
    });
  }
};

// API Key认证中间件
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!API_KEY) {
    logger.warn('API_KEY is not configured, allowing all requests');
    return next();
  }

  if (apiKey === API_KEY) {
    next();
  } else {
    logger.warn(`Invalid API key attempt from ${req.ip}`);
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid API key'
    });
  }
};

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制100个请求
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  }
});

app.use(limiter);

// 应用安全中间件到所有API路由
app.use('/api', ipWhitelist, apiKeyAuth);

// 健康检查端点（不需要认证）
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// API文档端点
app.get('/api', (req, res) => {
  res.json({
    success: true,
    endpoints: {
      'POST /api/check-integrity': {
        description: '检查资源完整性',
        body: { version: 'v885' }
      },
      'POST /api/sync-facebook': {
        description: '同步Facebook资源',
        body: { version: 'v885' }
      },
      'POST /api/sync-native': {
        description: '同步Native资源',
        body: { version: 'v885' }
      },
      'POST /api/update-reuse': {
        description: '更新Reuse版本',
        body: { version: 'v885', nginxReuseVersion: 'v883 (optional)' }
      },
      'POST /api/full-sync': {
        description: '完整发布流程',
        body: { version: 'v885', skipCheck: false }
      }
    }
  });
});

// 1. 检查资源完整性
app.post('/api/check-integrity', async (req, res) => {
  const { version } = req.body;

  if (!version) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: version'
    });
  }

  try {
    logger.info('API: Executing check_resource_integrity', { version });
    const result = await checkResourceIntegrity(version);

    res.json({
      success: result.success,
      message: result.success ? '所有资源检查通过' : '资源检查失败',
      details: result.results.map(r => ({
        name: r.name,
        success: r.success,
        stdout: r.stdout || null,
        stderr: r.stderr || null
      }))
    });
  } catch (error) {
    logger.error('API: check_resource_integrity failed', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 2. 同步Facebook资源
app.post('/api/sync-facebook', async (req, res) => {
  const { version } = req.body;

  if (!version) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: version'
    });
  }

  try {
    logger.info('API: Executing sync_facebook_resources', { version });
    const result = await syncFacebookResources(version);

    res.json({
      success: result.success,
      message: result.success ? 'Facebook资源同步成功' : 'Facebook资源同步失败',
      stdout: result.stdout || null,
      stderr: result.stderr || null
    });
  } catch (error) {
    logger.error('API: sync_facebook_resources failed', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3. 同步Native资源
app.post('/api/sync-native', async (req, res) => {
  const { version } = req.body;

  if (!version) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: version'
    });
  }

  try {
    logger.info('API: Executing sync_native_resources', { version });
    const result = await syncNativeResources(version);

    res.json({
      success: result.success,
      message: result.success ? 'Native资源同步成功' : 'Native资源同步失败',
      stdout: result.stdout || null,
      stderr: result.stderr || null
    });
  } catch (error) {
    logger.error('API: sync_native_resources failed', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 4. 更新Reuse版本
app.post('/api/update-reuse', async (req, res) => {
  const { version, nginxReuseVersion } = req.body;

  if (!version) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: version'
    });
  }

  try {
    logger.info('API: Executing update_reuse_version', {
      version,
      nginxReuseVersion
    });
    const result = await updateReuseVersion(version, nginxReuseVersion);

    res.json({
      success: result.success,
      message: result.success ? 'Reuse版本更新成功' : 'Reuse版本更新失败',
      nginxReuseVersion: result.nginxReuseVersion,
      details: result.results.map(r => ({
        name: r.name,
        success: r.success,
        stdout: r.stdout || null,
        stderr: r.stderr || null
      }))
    });
  } catch (error) {
    logger.error('API: update_reuse_version failed', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 5. 完整发布流程
app.post('/api/full-sync', async (req, res) => {
  const { version, skipCheck = false } = req.body;

  if (!version) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: version'
    });
  }

  try {
    logger.info('API: Executing full_sync_pipeline', { version, skipCheck });

    const results = [];

    // 步骤1: 检查资源完整性（如果不跳过）
    if (!skipCheck) {
      const checkResult = await checkResourceIntegrity(version);
      results.push({
        step: '检查资源完整性',
        success: checkResult.success,
        details: checkResult.results.map(r => ({
          name: r.name,
          success: r.success,
          stdout: r.stdout || null,
          stderr: r.stderr || null
        }))
      });

      if (!checkResult.success) {
        return res.json({
          success: false,
          message: '资源检查失败，终止发布流程',
          results
        });
      }
    }

    // 步骤2: 同步Facebook资源
    const fbResult = await syncFacebookResources(version);
    results.push({
      step: '同步Facebook资源',
      success: fbResult.success,
      stdout: fbResult.stdout || null,
      stderr: fbResult.stderr || null
    });

    if (!fbResult.success) {
      return res.json({
        success: false,
        message: 'Facebook资源同步失败，终止发布流程',
        results
      });
    }

    // 步骤3: 同步Native资源
    const nativeResult = await syncNativeResources(version);
    results.push({
      step: '同步Native资源',
      success: nativeResult.success,
      stdout: nativeResult.stdout || null,
      stderr: nativeResult.stderr || null
    });

    res.json({
      success: nativeResult.success,
      message: nativeResult.success ? '完整发布流程执行成功' : 'Native资源同步失败',
      results
    });
  } catch (error) {
    logger.error('API: full_sync_pipeline failed', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 启动服务器
app.listen(PORT, () => {
  logger.info(`API Server started on port ${PORT}`);
  console.log(`\n🚀 API Server is running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/health\n`);

  if (!API_KEY) {
    console.warn('⚠️  WARNING: API_KEY is not set! All requests will be accepted.');
  }

  if (ALLOWED_IPS.length === 0) {
    console.warn('⚠️  WARNING: ALLOWED_IPS is not set! All IPs will be accepted.\n');
  }
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
