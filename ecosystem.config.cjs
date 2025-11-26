module.exports = {
  apps: [
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
      listen_timeout: 10000,
      // 环境变量从 .env 文件加载
      // 你也可以在这里直接设置
      // env: {
      //   NODE_ENV: 'production',
      //   API_PORT: 3000,
      //   API_KEY: 'your-api-key',
      //   ALLOWED_IPS: '192.168.1.100,10.0.0.50'
      // }
    }
  ]
};
