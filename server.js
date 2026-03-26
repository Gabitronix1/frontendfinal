const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();

app.use('/api/webhook', createProxyMiddleware({
  target: 'https://n8n-production-04fe9.up.railway.app/webhook/6cc5b68c-59b2-4840-b489-e8e92b36e25a',
  changeOrigin: true,
  ignorePath: true,
  on: {
    proxyReq: (proxyReq, req, res) => {
      console.log('Proxying to n8n...');
    },
    error: (err, req, res) => {
      console.error('Proxy error:', err);
      res.status(500).send('Proxy error');
    }
  }
}));

app.use(express.static(path.join(__dirname, 'dist')));

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
