const cds = require('@sap/cds');

cds.on('bootstrap', (app) => {
    // Add basic logging
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
        next();
    });
});

module.exports = cds.server;

