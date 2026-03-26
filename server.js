import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use('/api/webhook', createProxyMiddleware({
  target: 'https://n8n-production-04fe9.up.railway.app',
  changeOrigin: true,
  pathRewrite: {
    '^/api/webhook': '/webhook/6cc5b68c-59b2-4840-b489-e8e92b36e25a'
  }
}));

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
