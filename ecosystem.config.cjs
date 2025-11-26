/**
 * PM2 配置文件
 *
 * 使用方法：
 * 1. 标准API服务器（同步响应）：
 *    pm2 start ecosystem.config.cjs --only resource-sync-api
 *
 * 2. SSE API服务器（异步任务+实时流式输出，推荐）：
 *    pm2 start ecosystem.config.cjs --only resource-sync-api-sse
 *
 * 3. 启动所有（不推荐，会占用两个端口）：
 *    pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    // 标准API服务器（同步响应，适合快速任务）
    {
      name: 'resource-sync-api',
      script: 'src/api-server.js',
      instances: 1,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        API_PORT: 3000
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      kill_timeout: 5000,
      listen_timeout: 10000
    },

    // SSE API服务器（异步任务+实时流式输出，推荐用于长时间任务）
    {
      name: 'resource-sync-api-sse',
      script: 'src/api-server-sse.js',
      instances: 1,
      exec_mode: 'fork', // SSE需要使用fork模式，不能用cluster
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        API_PORT: 3000
      },
      error_file: 'logs/pm2-error-sse.log',
      out_file: 'logs/pm2-out-sse.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      kill_timeout: 5000,
      listen_timeout: 10000
    }
  ]
};
