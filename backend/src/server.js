import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use(routes);

app.use((err, req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message, ...(err.details ?? {}) });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
