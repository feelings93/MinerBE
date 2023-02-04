const crypto = require('crypto');

const dblsha = (data) => {
  let sha2 = crypto
    .createHash('sha256')
    .update(Buffer.from(data, 'hex'))
    .digest('hex');
  return crypto
    .createHash('sha256')
    .update(Buffer.from(sha2, 'hex'))
    .digest('hex');
};

const reverseX = (data) => {
  data = data.toString(16);
  console.log({ data });
  console.log(data.match(/.{1,2}/g));

  if (data.length % 2) data = '0' + data;
  return (data.match(/.{1,2}/g) || []).reverse();
};

const byteToString = (data) => {
  let tempStr = '';
  data.forEach((x) => (tempStr += x));
  return tempStr;
};

module.exports = { dblsha, reverseX, byteToString };
