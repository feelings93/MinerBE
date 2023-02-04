const express = require('express');
const Client = require('bitcoin-core');
const serviceAccount = require('.././env.json');
const { reverseX, byteToString, dblsha } = require('../utils/formatData');
const { MerkleTree } = require('merkletreejs');
const SHA256 = require('crypto-js/sha256');

const router = express.Router();

const client = new Client({
  host: 'localhost',
  network: 'regtest',
  username: serviceAccount.login,
  password: serviceAccount.passw,
  wallet: 'mywallet',
  port: 18443,
});

router.get('/blockTemplate', async (req, res) => {
  const getBlockTemplate = await client.getBlockTemplate({ rules: ['segwit'] });
  res.send(getBlockTemplate);
});

router.get('/walletInfo', async (req, res) => {
  const getWalletInfo = await client.getWalletInfo();
  res.send(getWalletInfo);
});

router.post('/sendToAddress', async (req, res) => {
  const { address, amount } = req.body;
  try {
    const result = await client.sendToAddress(address, amount);
    res.send(result);
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

router.post('/generateToAddress', async (req, res) => {
  const { address, qty = 1 } = req.body;
  try {
    const result = await client.generateToAddress(qty, address);
    res.send(result);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err });
  }
});

router.post('/mine', async (req, res) => {
  const { address, txIDs, autoPick } = req.body;
  let getBlockTemplate;
  let versionLE;
  let previousblockhashLE = '';
  let target = '';
  let rootLE;
  let timeLE;
  let bitsLE;
  let txID = [];
  let wtxID = [];
  let txData = '';
  let heatherString = '';
  let shaHeatherLE = '';

  await read_data(address, txIDs, autoPick);
  const result = await getWork();
  if (result === null) res.status(200).json({ success: true });
  else res.status(500).json({ message: result });

  async function read_data(address, txIDs = [], autoPick = false) {
    let fee = 0;
    let deductFee = 0;
    let sigops = 0;
    let weight = 0;
    let tx0 = '';
    getBlockTemplate = await client.getBlockTemplate({ rules: ['segwit'] });
    let sigoplimit = getBlockTemplate.sigoplimit;
    let weightlimit = getBlockTemplate.weightlimit;
    let coinbasevalue = getBlockTemplate.coinbasevalue / 100000000;
    versionLE = reverseX(getBlockTemplate.version);
    previousblockhashLE = reverseX(getBlockTemplate.previousblockhash);
    target = getBlockTemplate.target;
    console.log({ coinbasevalue });
    console.log(byteToString(reverseX(Number(4999990000).toString(16))));
    let wtxHash = '';
    await getBlockTemplate.transactions.forEach((transaction) => {
      deductFee += transaction.fee;
    });
    if (autoPick)
      await getBlockTemplate.transactions.forEach((transaction) => {
        if (
          sigops + transaction.sigops < sigoplimit &&
          weight + transaction.weight < weightlimit
        ) {
          sigops += transaction.sigops;
          weight += transaction.weight;
          fee += transaction.fee;
          txID.push(transaction.txid);
          wtxID.push(transaction.hash);
          txData = txData + transaction.data;
        }
      });
    else
      await getBlockTemplate.transactions.forEach((transaction) => {
        if (
          sigops + transaction.sigops < sigoplimit &&
          weight + transaction.weight < weightlimit &&
          txIDs.includes(transaction.txid)
        ) {
          sigops += transaction.sigops;
          weight += transaction.weight;
          fee += transaction.fee;
          txID.push(transaction.txid);
          wtxID.push(transaction.hash);
          txData = txData + transaction.data;
        }
      });
    //1
    await client
      .createRawTransaction([], {
        [address]: coinbasevalue - deductFee / 100000000 + fee / 100000000,
      })
      .then((help) => {
        const hashStore = '0000000000000000';
        let coinbaseValueHex = byteToString(
          reverseX(Number(getBlockTemplate.coinbasevalue - fee).toString(16))
        );
        coinbaseValueHex =
          coinbaseValueHex +
          hashStore.substring(0, 16 - coinbaseValueHex.length);
        console.log(
          'length',
          coinbaseValueHex.length,
          coinbaseValueHex,
          getBlockTemplate.coinbasevalue - fee
        );
        const height = byteToString(reverseX(getBlockTemplate.height));
        const bytesInHeight = byteToString(reverseX(height.length / 2));
        const encodedData = '0101';
        const bytesInCoinbase = byteToString(
          reverseX(
            (encodedData.length + height.length + bytesInHeight.length) / 2
          )
        );
        const leaves = [
          '0000000000000000000000000000000000000000000000000000000000000000',
          ...wtxID,
        ].map((x) => Buffer.from(x, 'hex'));
        const tree = new MerkleTree(leaves, SHA256, { isBitcoinTree: true });
        wtxHash = dblsha(
          byteToString(reverseX(tree.getRoot().toString('hex'))) +
            '0000000000000000000000000000000000000000000000000000000000000000'
        );
        tx0 =
          '02000000' + //version
          '0001' +
          '01' + //number inputs
          '0000000000000000000000000000000000000000000000000000000000000000' + //Previous outpoint TXID
          'ffffffff' + //Previous outpoint index
          bytesInCoinbase +
          bytesInHeight +
          height + //
          encodedData +
          'ffffffff' + //sequence
          '02' +
          // coinbaseValueHex +
          help.slice(12) +
          '00000000' +
          '26' + //bytes
          '6a24aa21a9ed' +
          wtxHash +
          '01' +
          '20' +
          '0000000000000000000000000000000000000000000000000000000000000000' +
          '00000000';
        console.log({ tx0 });
      });

    await client.decodeRawTransaction(tx0).then((help) => {
      txID = [help.txid, ...txID];
      txData = tx0 + txData;
      weight += help.weight;
    });
    //2

    //3 merkel root from all transactions
    const leaves = txID.map((x) => Buffer.from(x, 'hex'));
    const tree = new MerkleTree(leaves, SHA256, { isBitcoinTree: true });
    console.log('tree', tree.getRoot(), tree.getRoot().toString('hex'));
    rootLE = reverseX(tree.getRoot().toString('hex'));

    //4 time
    timeLE = reverseX(getBlockTemplate.curtime);

    //5 bits
    bitsLE = reverseX(getBlockTemplate.bits);
  }

  async function getWork() {
    let count = 0;

    //6 nonce
    //nonceLE = reverseX('00000000');
    let nonceInt = 22;

    do {
      if (count === 5000000) {
        await read_data();
        count = 0;
      }
      count++;

      let nonceStr = nonceInt.toString(16);
      while (nonceStr.length < 8) nonceStr = '0' + nonceStr;
      //shaHeather
      let heatherByteLE = versionLE
        .concat(previousblockhashLE)
        .concat(rootLE)
        .concat(timeLE)
        .concat(bitsLE)
        .concat(nonceStr);
      console.log({ versionLE, previousblockhashLE });

      heatherString = byteToString(heatherByteLE);

      //sha target
      let shaHeather = reverseX(dblsha(heatherString));

      shaHeatherLE = byteToString(shaHeather);
      if (nonceInt < 0xffffffff) nonceInt++;
      else nonceInt = 0;
      if (shaHeatherLE.slice(0, 8) === '00000000') {
        console.log(nonceInt);
        console.log(
          'mask:             1------12--------------------------------------------------------------23--------------------------------------------------------------34------45------56------6'
        );
        console.log('heatherLE:        ' + heatherString);
        console.log('shaHeatherLE:     ' + shaHeatherLE);
        console.log('target:           ' + target + '\n');
        // await submitBlock();
      }
    } while (parseInt(shaHeatherLE, 16) > parseInt(target, 16));
    console.log('sha', parseInt(shaHeatherLE, 16), 'nonceInt', nonceInt);
    console.log('target', parseInt(target, 16));
    const result = await submitBlock();
    return result;
  }
  async function submitBlock() {
    let txCount;
    console.log({ txID });
    if (txID.length < 0xfd) txCount = byteToString(reverseX(txID.length));
    else if (txID.length <= 0xffff)
      txCount = 'FD' + byteToString(reverseX(txID.length));
    else if (txID.length <= 0xffffff)
      txCount = 'FE' + byteToString(reverseX(txID.length)) + '00';
    else if (txID.length <= 0xffffffff)
      txCount = 'FE' + byteToString(reverseX(txID.length));
    else if (txID.length <= 0xffffffffff)
      txCount = 'FF' + byteToString(reverseX(txID.length)) + '000000';
    else if (txID.length <= 0xffffffffffff)
      txCount = 'FF' + byteToString(reverseX(txID.length)) + '0000';
    else if (txID.length <= 0xffffffffffffff)
      txCount = 'FF' + byteToString(reverseX(txID.length)) + '00';
    else if (txID.length <= 0xffffffffffffffff)
      txCount = 'FF' + byteToString(reverseX(txID.length));
    else console.log('txcount error!');

    console.log('Result success!');
    console.log({ heatherString, txCount, txData, txID });
    let block = heatherString + txCount + txData;
    console.log('block             ' + block.length);
    try {
      const x = await client.submitBlock(block);
      console.log(x);
      return x;
    } catch (err) {
      console.log(err);
      return err;
    }
  }
});

router.get('/decodedTransactions', async (req, res) => {
  const getBlockTemplate = await client.getBlockTemplate({ rules: ['segwit'] });
  const { transactions } = getBlockTemplate;
  const decodedTransactions = await Promise.all(
    transactions?.map(async (transaction) => {
      return await client.decodeRawTransaction(transaction.data);
    })
  );
  console.log(decodedTransactions);
  res.send(decodedTransactions);
});

router.post('/decodeTransaction', async (req, res) => {
  const { transaction } = req.body;

  const decodedTransaction = await client.decodeRawTransaction(
    transaction.data
  );
  console.log(decodedTransaction);

  res.send(decodedTransaction);
});

module.exports = router;
function toHex(str, hex) {
  try {
    hex = unescape(encodeURIComponent(str))
      .split('')
      .map(function (v) {
        return v.charCodeAt(0).toString(16);
      })
      .join('');
  } catch (e) {
    hex = str;
    console.log('invalid text input: ' + str);
  }
  return hex;
}
