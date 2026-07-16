module.exports = {
    apps: [{
        name: 'absensi',
        script: 'server.js',
        instances: 1,
        exec_mode: 'fork',
        watch: false,
        max_memory_restart: '200M',
        env: {
            NODE_ENV: 'production'
        }
    }]
};
