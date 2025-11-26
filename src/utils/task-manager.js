import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import logger from './logger.js';

/**
 * 任务管理器
 * 管理长时间运行的任务，支持任务状态查询和事件订阅
 */
class TaskManager extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map(); // 存储所有任务
    this.maxTasks = 100; // 最多保留100个任务记录
  }

  /**
   * 创建新任务
   */
  createTask(type, params) {
    const taskId = randomUUID();
    const task = {
      id: taskId,
      type,
      params,
      status: 'pending', // pending, running, completed, failed
      progress: 0,
      logs: [],
      result: null,
      error: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null
    };

    this.tasks.set(taskId, task);
    logger.info(`Task created: ${taskId}`, { type, params });

    // 清理旧任务（保留最近的maxTasks个）
    if (this.tasks.size > this.maxTasks) {
      const oldestKey = this.tasks.keys().next().value;
      this.tasks.delete(oldestKey);
    }

    return taskId;
  }

  /**
   * 更新任务状态
   */
  updateTask(taskId, updates) {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn(`Task not found: ${taskId}`);
      return false;
    }

    Object.assign(task, updates);
    this.emit(`task:${taskId}`, { type: 'update', task });
    return true;
  }

  /**
   * 添加任务日志
   */
  addLog(taskId, logEntry) {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const log = {
      timestamp: new Date().toISOString(),
      ...logEntry
    };

    task.logs.push(log);
    this.emit(`task:${taskId}`, { type: 'log', log });
    return true;
  }

  /**
   * 开始任务
   */
  startTask(taskId) {
    return this.updateTask(taskId, {
      status: 'running',
      startedAt: new Date().toISOString()
    });
  }

  /**
   * 完成任务
   */
  completeTask(taskId, result) {
    return this.updateTask(taskId, {
      status: 'completed',
      result,
      progress: 100,
      completedAt: new Date().toISOString()
    });
  }

  /**
   * 任务失败
   */
  failTask(taskId, error) {
    return this.updateTask(taskId, {
      status: 'failed',
      error: error.message || error,
      completedAt: new Date().toISOString()
    });
  }

  /**
   * 更新进度
   */
  updateProgress(taskId, progress) {
    return this.updateTask(taskId, { progress });
  }

  /**
   * 获取任务
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks() {
    return Array.from(this.tasks.values());
  }

  /**
   * 订阅任务事件
   */
  subscribeTask(taskId, callback) {
    this.on(`task:${taskId}`, callback);
  }

  /**
   * 取消订阅
   */
  unsubscribeTask(taskId, callback) {
    this.off(`task:${taskId}`, callback);
  }
}

// 单例模式
const taskManager = new TaskManager();
export default taskManager;
