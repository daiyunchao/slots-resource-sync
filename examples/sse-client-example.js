/**
 * Node.js SSE Client Example
 * 演示如何使用Node.js连接到SSE流式API
 */

import fetch from 'node-fetch';
import EventSource from 'eventsource';

// 配置
const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || '';
const VERSION = process.argv[2] || 'v885';
const TASK_TYPE = process.argv[3] || 'check-integrity';

console.log('🚀 Resource Sync API - Node.js SSE Client\n');
console.log(`API URL: ${API_URL}`);
console.log(`Task Type: ${TASK_TYPE}`);
console.log(`Version: ${VERSION}\n`);

/**
 * 创建任务
 */
async function createTask(taskType, version) {
  console.log(`📝 Creating task: ${taskType}...\n`);

  const response = await fetch(`${API_URL}/api/tasks/${taskType}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({ version })
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Failed to create task: ${data.error}`);
  }

  console.log(`✅ Task created successfully!`);
  console.log(`   Task ID: ${data.taskId}`);
  console.log(`   Stream URL: ${API_URL}${data.streamUrl}\n`);

  return data.taskId;
}

/**
 * 连接SSE流
 */
function connectSSE(taskId) {
  return new Promise((resolve, reject) => {
    const streamUrl = `${API_URL}/api/tasks/${taskId}/stream`;

    console.log(`📡 Connecting to SSE stream...\n`);
    console.log('─'.repeat(60));

    const eventSource = new EventSource(streamUrl);
    let taskResult = null;

    eventSource.onopen = () => {
      console.log('✅ SSE connection established\n');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          console.log(`📡 Stream connected for task: ${data.task.id}`);
          console.log(`   Status: ${data.task.status}`);
          console.log(`   Progress: ${data.task.progress}%\n`);
        } else if (data.type === 'log') {
          const log = data.log;
          const timestamp = new Date(log.timestamp).toLocaleTimeString();
          const icon = {
            info: '📋',
            stdout: '  ',
            stderr: '⚠️ ',
            error: '❌',
            success: '✅'
          }[log.level] || '  ';

          console.log(`${icon} [${timestamp}] ${log.message}`);
        } else if (data.type === 'update') {
          const task = data.task;
          console.log(`\n📊 Task Update:`);
          console.log(`   Status: ${task.status}`);
          console.log(`   Progress: ${task.progress}%`);

          if (task.status === 'completed') {
            console.log(`\n${'─'.repeat(60)}`);
            console.log('🎉 Task completed successfully!');
            console.log(`${'─'.repeat(60)}\n`);
            taskResult = task.result;
            eventSource.close();
            resolve(taskResult);
          } else if (task.status === 'failed') {
            console.log(`\n${'─'.repeat(60)}`);
            console.log(`❌ Task failed: ${task.error}`);
            console.log(`${'─'.repeat(60)}\n`);
            eventSource.close();
            reject(new Error(task.error));
          }
        } else if (data.type === 'end') {
          console.log('\n📡 Stream ended');
          eventSource.close();
          if (!taskResult) {
            resolve(null);
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

    // 处理Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n\n⏹️  Interrupted by user');
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
    // 创建任务
    const taskId = await createTask(TASK_TYPE, VERSION);

    // 连接SSE流
    const result = await connectSSE(taskId);

    if (result) {
      console.log('\n📊 Final Result:');
      console.log(JSON.stringify(result, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
