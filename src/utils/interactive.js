import inquirer from 'inquirer';
import chalk from 'chalk';

/**
 * 确认版本号
 * @param {string} version - 版本号
 * @param {string} taskName - 任务名称
 * @returns {Promise<boolean>} - 用户是否确认
 */
export async function confirmVersion(version, taskName) {
  console.log(chalk.cyan(`\n${'='.repeat(60)}`));
  console.log(chalk.cyan.bold(`  准备执行: ${taskName}`));
  console.log(chalk.cyan(`${'='.repeat(60)}\n`));

  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: chalk.yellow(`确认版本号是 ${chalk.bold(version)} 吗?`),
      default: true,
    },
  ]);

  return answer.confirmed;
}

/**
 * 等待用户确认继续
 * @param {string} nextStep - 下一步将要执行的操作
 * @param {object} currentStepResult - 当前步骤的执行结果（包含stdout/stderr）
 * @returns {Promise<boolean>} - 用户是否选择继续
 */
export async function waitForContinue(nextStep, currentStepResult = null) {
  console.log(chalk.gray(`\n${'─'.repeat(60)}`));
  console.log(chalk.cyan(`📋 下一步: ${nextStep}`));
  console.log(chalk.gray(`${'─'.repeat(60)}\n`));

  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'continue',
      message: chalk.yellow('根据上方输出，确认继续执行吗？'),
      default: true,
    },
  ]);

  if (!answer.continue) {
    console.log(chalk.red('\n❌ 用户选择终止流程\n'));
    return false;
  }

  return true;
}

/**
 * 显示脚本执行的完整输出
 * @param {string} stdout - 标准输出
 * @param {string} stderr - 标准错误输出
 * @param {string} taskName - 任务名称
 */
export function showScriptOutput(stdout, stderr, taskName) {
  if (stdout && stdout.trim()) {
    console.log(chalk.cyan(`\n📄 ${taskName} - 脚本输出:`));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.white(stdout));
    console.log(chalk.gray('─'.repeat(60)));
  }

  if (stderr && stderr.trim()) {
    // 有些stderr可能只是警告，不一定是错误
    console.log(chalk.yellow(`\n⚠️  ${taskName} - 标准错误输出:`));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.yellow(stderr));
    console.log(chalk.gray('─'.repeat(60)));
  }

  if (!stdout && !stderr) {
    console.log(chalk.gray(`\n(${taskName} 没有输出内容)`));
  }
}

/**
 * 显示任务开始信息
 * @param {string} taskName - 任务名称
 * @param {string} version - 版本号
 */
export function showTaskStart(taskName, version) {
  console.log(chalk.blue(`\n🚀 开始执行: ${taskName}`));
  console.log(chalk.gray(`   版本: ${version}`));
  console.log(chalk.gray(`   时间: ${new Date().toLocaleString('zh-CN')}\n`));
}

/**
 * 显示任务成功信息
 * @param {string} taskName - 任务名称
 * @param {string} version - 版本号
 * @param {string} message - 详细消息
 * @param {object} details - 额外详情
 */
export function showTaskSuccess(taskName, version, message, details = {}) {
  console.log(chalk.green('\n' + '='.repeat(60)));
  console.log(chalk.green.bold(`✅ ${taskName} - 执行成功`));
  console.log(chalk.green('='.repeat(60)));
  console.log(chalk.white(`📦 版本: ${chalk.bold(version)}`));
  console.log(chalk.white(`💬 ${message}`));

  if (Object.keys(details).length > 0) {
    console.log(chalk.gray('\n详细信息:'));
    Object.entries(details).forEach(([key, value]) => {
      console.log(chalk.gray(`  • ${key}: ${value}`));
    });
  }

  console.log(chalk.green('='.repeat(60) + '\n'));
}

/**
 * 显示任务失败信息
 * @param {string} taskName - 任务名称
 * @param {string} version - 版本号
 * @param {string} error - 错误信息
 */
export function showTaskFailure(taskName, version, error) {
  console.log(chalk.red('\n' + '='.repeat(60)));
  console.log(chalk.red.bold(`❌ ${taskName} - 执行失败`));
  console.log(chalk.red('='.repeat(60)));
  console.log(chalk.white(`📦 版本: ${chalk.bold(version)}`));
  console.log(chalk.red(`💥 错误: ${error}`));
  console.log(chalk.gray(`\n提示: 请查看日志文件了解详细信息`));
  console.log(chalk.red('='.repeat(60) + '\n'));
}

/**
 * 显示检查结果详情
 * @param {Array} results - 检查结果数组
 */
export function showCheckResults(results) {
  console.log(chalk.cyan('\n检查详情:\n'));

  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    const color = result.success ? chalk.green : chalk.red;
    const status = result.success ? '通过' : '失败';

    console.log(`${icon} ${color(`${index + 1}. ${result.name}`)} - ${color(status)}`);

    if (!result.success && result.stderr) {
      console.log(chalk.red(`   错误: ${result.stderr.substring(0, 100)}...`));
    }
  });

  console.log('');
}

/**
 * 显示进度条
 * @param {number} current - 当前步骤
 * @param {number} total - 总步骤数
 * @param {string} stepName - 步骤名称
 */
export function showProgress(current, total, stepName) {
  const percentage = Math.round((current / total) * 100);
  const barLength = 30;
  const filledLength = Math.round((barLength * current) / total);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

  console.log(chalk.cyan(`\n进度: [${bar}] ${percentage}% (${current}/${total})`));
  console.log(chalk.white(`当前步骤: ${stepName}\n`));
}

/**
 * 显示总结信息
 * @param {number} successCount - 成功数量
 * @param {number} totalCount - 总数量
 * @param {string} version - 版本号
 */
export function showSummary(successCount, totalCount, version) {
  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan.bold('  执行摘要'));
  console.log(chalk.cyan('='.repeat(60)));
  console.log(chalk.white(`  版本: ${chalk.bold(version)}`));
  console.log(chalk.white(`  总任务数: ${totalCount}`));
  console.log(chalk.green(`  成功: ${successCount}`));

  if (successCount < totalCount) {
    console.log(chalk.red(`  失败: ${totalCount - successCount}`));
  }

  const allSuccess = successCount === totalCount;
  if (allSuccess) {
    console.log(chalk.green.bold(`\n  🎉 所有任务执行成功！`));
  } else {
    console.log(chalk.red.bold(`\n  ⚠️  部分任务执行失败，请检查日志`));
  }

  console.log(chalk.cyan('='.repeat(60) + '\n'));
}
