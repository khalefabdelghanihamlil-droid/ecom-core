  const path = require('path');

  require('dotenv').config({ path: path.join(__dirname, '.env') });
  const app = require('./src/app');

  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur
  http://localhost:${PORT}`);
  });
