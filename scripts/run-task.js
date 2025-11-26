#!/usr/bin/env node

/**
 * 简化的命令行工具 - 像之前一样简单使用SSE API
 *
 * 使用示例：
 * node scripts/run-task.js check-integrity v885
 * node scripts/run-task.js sync-facebook v885
 * node scripts/run-task.js full-sync v885
 */

import fetch from 'node-fetch';
import EventSource from 'eventsource';

// 从环境变量或命令行参数获取配置
const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || '';

// 解析命令行参数
const taskType = process.argv[2];
const version = process.argv[3];
const skipCheck = process.argv.includes('--skip-check');

// 使用说明
if (!taskType || !version) {
  console.log('\n使用方法：');
  console.log('  node scripts/run-task.js <task-type> <version> [options]\n');
  console.log('任务类型：');
  console.log('  check-integrity    检查资源完整性');
  console.log('  sync-facebook      同步Facebook资源');
  console.log('  sync-native        同步Native资源');
  console.log('  update-reuse       更新Reuse版本');
  console.log('  full-sync          完整发布流程\n');
  console.log('选项：');
  console.log('  --skip-check       跳过检查（仅用于full-sync）\n');
  console.log('示例：');
  console.log('  node scripts/run-task.js check-integrity v885');
  console.log('  node scripts/run-task.js full-sync v886 --skip-check\n');
  console.log('环境变量：');
  console.log('  API_URL     API服务器地址（默认: http://localhost:3000）');
  console.log('  API_KEY     API密钥\n');
  process.exit(1);
}

// 验证任务类型
const validTasks = ['check-integrity', 'sync-facebook', 'sync-native', 'update-reuse', 'full-sync'];
if (!validTasks.includes(taskType)) {
  console.error(`❌ 无效的任务类型: ${taskType}`);
  console.error(`   有效的任务类型: ${validTasks.join(', ')}`);
  process.exit(1);
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║          Resource Sync Task Runner (SSE)                  ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');
console.log(`📍 API Server: ${API_URL}`);
console.log(`📝 Task Type:  ${taskType}`);
console.log(`📦 Version:    ${version}`);
if (skipCheck) console.log(`⏭️  Skip Check:  true`);
console.log('');

/**
 * 创建任务
 */
async function createTask() {
  console.log('🚀 Creating task...');

  try {
    const body = { version };
    if (taskType === 'full-sync') {
      body.skipCheck = skipCheck;
    }

    const response = await fetch(`${API_URL}/api/tasks/${taskType}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!data.success) {
      console.error(`\n❌ Failed to create task: ${data.error}\n`);
      process.exit(1);
    }

    console.log(`✅ Task created: ${data.taskId}\n`);
    console.log('─'.repeat(60));

    return data.taskId;
  } catch (error) {
    console.error(`\n❌ Network error: ${error.message}\n`);
    process.exit(1);
  }
}

/**
 * 连接SSE流并显示输出
 */
function streamTask(taskId) {
  return new Promise((resolve, reject) => {
    const streamUrl = `${API_URL}/api/tasks/${taskId}/stream`;
    const eventSource = new EventSource(streamUrl);

    let lastStatus = '';
    let lastProgress = 0;

    eventSource.onopen = () => {
      console.log('📡 Connected to task stream\n');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'log') {
          const log = data.log;
          const time = new Date(log.timestamp).toLocaleTimeString();

          // 根据日志级别显示不同颜色（使用ANSI颜色码）
          let prefix = '';
          if (log.level === 'info') prefix = '\x1b[36m📋\x1b[0m';       // 青色
          else if (log.level === 'success') prefix = '\x1b[32m✅\x1b[0m'; // 绿色
          else if (log.level === 'error') prefix = '\x1b[31m❌\x1b[0m';   // 红色
          else if (log.level === 'stderr') prefix = '\x1b[33m⚠️ \x1b[0m'; // 黄色
          else prefix = '   ';

          console.log(`${prefix} [${time}] ${log.message}`);

        } else if (data.type === 'update') {
          const task = data.task;

          // 只在状态或进度变化时显示
          if (task.status !== lastStatus || task.progress !== lastProgress) {
            console.log(`\n📊 Status: ${task.status} | Progress: ${task.progress}%`);
            lastStatus = task.status;
            lastProgress = task.progress;
          }

          if (task.status === 'completed') {
            console.log('\n' + '─'.repeat(60));
            console.log('🎉 Task Completed Successfully!');
            console.log('─'.repeat(60));

            if (task.result) {
              console.log('\n📋 Result Summary:');
              console.log(JSON.stringify(task.result, null, 2));
            }

            eventSource.close();
            resolve(task.result);

          } else if (task.status === 'failed') {
            console.log('\n' + '─'.repeat(60));
            console.log(`❌ Task Failed: ${task.error}`);
            console.log('─'.repeat(60));
            eventSource.close();
            reject(new Error(task.error));
          }
        }
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('\n❌ SSE connection error:', error.message);
      eventSource.close();
      reject(error);
    };

    // 处理 Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n\n⏹️  Task interrupted by user');
      eventSource.close();
      process.exit(0);
    });
  });
}

/**
 * 主函数
 */
async function main() {
  try {
    const taskId = await createTask();
    await streamTask(taskId);

    console.log('\n✅ All done!\n');
    process.exit(0);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

main();
