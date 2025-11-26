#!/usr/bin/env node

/**
 * SSE（Server-Sent Events）支持的API服务器
 * 支持长时间任务的实时流式输出
 */

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
import taskManager from './utils/task-manager.js';

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
const ALLOWED_IPS = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',').map(ip => ip.trim()) : [];

// 启动时输出配置信息
logger.info('=== API Server Configuration (SSE Enabled) ===');
logger.info(`Node version: ${process.version}`);
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`API Port: ${PORT}`);
logger.info(`API Key configured: ${API_KEY ? 'Yes' : 'No'}`);
logger.info(`Allowed IPs: ${ALLOWED_IPS.length > 0 ? ALLOWED_IPS.join(', ') : 'None (all IPs allowed)'}`);
logger.info(`Trust Proxy setting: ${process.env.TRUST_PROXY || '1 (default)'}`);
logger.info('================================================');

// 配置信任代理
const trustProxy = process.env.TRUST_PROXY || '1';
logger.info(`Configuring trust proxy with value: ${trustProxy}`);

if (trustProxy === 'false') {
  app.set('trust proxy', false);
  logger.info('Trust proxy: DISABLED (direct access mode)');
  console.log('🔧 Trust proxy: DISABLED - expecting direct API access');
} else if (trustProxy === 'true') {
  logger.warn('TRUST_PROXY=true is deprecated and insecure. Please use TRUST_PROXY=1 instead.');
  console.warn('⚠️  WARNING: TRUST_PROXY=true is insecure! Change to TRUST_PROXY=1 in .env file');
  app.set('trust proxy', 1);
  logger.info('Trust proxy: Set to 1 (auto-corrected from "true")');
  console.log('🔧 Trust proxy: Set to 1 (auto-corrected)');
} else if (!isNaN(trustProxy)) {
  const proxyCount = parseInt(trustProxy, 10);
  app.set('trust proxy', proxyCount);
  logger.info(`Trust proxy: Trusting ${proxyCount} proxy hop(s)`);
  console.log(`🔧 Trust proxy: Trusting ${proxyCount} proxy hop(s)`);
} else if (trustProxy === 'loopback') {
  app.set('trust proxy', 'loopback');
  logger.info('Trust proxy: LOOPBACK only (127.0.0.1, ::1)');
  console.log('🔧 Trust proxy: LOOPBACK only');
} else {
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

  console.log(`📥 ${req.method} ${req.path} | IP: ${clientIP} | ${new Date().toLocaleTimeString()}`);

  next();
});

// IP白名单中间件
const ipWhitelist = (req, res, next) => {
  if (ALLOWED_IPS.length === 0) {
    logger.warn('IP whitelist is not configured, allowing all IPs');
    return next();
  }

  const clientIP = req.ip || req.connection.remoteAddress;
  const normalizedClientIP = clientIP.replace('::ffff:', '');

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
    message: 'Resource Sync API (SSE Enabled)',
    endpoints: {
      'POST /api/tasks/check-integrity': {
        description: '异步检查资源完整性，返回taskId',
        body: { version: 'v885' }
      },
      'POST /api/tasks/sync-facebook': {
        description: '异步同步Facebook资源，返回taskId',
        body: { version: 'v885' }
      },
      'POST /api/tasks/sync-native': {
        description: '异步同步Native资源，返回taskId',
        body: { version: 'v885' }
      },
      'POST /api/tasks/update-reuse': {
        description: '异步更新Reuse版本，返回taskId',
        body: { version: 'v885', nginxReuseVersion: 'v883 (optional)' }
      },
      'POST /api/tasks/full-sync': {
        description: '异步完整发布流程，返回taskId',
        body: { version: 'v885', skipCheck: false }
      },
      'GET /api/tasks/:taskId/stream': {
        description: 'SSE流式获取任务实时输出'
      },
      'GET /api/tasks/:taskId/status': {
        description: '查询任务状态'
      },
      'GET /api/tasks': {
        description: '获取所有任务列表'
      }
    }
  });
});

/**
 * SSE流式输出端点
 */
