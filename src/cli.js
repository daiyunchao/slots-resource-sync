#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import {
  checkResourceIntegrity,
  syncFacebookResources,
  syncNativeResources,
  updateReuseVersion
} from './tasks/index.js';
import logger from './utils/logger.js';
import { loadConfig } from './utils/config.js';
import {
  confirmVersion,
  waitForContinue,
  showTaskStart,
  showTaskSuccess,
  showTaskFailure,
  showCheckResults,
  showProgress,
  showSummary,
  showScriptOutput
} from './utils/interactive.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取package.json获取版本号
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf8')
);

const program = new Command();

// 初始化配置
try {
  loadConfig();
} catch (error) {
  console.error(chalk.red(`配置加载失败: ${error.message}`));
  process.exit(1);
}

program
  .name('resource-sync')
  .description('资源同步和管理工具')
  .version(packageJson.version);

// 任务1: 检查资源完整性
program
  .command('check')
  .description('检查资源完整性')
  .requiredOption('-v, --version <version>', '版本号 (例如: v885)')
  .option('--no-confirm', '跳过确认提示')
  .action(async (options) => {
    const taskName = '资源完整性检查';

    try {
      // 确认版本
      if (options.confirm) {
        const confirmed = await confirmVersion(options.version, taskName);
        if (!confirmed) {
          console.log(chalk.yellow('\n操作已取消\n'));
          process.exit(0);
        }
      }

      // 显示开始信息
      showTaskStart(taskName, options.version);

      // 执行检查
      const result = await checkResourceIntegrity(options.version);

      // 显示检查详情
      showCheckResults(result.results);

      // 显示每个检查项的完整输出
      result.results.forEach((item) => {
        if (item.stdout || item.stderr) {
          showScriptOutput(item.stdout, item.stderr, item.name);
        }
      });

      // 显示结果
      if (result.success) {
        showTaskSuccess(
          taskName,
          options.version,
          `版本 ${options.version} 资源无异常，所有检查项通过`,
          {
            'iOS资源': '✅ 完整',
            'Android资源': '✅ 完整',
            '版本匹配': '✅ 通过'
          }
        );
        process.exit(0);
      } else {
        showTaskFailure(
          taskName,
          options.version,
          '部分资源检查未通过，请查看上方详情'
        );
        process.exit(1);
      }
    } catch (error) {
      showTaskFailure(taskName, options.version, error.message);
      logger.error('Check command failed', { error: error.stack });
      process.exit(1);
    }
  });

// 任务2: 同步Facebook资源
program
  .command('sync-fb')
  .description('同步Facebook资源')
  .requiredOption('-v, --version <version>', '版本号 (例如: v885)')
  .option('--no-confirm', '跳过确认提示')
  .action(async (options) => {
    const taskName = 'Facebook资源同步';

    try {
      // 确认版本
      if (options.confirm) {
        const confirmed = await confirmVersion(options.version, taskName);
        if (!confirmed) {
          console.log(chalk.yellow('\n操作已取消\n'));
          process.exit(0);
        }
      }

      // 显示开始信息
      showTaskStart(taskName, options.version);

      // 执行同步
      const result = await syncFacebookResources(options.version);

      // 显示完整脚本输出
      showScriptOutput(result.stdout, result.stderr, taskName);

      if (result.success) {
        showTaskSuccess(
          taskName,
          options.version,
          `版本 ${options.version} 的Facebook资源已成功同步到生产环境`,
          {
            '同步状态': '✅ 完成',
            '同步时间': new Date().toLocaleString('zh-CN')
          }
        );
        process.exit(0);
      } else {
        showTaskFailure(taskName, options.version, result.stderr || '同步失败');
        process.exit(1);
      }
    } catch (error) {
      showTaskFailure(taskName, options.version, error.message);
      logger.error('Sync FB command failed', { error: error.stack });
      process.exit(1);
    }
  });

