import { spawn } from 'child_process';
import logger from './logger.js';
import taskManager from './task-manager.js';

/**
 * 执行命令并实时流式输出
 * @param {string} command - 命令
 * @param {Array} args - 参数数组
 * @param {string} taskId - 任务ID
 * @param {Object} options - 额外选项
 * @returns {Promise<{success: boolean, stdout: string, stderr: string}>}
 */
export function executeCommandStream(command, args = [], taskId = null, options = {}) {
  return new Promise((resolve, reject) => {
    logger.info(`Executing command: ${command} ${args.join(' ')}`, { taskId });

    if (taskId) {
      taskManager.addLog(taskId, {
        level: 'info',
        message: `Executing: ${command} ${args.join(' ')}`
      });
    }

    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      shell: true
    });

    let stdout = '';
    let stderr = '';

    // 实时处理stdout
    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;

      // 按行分割并发送
      const lines = text.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        logger.debug(`[STDOUT] ${line}`, { taskId });
        if (taskId) {
          taskManager.addLog(taskId, {
            level: 'stdout',
            message: line
          });
        }
      });
    });

    // 实时处理stderr
    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;

      const lines = text.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        logger.debug(`[STDERR] ${line}`, { taskId });
        if (taskId) {
          taskManager.addLog(taskId, {
            level: 'stderr',
            message: line
          });
        }
      });
    });

    // 进程错误
    child.on('error', (error) => {
      logger.error(`Command execution error: ${error.message}`, { taskId });
      if (taskId) {
        taskManager.addLog(taskId, {
          level: 'error',
          message: `Execution error: ${error.message}`
        });
      }
      reject(error);
    });

    // 进程退出
    child.on('close', (code) => {
      const success = code === 0;
      logger.info(`Command exited with code ${code}`, { taskId, success });

      if (taskId) {
        taskManager.addLog(taskId, {
          level: success ? 'success' : 'error',
          message: `Process exited with code ${code}`
        });
      }

      resolve({
        success,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code
      });
    });
  });
}

/**
 * 执行多个命令序列
 */
export async function executeCommandSequence(commands, taskId = null) {
  const results = [];
  let currentStep = 0;

  for (const cmd of commands) {
    currentStep++;
    const progress = Math.round((currentStep / commands.length) * 100);

    if (taskId) {
      taskManager.updateProgress(taskId, progress);
      taskManager.addLog(taskId, {
        level: 'info',
        message: `Step ${currentStep}/${commands.length}: ${cmd.name}`
      });
    }

    try {
      const result = await executeCommandStream(
        cmd.command,
        cmd.args || [],
        taskId,
        cmd.options || {}
      );

      results.push({
        name: cmd.name,
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode
      });

      if (!result.success && cmd.stopOnError !== false) {
        // 如果失败且要求停止，则中断序列
        break;
      }
    } catch (error) {
      results.push({
        name: cmd.name,
        success: false,
        error: error.message
      });

      if (cmd.stopOnError !== false) {
        break;
      }
    }
  }

  return {
    success: results.every(r => r.success),
    results
  };
}
