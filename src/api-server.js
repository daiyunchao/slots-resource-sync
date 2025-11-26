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

// 启动时输出配置信息
logger.info('=== API Server Configuration ===');
logger.info(`Node version: ${process.version}`);
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`API Port: ${PORT}`);
logger.info(`API Key configured: ${API_KEY ? 'Yes' : 'No'}`);
logger.info(`Allowed IPs: ${ALLOWED_IPS.length > 0 ? ALLOWED_IPS.join(', ') : 'None (all IPs allowed)'}`);
logger.info(`Trust Proxy setting: ${process.env.TRUST_PROXY || '1 (default)'}`);
logger.info('================================');

// 配置信任代理（用于正确获取客户端IP）
// 如果应用在反向代理（Nginx, Apache等）后面运行，需要启用此设置
// 可以通过环境变量 TRUST_PROXY 配置：
// - 1: 信任第一层代理（推荐，适用于单层Nginx代理）
// - 2: 信任两层代理
// - false: 不信任代理（直接访问API服务器时使用）
// - loopback: 只信任本地回环地址（127.0.0.1, ::1）
const trustProxy = process.env.TRUST_PROXY || '1';
logger.info(`Configuring trust proxy with value: ${trustProxy}`);

if (trustProxy === 'false') {
  app.set('trust proxy', false);
  logger.info('Trust proxy: DISABLED (direct access mode)');
  console.log('🔧 Trust proxy: DISABLED - expecting direct API access');
} else if (trustProxy === 'true') {
  // 兼容旧配置，但不推荐使用
  logger.warn('TRUST_PROXY=true is deprecated and insecure. Please use TRUST_PROXY=1 instead.');
  console.warn('⚠️  WARNING: TRUST_PROXY=true is insecure! Change to TRUST_PROXY=1 in .env file');
  app.set('trust proxy', 1); // 改为信任1层代理，而不是true
  logger.info('Trust proxy: Set to 1 (auto-corrected from "true")');
  console.log('🔧 Trust proxy: Set to 1 (auto-corrected)');
} else if (!isNaN(trustProxy)) {
  // 数字：信任指定数量的代理跳数
  const proxyCount = parseInt(trustProxy, 10);
  app.set('trust proxy', proxyCount);
  logger.info(`Trust proxy: Trusting ${proxyCount} proxy hop(s)`);
  console.log(`🔧 Trust proxy: Trusting ${proxyCount} proxy hop(s)`);
} else if (trustProxy === 'loopback') {
  // 只信任本地代理
  app.set('trust proxy', 'loopback');
  logger.info('Trust proxy: LOOPBACK only (127.0.0.1, ::1)');
  console.log('🔧 Trust proxy: LOOPBACK only');
} else {
  // 不支持的配置值，使用默认值
  logger.error(`Invalid TRUST_PROXY value: ${trustProxy}. Using default: 1`);
  console.error(`❌ ERROR: Invalid TRUST_PROXY value: ${trustProxy}. Using default: 1`);
  app.set('trust proxy', 1);
  logger.info('Trust proxy: Set to 1 (default fallback)');
  console.log('🔧 Trust proxy: Set to 1 (default fallback)');
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
  const clientIP = req.ip;
  const forwardedFor = req.get('X-Forwarded-For');
  const realIP = req.get('X-Real-IP');

  logger.info(`API Request: ${req.method} ${req.path}`, {
    ip: clientIP,
    'X-Forwarded-For': forwardedFor || 'none',
    'X-Real-IP': realIP || 'none',
    userAgent: req.get('user-agent')
  });

  // 控制台输出简化版（便于PM2查看）
  console.log(`📥 ${req.method} ${req.path} | IP: ${clientIP} | ${new Date().toLocaleTimeString()}`);

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
    logger.debug(`IP whitelist check passed for: ${normalizedClientIP}`);
    next();
  } else {
    logger.warn(`🚫 Blocked request from unauthorized IP: ${normalizedClientIP}`);
    console.log(`🚫 BLOCKED: IP ${normalizedClientIP} not in whitelist`);
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
    logger.debug(`API key authentication passed for ${req.ip}`);
    next();
  } else {
    logger.warn(`🔑 Invalid API key attempt from ${req.ip}`);
    console.log(`🔑 UNAUTHORIZED: Invalid API key from ${req.ip}`);
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
    logger.info('API: Executing check_resource_integrity', { version, ip: req.ip });
    console.log(`\n🔍 Starting integrity check for version: ${version}`);
    console.log(`   Requested by: ${req.ip} at ${new Date().toLocaleString()}`);

    const result = await checkResourceIntegrity(version);

    console.log(`✅ Integrity check completed: ${result.success ? 'SUCCESS' : 'FAILED'}\n`);

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
    logger.info('API: Executing sync_facebook_resources', { version, ip: req.ip });
    console.log(`\n📤 Starting Facebook resource sync for version: ${version}`);
    console.log(`   Requested by: ${req.ip} at ${new Date().toLocaleString()}`);

    const result = await syncFacebookResources(version);

    console.log(`${result.success ? '✅' : '❌'} Facebook sync completed: ${result.success ? 'SUCCESS' : 'FAILED'}\n`);

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
    logger.info('API: Executing sync_native_resources', { version, ip: req.ip });
    console.log(`\n📤 Starting Native resource sync for version: ${version}`);
    console.log(`   Requested by: ${req.ip} at ${new Date().toLocaleString()}`);

    const result = await syncNativeResources(version);

    console.log(`${result.success ? '✅' : '❌'} Native sync completed: ${result.success ? 'SUCCESS' : 'FAILED'}\n`);

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
      nginxReuseVersion,
      ip: req.ip
    });
    console.log(`\n🔄 Starting Reuse version update for version: ${version}`);
    console.log(`   Nginx Reuse Version: ${nginxReuseVersion || 'auto-calculate'}`);
    console.log(`   Requested by: ${req.ip} at ${new Date().toLocaleString()}`);

    const result = await updateReuseVersion(version, nginxReuseVersion);

    console.log(`${result.success ? '✅' : '❌'} Reuse update completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Nginx Version Used: ${result.nginxReuseVersion}\n`);

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
    logger.info('API: Executing full_sync_pipeline', { version, skipCheck, ip: req.ip });
    console.log(`\n🚀 Starting FULL SYNC PIPELINE for version: ${version}`);
    console.log(`   Skip Check: ${skipCheck}`);
    console.log(`   Requested by: ${req.ip} at ${new Date().toLocaleString()}`);
    console.log('   ================================================');

    const results = [];

    // 步骤1: 检查资源完整性（如果不跳过）
    if (!skipCheck) {
      console.log('\n   📋 Step 1/3: Checking resource integrity...');
      const checkResult = await checkResourceIntegrity(version);
      console.log(`   ${checkResult.success ? '✅' : '❌'} Step 1 completed`);
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
        console.log('   ❌ Pipeline FAILED at Step 1 (integrity check)');
        console.log('   ================================================\n');
        return res.json({
          success: false,
          message: '资源检查失败，终止发布流程',
          results
        });
      }
    }

    // 步骤2: 同步Facebook资源
    console.log('\n   📋 Step 2/3: Syncing Facebook resources...');
    const fbResult = await syncFacebookResources(version);
    console.log(`   ${fbResult.success ? '✅' : '❌'} Step 2 completed`);
    results.push({
      step: '同步Facebook资源',
      success: fbResult.success,
      stdout: fbResult.stdout || null,
      stderr: fbResult.stderr || null
    });

    if (!fbResult.success) {
      console.log('   ❌ Pipeline FAILED at Step 2 (Facebook sync)');
      console.log('   ================================================\n');
      return res.json({
        success: false,
        message: 'Facebook资源同步失败，终止发布流程',
        results
      });
    }

    // 步骤3: 同步Native资源
    console.log('\n   📋 Step 3/3: Syncing Native resources...');
    const nativeResult = await syncNativeResources(version);
    console.log(`   ${nativeResult.success ? '✅' : '❌'} Step 3 completed`);
    results.push({
      step: '同步Native资源',
      success: nativeResult.success,
      stdout: nativeResult.stdout || null,
      stderr: nativeResult.stderr || null
    });

    console.log('\n   ================================================');
    console.log(`   ${nativeResult.success ? '🎉 Pipeline COMPLETED SUCCESSFULLY' : '❌ Pipeline FAILED at Step 3'}`);
    console.log(`   Total steps: ${results.length}`);
    console.log('   ================================================\n');

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

  console.log('\n' + '='.repeat(60));
  console.log('🚀  API SERVER STARTED SUCCESSFULLY');
  console.log('='.repeat(60));
  console.log(`📍 Server URL:        http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
  console.log(`💚 Health Check:      http://localhost:${PORT}/health`);
  console.log('─'.repeat(60));
  console.log('📊 Configuration:');
  console.log(`   • Node Version:    ${process.version}`);
  console.log(`   • Environment:     ${process.env.NODE_ENV || 'development'}`);
  console.log(`   • API Key:         ${API_KEY ? '✅ Configured' : '❌ NOT SET'}`);
  console.log(`   • IP Whitelist:    ${ALLOWED_IPS.length > 0 ? `✅ ${ALLOWED_IPS.length} IP(s)` : '❌ NOT SET (All IPs allowed)'}`);
  console.log(`   • Trust Proxy:     ${process.env.TRUST_PROXY || '1 (default)'}`);
  console.log('─'.repeat(60));

  if (!API_KEY) {
    console.warn('⚠️  WARNING: API_KEY is not set! All requests will be accepted.');
    console.warn('   Run: node scripts/generate-api-key.js to generate one.\n');
  }

  if (ALLOWED_IPS.length === 0) {
    console.warn('⚠️  WARNING: ALLOWED_IPS is not set! All IPs will be accepted.');
    console.warn('   Set ALLOWED_IPS in .env file to restrict access.\n');
  }

  console.log('✅ Server is ready to accept connections');
  console.log('='.repeat(60) + '\n');

  logger.info('Server initialization completed');
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('\n⏹️  SIGTERM received, shutting down gracefully...');
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⏹️  SIGINT received (Ctrl+C), shutting down gracefully...');
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// 捕获未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Promise Rejection:', reason);
  logger.error('Unhandled Promise Rejection', {
    reason: reason,
    promise: promise
  });
});

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:', error);
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  // 给日志系统一些时间写入，然后退出
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});
