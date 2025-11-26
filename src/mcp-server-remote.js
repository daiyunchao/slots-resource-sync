#!/usr/bin/env node

/**
 * MCP Server - 远程SSE API版本
 *
 * 连接到远程SSE API服务器，支持长时间任务执行和实时输出
 *
 * 配置方法：
 * 在 Claude Desktop 配置文件中添加：
 * {
 *   "mcpServers": {
 *     "slots-resource-sync-remote": {
 *       "command": "node",
 *       "args": ["/path/to/slots-resource-sync/src/mcp-server-remote.js"],
 *       "env": {
 *         "API_URL": "http://your-server:3000",
 *         "API_KEY": "your-api-key"
 *       }
 *     }
 *   }
 * }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import EventSource from 'eventsource';

// 从环境变量获取配置
const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || '';

// 日志到stderr（不影响MCP通信）
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logData = data ? `\n${JSON.stringify(data, null, 2)}` : '';
  console.error(`[${timestamp}] ${message}${logData}`);
}

log('MCP Server (Remote SSE) starting...');
log(`API URL: ${API_URL}`);
log(`API Key configured: ${API_KEY ? 'Yes' : 'No'}`);

/**
 * 创建远程任务
 */
async function createRemoteTask(taskType, params) {
  log(`Creating remote task: ${taskType}`, params);

  try {
    const response = await fetch(`${API_URL}/api/tasks/${taskType}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(params)
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to create task');
    }

    log(`Task created: ${data.taskId}`);
    return data.taskId;

  } catch (error) {
    log(`Failed to create task: ${error.message}`);
    throw error;
  }
}

/**
 * 通过SSE流式获取任务输出
 */
function streamTaskOutput(taskId) {
  return new Promise((resolve, reject) => {
    log(`Connecting to SSE stream for task: ${taskId}`);

    const streamUrl = `${API_URL}/api/tasks/${taskId}/stream`;
    const eventSource = new EventSource(streamUrl);

    let outputLines = [];
    let taskStatus = 'pending';
    let taskProgress = 0;
    let taskResult = null;

    // 超时保护（10分钟）
    const timeout = setTimeout(() => {
      log(`Task ${taskId} timed out after 10 minutes`);
      eventSource.close();
      reject(new Error('Task execution timed out (10 minutes)'));
    }, 10 * 60 * 1000);

    eventSource.onopen = () => {
      log('SSE connection established');
      outputLines.push('📡 Connected to remote task stream\n');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          outputLines.push(`🚀 Task started: ${data.task.id}\n`);
          outputLines.push(`   Type: ${data.task.type}\n`);
          outputLines.push(`   Status: ${data.task.status}\n\n`);

        } else if (data.type === 'log') {
          const log = data.log;
          const timestamp = new Date(log.timestamp).toLocaleTimeString();

          // 根据日志级别添加图标
          let icon = '  ';
          if (log.level === 'info') icon = '📋';
          else if (log.level === 'success') icon = '✅';
          else if (log.level === 'error') icon = '❌';
          else if (log.level === 'stderr') icon = '⚠️ ';

          outputLines.push(`${icon} [${timestamp}] ${log.message}\n`);

        } else if (data.type === 'update') {
          const task = data.task;
          taskStatus = task.status;
          taskProgress = task.progress;
          taskResult = task.result;

          outputLines.push(`\n📊 Progress: ${task.progress}% | Status: ${task.status}\n`);

          if (task.status === 'completed') {
            log('Task completed successfully');
            clearTimeout(timeout);
            eventSource.close();

            outputLines.push('\n' + '─'.repeat(60) + '\n');
            outputLines.push('🎉 Task Completed Successfully!\n');
            outputLines.push('─'.repeat(60) + '\n');

            if (taskResult) {
              outputLines.push('\n📋 Result:\n');
              outputLines.push(JSON.stringify(taskResult, null, 2) + '\n');
            }

            resolve({
              success: true,
              output: outputLines.join(''),
              result: taskResult
            });

          } else if (task.status === 'failed') {
            log(`Task failed: ${task.error}`);
            clearTimeout(timeout);
            eventSource.close();

            outputLines.push('\n' + '─'.repeat(60) + '\n');
            outputLines.push(`❌ Task Failed: ${task.error}\n`);
            outputLines.push('─'.repeat(60) + '\n');

            reject(new Error(task.error));
          }
        }
      } catch (error) {
        log('Failed to parse SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      log('SSE connection error:', error);
      clearTimeout(timeout);
      eventSource.close();

      outputLines.push('\n❌ SSE connection error\n');
      reject(new Error('SSE connection failed'));
    };
  });
}

/**
 * 执行远程任务（创建 + 流式获取输出）
 */
async function executeRemoteTask(taskType, params) {
  try {
    // 1. 创建任务
    const taskId = await createRemoteTask(taskType, params);

    // 2. 流式获取输出
    const result = await streamTaskOutput(taskId);

    return result;

  } catch (error) {
    log(`Remote task execution failed: ${error.message}`);
    throw error;
  }
}

// 创建MCP服务器
const server = new Server(
  {
    name: 'slots-resource-sync-remote',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 列出可用工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  log('Listing available tools');

  return {
    tools: [
      {
        name: 'check_resource_integrity_remote',
        description: '检查资源完整性（远程执行，支持长时间任务）。检查iOS和Android资源文件的完整性，以及版本匹配。实时返回执行输出。',
        inputSchema: {
          type: 'object',
          properties: {
            version: {
              type: 'string',
              description: '要检查的版本号，例如 v885 或 885',
            },
          },
          required: ['version'],
        },
      },
      {
        name: 'sync_facebook_resources_remote',
        description: '同步Facebook资源到生产环境（远程执行，支持长时间任务）。将指定版本的Facebook客户端资源同步到Nginx目录。实时返回执行输出。',
        inputSchema: {
          type: 'object',
          properties: {
            version: {
              type: 'string',
              description: '要同步的版本号，例如 v885',
            },
          },
          required: ['version'],
        },
      },
      {
        name: 'sync_native_resources_remote',
        description: '同步Native资源到生产环境（远程执行，支持长时间任务）。将指定版本的Native客户端资源同步到Nginx目录。实时返回执行输出。',
        inputSchema: {
          type: 'object',
          properties: {
            version: {
              type: 'string',
              description: '要同步的版本号，例如 v885',
            },
          },
          required: ['version'],
        },
      },
      {
        name: 'update_reuse_version_remote',
        description: '更新Reuse资源版本（远程执行，支持长时间任务）。将当前版本的资源目录移动到reuse_version，为新版本腾出空间。实时返回执行输出。',
        inputSchema: {
          type: 'object',
          properties: {
            version: {
              type: 'string',
              description: '当前版本号，例如 v885',
            },
            nginxReuseVersion: {
              type: 'string',
              description: 'Nginx的reuse版本号（可选）。如果不提供，将自动使用 version-2',
            },
          },
          required: ['version'],
        },
      },
      {
        name: 'full_sync_pipeline_remote',
        description: '执行完整的发布流程（远程执行，支持长时间任务）。按顺序执行：1) 检查资源完整性 2) 同步Facebook资源 3) 同步Native资源。实时返回执行输出和进度。',
        inputSchema: {
          type: 'object',
          properties: {
            version: {
              type: 'string',
              description: '要发布的版本号，例如 v885',
            },
            skipCheck: {
              type: 'boolean',
              description: '是否跳过资源完整性检查（默认false）',
              default: false,
            },
          },
          required: ['version'],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  log(`Tool called: ${name}`, args);

  try {
    let taskType;
    let params = {};

    switch (name) {
      case 'check_resource_integrity_remote':
        taskType = 'check-integrity';
        params = { version: args.version };
        break;

      case 'sync_facebook_resources_remote':
        taskType = 'sync-facebook';
        params = { version: args.version };
        break;

      case 'sync_native_resources_remote':
        taskType = 'sync-native';
        params = { version: args.version };
        break;

      case 'update_reuse_version_remote':
        taskType = 'update-reuse';
        params = {
          version: args.version,
          nginxReuseVersion: args.nginxReuseVersion || null
        };
        break;

      case 'full_sync_pipeline_remote':
        taskType = 'full-sync';
        params = {
          version: args.version,
          skipCheck: args.skipCheck || false
        };
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    // 执行远程任务
    const result = await executeRemoteTask(taskType, params);

    return {
      content: [
        {
          type: 'text',
          text: result.output,
        },
      ],
    };

  } catch (error) {
    log(`Tool execution failed: ${error.message}`);

    return {
      content: [
        {
          type: 'text',
          text: `❌ 执行失败: ${error.message}\n\n请检查：\n1. 远程API服务器是否正常运行\n2. API_URL和API_KEY配置是否正确\n3. 网络连接是否正常`,
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('MCP Server (Remote SSE) started successfully');
}

main().catch((error) => {
  log('Fatal error:', error);
  process.exit(1);
});