app.get('/api/tasks/:taskId/stream', (req, res) => {
  const { taskId } = req.params;
  const task = taskManager.getTask(taskId);

  if (!task) {
    return res.status(404).json({
      success: false,
      error: 'Task not found'
    });
  }

  logger.info(`SSE stream started for task: ${taskId}`, { ip: req.ip });
  console.log(`📡 SSE stream connected for task ${taskId} from ${req.ip}`);

  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲

  // 发送初始数据
  res.write(`data: ${JSON.stringify({ type: 'connected', task })}\n\n`);

  // 发送历史日志
  if (task.logs && task.logs.length > 0) {
    task.logs.forEach(log => {
      res.write(`data: ${JSON.stringify({ type: 'log', log })}\n\n`);
    });
  }

  // 监听任务更新
  const eventHandler = (event) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      // 如果任务完成或失败，结束连接
      if (event.type === 'update' &&
          (event.task.status === 'completed' || event.task.status === 'failed')) {
        setTimeout(() => {
          res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
          res.end();
        }, 1000);
      }
    }
  };

  taskManager.subscribeTask(taskId, eventHandler);

  // 客户端断开连接时清理
  req.on('close', () => {
    taskManager.unsubscribeTask(taskId, eventHandler);
    logger.info(`SSE stream closed for task: ${taskId}`, { ip: req.ip });
    console.log(`📡 SSE stream disconnected for task ${taskId}`);
  });

  // 保持连接活跃（每30秒发送心跳）
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`: heartbeat\n\n`);
    } else {
      clearInterval(heartbeat);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

/**
 * 查询任务状态
 */
app.get('/api/tasks/:taskId/status', (req, res) => {
  const { taskId } = req.params;
  const task = taskManager.getTask(taskId);

  if (!task) {
    return res.status(404).json({
      success: false,
      error: 'Task not found'
    });
  }

  res.json({
    success: true,
    task
  });
});

/**
 * 获取所有任务
 */
app.get('/api/tasks', (req, res) => {
  const tasks = taskManager.getAllTasks();
  res.json({
    success: true,
    tasks: tasks.map(t => ({
      id: t.id,
      type: t.type,
      status: t.status,
      progress: t.progress,
      createdAt: t.createdAt,
      completedAt: t.completedAt
    }))
  });
});

/**
 * 异步任务执行辅助函数
 */
async function executeTaskAsync(taskId, taskFunction, ...args) {
  try {
    taskManager.startTask(taskId);
    const result = await taskFunction(...args, taskId);
    taskManager.completeTask(taskId, result);
  } catch (error) {
    taskManager.failTask(taskId, error);
    logger.error(`Task ${taskId} failed:`, { error: error.message, stack: error.stack });
  }
}

/**
 * 1. 异步检查资源完整性
 */
app.post('/api/tasks/check-integrity', (req, res) => {
  const { version } = req.body;

  if (!version) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: version'
    });
  }

  const taskId = taskManager.createTask('check-integrity', { version });

  logger.info(`Task created: check-integrity`, { taskId, version, ip: req.ip });
  console.log(`\n🆕 New task created: ${taskId}`);
  console.log(`   Type: check-integrity`);
  console.log(`   Version: ${version}`);
  console.log(`   Requested by: ${req.ip}`);

  // 异步执行任务
  executeTaskAsync(taskId, checkResourceIntegrity, version);

  res.json({
    success: true,
    taskId,
    message: 'Task created successfully',
    streamUrl: `/api/tasks/${taskId}/stream`,
    statusUrl: `/api/tasks/${taskId}/status`
  });
});

/**
 * 2. 异步同步Facebook资源
 */
app.post('/api/tasks/sync-facebook', (req, res) => {
  const { version } = req.body;

  if (!version) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: version'
    });
  }

  const taskId = taskManager.createTask('sync-facebook', { version });

  logger.info(`Task created: sync-facebook`, { taskId, version, ip: req.ip });
  console.log(`\n🆕 New task created: ${taskId}`);
  console.log(`   Type: sync-facebook`);
  console.log(`   Version: ${version}`);

  executeTaskAsync(taskId, syncFacebookResources, version);

  res.json({
    success: true,
    taskId,
    message: 'Task created successfully',
    streamUrl: `/api/tasks/${taskId}/stream`,
    statusUrl: `/api/tasks/${taskId}/status`
  });
});

/**
 * 3. 异步同步Native资源
 */