// 任务3: 同步Native资源
program
  .command('sync-native')
  .description('同步Native资源')
  .requiredOption('-v, --version <version>', '版本号 (例如: v885)')
  .option('--no-confirm', '跳过确认提示')
  .action(async (options) => {
    const taskName = 'Native资源同步';

    try {
      // 确认版本
      if (options.confirm) {
        const confirmed = await confirmVersion(options.version, taskName);
        if (!confirmed) {
          console.log(chalk.yellow('\n操作已取消\n'));
          process.exit(0);
        }
      }

      // 显示开始信息
      showTaskStart(taskName, options.version);

      // 执行同步
      const result = await syncNativeResources(options.version);

      // 显示完整脚本输出
      showScriptOutput(result.stdout, result.stderr, taskName);

      if (result.success) {
        showTaskSuccess(
          taskName,
          options.version,
          `版本 ${options.version} 的Native资源已成功同步到生产环境`,
          {
            '同步状态': '✅ 完成',
            '同步时间': new Date().toLocaleString('zh-CN')
          }
        );
        process.exit(0);
      } else {
        showTaskFailure(taskName, options.version, result.stderr || '同步失败');
        process.exit(1);
      }
    } catch (error) {
      showTaskFailure(taskName, options.version, error.message);
      logger.error('Sync Native command failed', { error: error.stack });
      process.exit(1);
    }
  });

// 任务4: 修改reuse资源版本
program
  .command('update-reuse')
  .description('修改reuse资源版本')
  .requiredOption('-v, --version <version>', '当前版本号 (例如: v885)')
  .option('-n, --nginx-version <nginxVersion>', 'Nginx reuse版本号 (可选，默认为version-2)')
  .option('--no-confirm', '跳过确认提示')
  .action(async (options) => {
    const taskName = 'Reuse版本更新';

    try {
      // 先导入必要的工具
      const { getConfig } = await import('./utils/config.js');
      const { decrementVersion } = await import('./utils/version.js');
      const config = getConfig();

      // 计算将要使用的nginx版本
      const calculatedNginxVersion = options.nginxVersion ||
        decrementVersion(options.version, config.defaults.versionOffset);

      // 显示版本计算信息
      console.log(chalk.cyan(`\n${'='.repeat(60)}`));
      console.log(chalk.cyan.bold(`  准备执行: ${taskName}`));
      console.log(chalk.cyan(`${'='.repeat(60)}\n`));

      console.log(chalk.yellow('⚠️  重要：即将执行以下版本移动操作：\n'));
      console.log(chalk.white(`  1. WTC 版本目录:`));
      console.log(chalk.gray(`     ${config.paths.home}/wtc/${chalk.bold(options.version)} → reuse_version\n`));

      console.log(chalk.white(`  2. WTC_FB 版本目录:`));
      console.log(chalk.gray(`     ${config.paths.home}/wtc_fb/${chalk.bold(options.version)} → reuse_version\n`));

      console.log(chalk.white(`  3. Nginx WTC 目录:`));
      console.log(chalk.gray(`     ${config.paths.nginx}/wtc/${chalk.bold(calculatedNginxVersion)} → reuse_version`));
      if (!options.nginxVersion) {
        console.log(chalk.gray(`     (自动计算: ${options.version} - ${config.defaults.versionOffset} = ${calculatedNginxVersion})\n`));
      } else {
        console.log(chalk.gray(`     (手动指定版本)\n`));
      }

      console.log(chalk.white(`  4. Nginx WTC_FB 目录:`));
      console.log(chalk.gray(`     ${config.paths.nginx}/wtc_fb/${chalk.bold(calculatedNginxVersion)} → reuse_version\n`));

      // 确认版本和操作
      if (options.confirm) {
        const { default: inquirer } = await import('inquirer');
        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: chalk.red('确认以上版本计算无误，继续执行吗？这是高风险操作！'),
            default: false,
          },
        ]);

        if (!answer.confirmed) {
          console.log(chalk.yellow('\n❌ 操作已取消\n'));
          process.exit(0);
        }
      }

      // 显示开始信息
      showTaskStart(taskName, options.version);

      // 执行更新
      const result = await updateReuseVersion(options.version, options.nginxVersion);

      // 显示检查详情
      showCheckResults(result.results);

      // 显示每个操作的完整输出
      result.results.forEach((item) => {
        if (item.stdout || item.stderr) {
          showScriptOutput(item.stdout, item.stderr, item.name);
        }
      });

      if (result.success) {
        showTaskSuccess(
          taskName,
          options.version,
          `版本 ${options.version} 已成功移动到reuse_version`,
          {
            'WTC版本': `${options.version} → reuse_version`,
            'WTC_FB版本': `${options.version} → reuse_version`,
            'Nginx版本': `${result.nginxReuseVersion} → reuse_version`
          }
        );
        process.exit(0);
      } else {
        showTaskFailure(
          taskName,
          options.version,
          'Reuse版本更新失败，部分操作未完成'
        );
        process.exit(1);
      }
    } catch (error) {
      showTaskFailure(taskName, options.version, error.message);
      logger.error('Update reuse command failed', { error: error.stack });
      process.exit(1);
    }
  });

