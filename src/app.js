const express = require('express');
const cors = require('cors');
const indexRoutes = require('./routes/index.routes');
const webhookRoutes = require('./routes/webhook.routes');
const otpRoutes = require('./routes/otp.routes');
const livraisonRoutes = require('./routes/livraison.routes');
const financeRoutes = require('./routes/finance.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/', indexRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/otp', otpRoutes);
app.use('/livraison', livraisonRoutes);
app.use('/finance', financeRoutes);

module.exports = app;