app.post('/api/tasks/sync-native', (req, res) => {
  const { version } = req.body;

  if (!version) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: version'
    });
  }

  const taskId = taskManager.createTask('sync-native', { version });

  logger.info(`Task created: sync-native`, { taskId, version, ip: req.ip });
  console.log(`\n🆕 New task created: ${taskId}`);
  console.log(`   Type: sync-native`);
  console.log(`   Version: ${version}`);

  executeTaskAsync(taskId, syncNativeResources, version);

  res.json({
    success: true,
    taskId,
    message: 'Task created successfully',
    streamUrl: `/api/tasks/${taskId}/stream`,
    statusUrl: `/api/tasks/${taskId}/status`
  });
});

/**
 * 4. 异步更新Reuse版本
 */
app.post('/api/tasks/update-reuse', (req, res) => {
  const { version, nginxReuseVersion } = req.body;

  if (!version) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: version'
    });
  }

  const taskId = taskManager.createTask('update-reuse', { version, nginxReuseVersion });

  logger.info(`Task created: update-reuse`, { taskId, version, nginxReuseVersion, ip: req.ip });
  console.log(`\n🆕 New task created: ${taskId}`);
  console.log(`   Type: update-reuse`);
  console.log(`   Version: ${version}`);
  console.log(`   Nginx Version: ${nginxReuseVersion || 'auto'}`);

  executeTaskAsync(taskId, updateReuseVersion, version, nginxReuseVersion);

  res.json({
    success: true,
    taskId,
    message: 'Task created successfully',
    streamUrl: `/api/tasks/${taskId}/stream`,
    statusUrl: `/api/tasks/${taskId}/status`
  });
});

/**
 * 5. 异步完整发布流程
 */
app.post('/api/tasks/full-sync', async (req, res) => {
  const { version, skipCheck = false } = req.body;

  if (!version) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: version'
    });
  }

  const taskId = taskManager.createTask('full-sync', { version, skipCheck });

  logger.info(`Task created: full-sync`, { taskId, version, skipCheck, ip: req.ip });
  console.log(`\n🆕 New task created: ${taskId}`);
  console.log(`   Type: full-sync`);
  console.log(`   Version: ${version}`);
  console.log(`   Skip Check: ${skipCheck}`);

  // 异步执行完整流程
  (async () => {
    try {
      taskManager.startTask(taskId);
      const results = [];

      // 步骤1: 检查资源完整性（如果不跳过）
      if (!skipCheck) {
        taskManager.updateProgress(taskId, 10);
        taskManager.addLog(taskId, {
          level: 'info',
          message: 'Step 1/3: Checking resource integrity...'
        });

        const checkResult = await checkResourceIntegrity(version, taskId);
        results.push({ step: 'check-integrity', ...checkResult });

        if (!checkResult.success) {
          taskManager.failTask(taskId, new Error('Integrity check failed'));
          return;
        }
      }

      // 步骤2: 同步Facebook资源
      taskManager.updateProgress(taskId, 40);
      taskManager.addLog(taskId, {
        level: 'info',
        message: 'Step 2/3: Syncing Facebook resources...'
      });

      const fbResult = await syncFacebookResources(version, taskId);
      results.push({ step: 'sync-facebook', ...fbResult });

      if (!fbResult.success) {
        taskManager.failTask(taskId, new Error('Facebook sync failed'));
        return;
      }

      // 步骤3: 同步Native资源
      taskManager.updateProgress(taskId, 70);
      taskManager.addLog(taskId, {
        level: 'info',
        message: 'Step 3/3: Syncing Native resources...'
      });

      const nativeResult = await syncNativeResources(version, taskId);
      results.push({ step: 'sync-native', ...nativeResult });

      if (!nativeResult.success) {
        taskManager.failTask(taskId, new Error('Native sync failed'));
        return;
      }

      taskManager.completeTask(taskId, { results });
    } catch (error) {
      taskManager.failTask(taskId, error);
    }
  })();

  res.json({
    success: true,
    taskId,
    message: 'Task created successfully',
    streamUrl: `/api/tasks/${taskId}/stream`,
    statusUrl: `/api/tasks/${taskId}/status`
  });
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
  console.log('🚀  API SERVER STARTED SUCCESSFULLY (SSE Enabled)');
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
  console.log(`   • SSE Support:     ✅ Enabled`);
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
