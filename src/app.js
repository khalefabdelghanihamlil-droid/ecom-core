const express = require('express');
const indexRoutes = require('./routes/index.routes');
const webhookRoutes = require('./routes/webhook.routes');
const otpRoutes = require('./routes/otp.routes');

const app = express();

app.use(express.json());

app.use('/', indexRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/otp', otpRoutes);

module.exports = app;
