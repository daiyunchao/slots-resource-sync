#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  checkResourceIntegrity,
  syncFacebookResources,
  syncNativeResources,
  updateReuseVersion
} from './tasks/index.js';
import logger from './utils/logger.js';
import { loadConfig } from './utils/config.js';

// 初始化配置
try {
  loadConfig();
} catch (error) {
  logger.error('Failed to load config', { error: error.message });
  process.exit(1);
}

// 创建MCP服务器
const server = new Server(
  {
    name: 'slots-resource-sync',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 定义可用的工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'check_resource_integrity',
        description: '检查资源完整性，验证iOS和Android资源是否完整',
        inputSchema: {
          type: 'object',
          properties: {
            version: {
              type: 'string',
              description: '版本号，例如: v885',
            },
          },
          required: ['version'],
        },
      },
      {
        name: 'sync_facebook_resources',
        description: '同步Facebook资源到指定版本',
        inputSchema: {
          type: 'object',
          properties: {
            version: {
              type: 'string',
              description: '版本号，例如: v885',
            },
          },
          required: ['version'],
        },
      },
      {
        name: 'sync_native_resources',
        description: '同步Native资源到指定版本',
        inputSchema: {
          type: 'object',
          properties: {
            version: {
              type: 'string',
              description: '版本号，例如: v885',
            },
          },
          required: ['version'],
        },
      },
      {
        name: 'update_reuse_version',
        description: '修改reuse资源版本，将指定版本移动到reuse_version',
        inputSchema: {
          type: 'object',
          properties: {
            version: {
              type: 'string',
              description: '当前版本号，例如: v885',
            },
            nginxReuseVersion: {
              type: 'string',
              description: 'Nginx reuse版本号（可选），如果不提供则使用version-2作为默认值',
            },
          },
          required: ['version'],
        },
      },
      {
        name: 'full_sync_pipeline',
        description: '执行完整的发布流程：检查资源完整性 -> 同步Facebook资源 -> 同步Native资源',
        inputSchema: {
          type: 'object',
          properties: {
            version: {
              type: 'string',
              description: '版本号，例如: v885',
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

  try {
    switch (name) {
      case 'check_resource_integrity': {
        logger.info('MCP: Executing check_resource_integrity', { version: args.version });
        const result = await checkResourceIntegrity(args.version);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: result.success,
                message: result.success ? '所有资源检查通过' : '资源检查失败',
                details: result.results.map(r => ({
                  name: r.name,
                  success: r.success,
                  stdout: r.stdout || null,
                  stderr: r.stderr || null
                }))
              }, null, 2),
            },
          ],
        };
      }

      case 'sync_facebook_resources': {
        logger.info('MCP: Executing sync_facebook_resources', { version: args.version });
        const result = await syncFacebookResources(args.version);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: result.success,
                message: result.success ? 'Facebook资源同步成功' : 'Facebook资源同步失败',
                output: result.stdout || null,
                error: result.stderr || null
              }, null, 2),
            },
          ],
        };
      }

      case 'sync_native_resources': {
        logger.info('MCP: Executing sync_native_resources', { version: args.version });
        const result = await syncNativeResources(args.version);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: result.success,
                message: result.success ? 'Native资源同步成功' : 'Native资源同步失败',
                output: result.stdout || null,
                error: result.stderr || null
              }, null, 2),
            },
          ],
        };
      }

      case 'update_reuse_version': {
        logger.info('MCP: Executing update_reuse_version', {
          version: args.version,
          nginxReuseVersion: args.nginxReuseVersion
        });
        const result = await updateReuseVersion(args.version, args.nginxReuseVersion);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: result.success,
                message: result.success ? 'Reuse版本更新成功' : 'Reuse版本更新失败',
                nginxReuseVersion: result.nginxReuseVersion,
                details: result.results.map(r => ({
                  name: r.name,
                  success: r.success,
                  stdout: r.stdout || null,
                  stderr: r.stderr || null
                }))
              }, null, 2),
            },
          ],
        };
      }

      case 'full_sync_pipeline': {
        logger.info('MCP: Executing full_sync_pipeline', {
          version: args.version,
          skipCheck: args.skipCheck
        });

        const results = [];

        // 步骤1: 检查资源完整性（如果不跳过）
        if (!args.skipCheck) {
          const checkResult = await checkResourceIntegrity(args.version);
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
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    message: '资源检查失败，终止发布流程',
                    results
                  }, null, 2),
                },
              ],
            };
          }
        }

        // 步骤2: 同步Facebook资源
        const fbResult = await syncFacebookResources(args.version);
        results.push({
          step: '同步Facebook资源',
          success: fbResult.success,
          stdout: fbResult.stdout || null,
          stderr: fbResult.stderr || null
        });

        if (!fbResult.success) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  message: 'Facebook资源同步失败，终止发布流程',
                  results
                }, null, 2),
              },
            ],
          };
        }

        // 步骤3: 同步Native资源
        const nativeResult = await syncNativeResources(args.version);
        results.push({
          step: '同步Native资源',
          success: nativeResult.success,
          stdout: nativeResult.stdout || null,
          stderr: nativeResult.stderr || null
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: nativeResult.success,
                message: nativeResult.success ? '完整发布流程执行成功' : 'Native资源同步失败',
                results
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error(`MCP tool execution failed: ${name}`, {
      error: error.message,
      stack: error.stack
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2),
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
  logger.info('MCP Server started');
}

main().catch((error) => {
  logger.error('MCP Server failed to start', { error: error.stack });
  process.exit(1);
});