// 组合命令: 执行完整的发布流程（交互式）
program
  .command('full-sync')
  .description('执行完整的发布流程（交互式，每步确认）')
  .requiredOption('-v, --version <version>', '版本号 (例如: v885)')
  .option('--skip-check', '跳过资源完整性检查')
  .option('--no-confirm', '跳过所有确认提示（危险！）')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🚀 完整发布流程\n'));
    console.log(chalk.white(`版本: ${chalk.bold(options.version)}`));
    console.log(chalk.gray(`时间: ${new Date().toLocaleString('zh-CN')}\n`));

    // 初始确认
    if (options.confirm) {
      const confirmed = await confirmVersion(options.version, '完整发布流程');
      if (!confirmed) {
        console.log(chalk.yellow('\n操作已取消\n'));
        process.exit(0);
      }
    }

    const steps = [];
    let currentStep = 0;

    if (!options.skipCheck) {
      steps.push({
        name: '检查资源完整性',
        func: checkResourceIntegrity,
        nextStep: '同步Facebook资源'
      });
    }

    steps.push({
      name: '同步Facebook资源',
      func: syncFacebookResources,
      nextStep: '同步Native资源'
    });

    steps.push({
      name: '同步Native资源',
      func: syncNativeResources,
      nextStep: '流程完成'
    });

    const totalSteps = steps.length;
    const results = [];

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        currentStep = i + 1;

        // 显示进度
        showProgress(currentStep, totalSteps, step.name);

        // 显示开始信息
        showTaskStart(step.name, options.version);

        // 执行任务
        const result = await step.func(options.version);
        results.push({ name: step.name, result });

        // 显示详细结果
        const isCheckTask = step.name === '检查资源完整性';
        const isUpdateTask = step.name === '更新Reuse版本';

        if (isCheckTask || isUpdateTask) {
          // 检查任务或更新任务：显示详情列表
          showCheckResults(result.results);
          // 显示每个子任务的完整输出
          result.results.forEach((item) => {
            if (item.stdout || item.stderr) {
              showScriptOutput(item.stdout, item.stderr, item.name);
            }
          });
        } else {
          // 同步任务：直接显示脚本输出
          showScriptOutput(result.stdout, result.stderr, step.name);
        }

        // 判断任务是否成功
        const taskSuccess = result.success || (result.results && result.results.every(r => r.success));

        if (taskSuccess) {
          const successMessage = isCheckTask
            ? `版本 ${options.version} 资源无异常，所有检查项通过`
            : `版本 ${options.version} ${step.name}成功`;

          showTaskSuccess(step.name, options.version, successMessage);

          // 如果不是最后一步，等待继续
          if (i < steps.length - 1) {
            if (options.confirm) {
              const shouldContinue = await waitForContinue(step.nextStep, result);
              if (!shouldContinue) {
                console.log(chalk.yellow(`\n流程在 "${step.name}" 后停止\n`));
                process.exit(0);
              }
            } else {
              console.log(chalk.cyan(`\n📋 下一步: ${step.nextStep}\n`));
            }
          }
        } else {
          showTaskFailure(step.name, options.version, '任务执行失败');
          console.log(chalk.red(`\n❌ 流程在 "${step.name}" 步骤失败，已终止\n`));
          process.exit(1);
        }
      }

      // 显示总结
      showSummary(totalSteps, totalSteps, options.version);

      console.log(chalk.green.bold('🎉 完整发布流程执行成功!\n'));
      process.exit(0);

    } catch (error) {
      showTaskFailure('完整发布流程', options.version, error.message);
      logger.error('Full sync command failed', { error: error.stack });
      process.exit(1);
    }
  });

program.parse();
