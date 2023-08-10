module.exports = {
    apps: [{
        name: 'uvt',
        script: 'index.js',
        autorestart: true,
        watch: false,
        time: true,
        error_file: 'logs/pm2-error-uvt.log',
        out_file: 'logs/pm2-out-uvt.log',
        log_file: null,
    }, {
        name: 'tr',
        script: 'tr.js',
        autorestart: true,
        watch: false,
        time: true,
        error_file: 'logs/pm2-error-tr.log',
        out_file: 'logs/pm2-out-tr.log',
        log_file: null,
    }]
};