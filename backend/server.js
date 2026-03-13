const express = require('express');
const helmet = require('helmet');
const app = express();

// Configure helmet to disable content Security Policy
app.use(helmet({ contentSecurityPolicy: false }));

// Your other middleware and routes remain unchanged

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});