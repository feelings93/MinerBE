const express = require('express');
const cors = require('cors');
const app = express();
const port = 4500;
const bitcoinRouter = require('./route/bitcoin');

app.use(cors());
app.use(express.json());

app.use('/bitcoin', bitcoinRouter);
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
