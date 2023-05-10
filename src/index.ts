import 'dotenv/config';
import express from 'express';
const app = express();

app.get('/', (req, res) => {
  res.send(
    `Hi, process.env.SOME_ENV_VARIABLE is ${process.env.SOME_ENV_VARIABLE}`,
  );
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
