import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger.js';
import { getConfig } from '../utils/config.js';
import { validateVersion, decrementVersion } from '../utils/version.js';
import { executeCommandStream } from '../utils/task-executor.js';
import taskManager from '../utils/task-manager.js';

const execAsync = promisify(exec);

/**
 * 执行shell命令并返回结果
 * @param {string} command - 要执行的命令
 * @param {string} taskName - 任务名称（用于日志）
 * @param {string} taskId - 任务ID（可选，用于流式输出）
 * @returns {Promise<{success: boolean, stdout: string, stderr: string}>}
 */
async function executeCommand(command, taskName, taskId = null) {
  logger.info(`[${taskName}] Executing: ${command}`, { taskId });

  // 如果提供了taskId，使用流式执行
  if (taskId) {
    try {
      const result = await executeCommandStream('/bin/bash', ['-c', command], taskId);

      if (result.stderr && !result.stderr.includes('warning')) {
        logger.warn(`[${taskName}] stderr: ${result.stderr}`, { taskId });
      }

      logger.info(`[${taskName}] ${result.success ? 'Success' : 'Failed'}`, { taskId });
      return result;
    } catch (error) {
      logger.error(`[${taskName}] Failed: ${error.message}`, {
        command,
        error: error.stack,
        taskId
      });
      return {
        success: false,
        stdout: '',
        stderr: error.message
      };
    }
  }

  // 否则使用传统的exec方式（向后兼容）
  try {
    const { stdout, stderr } = await execAsync(command, {
      shell: '/bin/bash',
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });

    if (stderr && !stderr.includes('warning')) {
      logger.warn(`[${taskName}] stderr: ${stderr}`);
    }

    logger.info(`[${taskName}] Success`);
    return { success: true, stdout, stderr };
  } catch (error) {
    logger.error(`[${taskName}] Failed: ${error.message}`, {
      command,
      error: error.stack
    });
    return {
      success: false,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message
    };
  }
}

/**
 * 任务1: 检查资源完整性
 * @param {string} version - 版本号，如 v885
 * @param {string} taskId - 任务ID（可选，用于流式输出）
 * @returns {Promise<{success: boolean, results: Array}>}
 */
export async function checkResourceIntegrity(version, taskId = null) {
  if (!validateVersion(version)) {
    throw new Error(`Invalid version format: ${version}`);
  }

  const config = getConfig();
  const { paths } = config;

  const commands = [
    {
      name: 'Check iOS resources',
      cmd: `${paths.match}/match -seed ${paths.home}/wtc/assets_config/common_ios/project.manifest -root ${paths.home}/wtc/${version}/res_oldvegas/`
    },
    {
      name: 'Check Android resources',
      cmd: `${paths.match}/match -seed ${paths.home}/wtc/assets_config/common_android/project.manifest -root ${paths.home}/wtc/${version}/res_oldvegas/`
    },
    {
      name: 'Match version',
      cmd: `cd ${paths.match} && bash match_version.sh wtc ${version}`
    }
  ];

  logger.info(`Starting resource integrity check for version: ${version}`, { taskId });

  const results = [];
  let allSuccess = true;

  for (const { name, cmd } of commands) {
    const result = await executeCommand(cmd, name, taskId);
    results.push({ name, ...result });

    if (!result.success) {
      allSuccess = false;
      // 继续执行其他检查，但记录失败
    }
  }

  return { success: allSuccess, results };
}

/**
 * 任务2: 同步Facebook资源
 * @param {string} version - 版本号
 * @param {string} taskId - 任务ID（可选，用于流式输出）
 * @returns {Promise<{success: boolean, stdout: string, stderr: string}>}
 */
export async function syncFacebookResources(version, taskId = null) {
  if (!validateVersion(version)) {
    throw new Error(`Invalid version format: ${version}`);
  }

  const config = getConfig();
  const { paths } = config;

  const command = `cd ${paths.nginx} && sh pubfbclient.sh wtc ${version}`;

  logger.info(`Syncing Facebook resources for version: ${version}`, { taskId });
  return await executeCommand(command, 'Sync Facebook Resources', taskId);
}

/**
 * 任务3: 同步Native资源
 * @param {string} version - 版本号
 * @param {string} taskId - 任务ID（可选，用于流式输出）
 * @returns {Promise<{success: boolean, stdout: string, stderr: string}>}
 */
export async function syncNativeResources(version, taskId = null) {
  if (!validateVersion(version)) {
    throw new Error(`Invalid version format: ${version}`);
  }

  const config = getConfig();
  const { paths } = config;

  const command = `cd ${paths.nginx} && sh pubclient.sh wtc ${version}`;

  logger.info(`Syncing Native resources for version: ${version}`, { taskId });
  return await executeCommand(command, 'Sync Native Resources', taskId);
}

/**
 * 任务4: 修改reuse资源版本
 * @param {string} version - 当前版本号
 * @param {string} [nginxReuseVersion] - nginx的reuse版本号，如果不提供则使用 version-2
 * @param {string} taskId - 任务ID（可选，用于流式输出）
 * @returns {Promise<{success: boolean, results: Array}>}
 */
export async function updateReuseVersion(version, nginxReuseVersion = null, taskId = null) {
  if (!validateVersion(version)) {
    throw new Error(`Invalid version format: ${version}`);
  }

  const config = getConfig();
  const { paths, defaults } = config;

  // 如果没有提供nginxReuseVersion，使用version-2作为默认值
  const calculatedNginxVersion = nginxReuseVersion || decrementVersion(version, defaults.versionOffset);

  logger.info(`Updating reuse version: ${version} -> reuse_version`, { taskId });
  logger.info(`Nginx reuse version: ${calculatedNginxVersion} -> reuse_version`, { taskId });

  const commands = [
    {
      name: 'Move wtc version to reuse',
      cmd: `cd ${paths.home}/wtc && mv ${version} reuse_version`
    },
    {
      name: 'Move wtc_fb version to reuse',
      cmd: `cd ${paths.home}/wtc_fb && mv ${version} reuse_version`
    },
    {
      name: 'Move nginx wtc to reuse',
      cmd: `cd ${paths.nginx}/wtc && mv ${calculatedNginxVersion} reuse_version`
    },
    {
      name: 'Move nginx wtc_fb to reuse',
      cmd: `cd ${paths.nginx}/wtc_fb && mv ${calculatedNginxVersion} reuse_version`
    }
  ];

  const results = [];
  let allSuccess = true;

  for (const { name, cmd } of commands) {
    const result = await executeCommand(cmd, name, taskId);
    results.push({ name, ...result });

    if (!result.success) {
      allSuccess = false;
      logger.error(`Failed to update reuse version: ${name}`, { taskId });
      // 发生错误时停止后续操作，避免数据不一致
      break;
    }
  }

  return {
    success: allSuccess,
    results,
    nginxReuseVersion: calculatedNginxVersion
  };
}

/**
 * 获取所有可用的任务
 */
export const AVAILABLE_TASKS = {
  CHECK_INTEGRITY: 'check-integrity',
  SYNC_FACEBOOK: 'sync-facebook',
  SYNC_NATIVE: 'sync-native',
  UPDATE_REUSE: 'update-reuse'
};
