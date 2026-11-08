module.exports = {
  apps: [{
    name: 'takatick',
    script: 'start.sh',
    cwd: '/opt/takatick',
    watch: false,
    max_memory_restart: '512M',
    env: { NODE_ENV: 'production' },
  }],
};
