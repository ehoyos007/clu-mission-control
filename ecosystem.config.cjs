module.exports = {
  apps: [
    {
      name: "clu-mission-control",
      script: "./start.sh",
      cwd: "/Users/mindmuscleu/Developer/clu-mission-control",
      interpreter: "/bin/bash",
      env: {
        NODE_ENV: "production",
        PORT: 3400,
        HOSTNAME: "0.0.0.0",
      },
      // Auto-restart on crash
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      // Logs
      error_file:
        "/Users/mindmuscleu/.openclaw/workspace/logs/clu-mission-control-error.log",
      out_file:
        "/Users/mindmuscleu/.openclaw/workspace/logs/clu-mission-control-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
