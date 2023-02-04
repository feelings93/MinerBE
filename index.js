const crypto = require('crypto');
const Client = require('bitcoin-core');
const { MerkleTree } = require('merkletreejs');
const SHA256 = require('crypto-js/sha256');
var childProcess = require('child_process');
const serviceAccount = require('./env.json');

// ./bitcoind -rpcuser=cuong -rpcpassword=cuong

const client = new Client({
  host: 'localhost',
  network: 'regtest',

  username: serviceAccount.login,
  password: serviceAccount.passw,
  //    port: 18332,
  //    port: 1234,
  wallet: 'mywallet',
  port: 18443,
});

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

read_data('Nguyen Cao Cuong').then((r) => getWork());

async function read_data(data) {
  //   const txID = [
  //     '0000000000000000000000000000000000000000000000000000000000000000',
  //     '9a2afa9db7e63e67f9158107dea427f5822e0a94b6a79ead25dd57172a68ad31',
  //     // 'c06699bcfec110b77c6deeab66b83d6e6a88518843715b50f06def96c644e89d',
  //     // '1f95064e5b37b4ac5c8ca0c00998f57533644b25dc39c20c243f813585e6c842', result
  //     // '3996b4f0fc0f28f6609c258f2ba2388365502a4e5b08b68d92f7d95188785fdc',
  //     // '258359e7f478a846d867f4626f9c35133b50ba15068e2bb92cc9ffc9f556784f',
  //     // '8aee87acd3bcb0a69b379ed72a444931d2ba5f572d7c875ef4ef034336adf68f',
  //     // '707bf7a5f10e41e3f1396a2db830daec589ddb9579a25a40315dee976d7a1dd4',
  //     // 'd582b99209bffb750ffd6f42ed1cc12bde383f39c801e00cf73b27113dac2fd5',
  //     // '3bd3a1309a518c381248fdc26c3a6bd62c35db7705069f59206684308cc237b3',
  //     // 'a99011a19e9894753d6c65c8fa412838ea8042886537588e7205734d5de8956d',
  //     // '66beaceb4be99da1e9824448231ab4fd37bacaee912381e779b37cf0e1dadad7',
  //     // 'aecb37e25954e15489e25548eb663ffdfd8a1362cac757ad62e9614453d2a577',
  //     // '5b211bc589cbdf5ad86cab1e2fe91f01c8ab934d21536b35864d30a3ff778456',
  //   ];
  //   const leavess = txID.map((x) => Buffer.from(x, 'hex'));
  //   const trees = new MerkleTree(leavess, SHA256, { isBitcoinTree: true });
  //   console.log('trees', trees, trees.getRoot(), trees.getRoot().toString('hex'));
  //   rootLE = reverseX(trees.getRoot().toString('hex'));
  //   console.log({
  //     rootLE: byteToString(rootLE),
  //     trees: trees.getRoot().toString('hex'),
  //   });
  //   console.log({
  //     sha: dblsha(
  //       byteToString(rootLE) +
  //         '0000000000000000000000000000000000000000000000000000000000000000'
  //     ),
  //   });
  //   return;
  let fee = 0;
  let sigops = 0;
  let weight = 0;

  let tx0 = '';
  getBlockTemplate = await client.getBlockTemplate({ rules: ['segwit'] });
  console.log(getBlockTemplate);
  let sigoplimit = getBlockTemplate.sigoplimit;
  let weightlimit = getBlockTemplate.weightlimit;
  let coinbasevalue = getBlockTemplate.coinbasevalue / 100000000;
  versionLE = reverseX(getBlockTemplate.version);
  previousblockhashLE = reverseX(getBlockTemplate.previousblockhash);
  target = getBlockTemplate.target;
  let wtxHash = '';
  await getBlockTemplate.transactions.forEach((transactions) => {
    console.log({ transactions });
    if (
      sigops + transactions.sigops < sigoplimit &&
      weight + transactions.weight < weightlimit
    ) {
      sigops += transactions.sigops;
      weight += transactions.weight;
      fee += transactions.fee;
      txID.push(transactions.txid);
      wtxID.push(transactions.hash);
      txData = txData + transactions.data;
    }
  });
  console.log({ wtxID });
  //1
  await client
    .createRawTransaction([], {
      bcrt1qkvedkldzysrd8r0y5ckslup8gspxqzhgqtvu6c: coinbasevalue,
    })
    .then((help) => {
      const height = byteToString(reverseX(getBlockTemplate.height));
      const bytesInHeight = byteToString(reverseX(height.length / 2));
      const encodedData = '0101';
      const bytesInCoinbase = byteToString(
        reverseX(
          (encodedData.length + height.length + bytesInHeight.length) / 2
        )
      );
      console.log({ wtxID, txID });
      const leaves = [
        '0000000000000000000000000000000000000000000000000000000000000000',
        ...wtxID,
      ].map((x) => Buffer.from(x, 'hex'));
      const tree = new MerkleTree(leaves, SHA256, { isBitcoinTree: true });
      wtxHash = dblsha(
        byteToString(reverseX(tree.getRoot().toString('hex'))) +
          '0000000000000000000000000000000000000000000000000000000000000000'
      );
      console.log({ wtxHash, encodedData, height });
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
        help.slice(12) +
        '00000000' +
        '26' + //bytes
        '6a24aa21a9ed' +
        wtxHash +
        '01' +
        '20' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '00000000';
      txData = tx0;
    });

  txID = [];
  console.log({ tx0 });
  await client.decodeRawTransaction(tx0).then((help) => {
    console.log({
      help,
      vin: help.vin,
      vout: help.vout,
      scriptPubKey: help.vout[0].scriptPubKey,
    });
    txID = [help.txid, ...txID];
    weight += help.weight;
  });
  //2

  //    console.clear();
  console.log(
    'Block: ' + getBlockTemplate.height + '    ' + new Date(Date.now())
  );
  console.log(
    'sigopslimit: ' +
      sigoplimit +
      '        sigops: ' +
      sigops +
      '      fee:         ' +
      fee / 100000000 +
      '   txLeng: ' +
      txID.length
  );
  console.log(
    'weightlimit: ' +
      weightlimit +
      '      weight: ' +
      weight +
      '    coinbase:    ' +
      coinbasevalue
  );

  //3
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
  await submitBlock();
  // read_data().then(r => getWork());
}

function dblsha(data) {
  let sha2 = crypto
    .createHash('sha256')
    .update(Buffer.from(data, 'hex'))
    .digest('hex');
  return crypto
    .createHash('sha256')
    .update(Buffer.from(sha2, 'hex'))
    .digest('hex');
}

async function submitBlock() {
  let info = '';
  let txCount;

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
    info = x;
    console.log({ x });
  } catch (err) {
    console.log(err);
  }
}

function reverseX(data) {
  data = data.toString(16);
  console.log({ data });
  console.log(data.match(/.{1,2}/g));

  if (data.length % 2) data = '0' + data;
  return (data.match(/.{1,2}/g) || []).reverse();
}

function byteToString(data) {
  let tempStr = '';
  data.forEach((x) => (tempStr += x));
  return tempStr;
}

function runScript(scriptPath, callback) {
  // keep track of whether callback has been invoked to prevent multiple invocations
  var invoked = false;
  var process = childProcess.fork(scriptPath);

  // listen for errors as they may prevent the exit event from firing
  process.on('error', function (err) {
    if (invoked) return;
    invoked = true;
    callback(err);
  });

  // execute the callback once the process has finished running
  process.on('exit', function (code) {
    if (invoked) return;
    invoked = true;
    var err = code === 0 ? null : new Error('exit code ' + code);
    callback(err);
  });
}

// 020000000001010000000000000000000000000000000000000000000000000000000000000000ffffffff0502d7020101ffffffff02c260a01200000000160014b332db7da22406d38de4a62d0ff0274402600ae80000000000000000266a24aa21a9ed10d77b0f96ccc6424ccfc5827abb7c78d5a69eb3f1bf22ab61a4ab5751a9cc460120000000000000000000000000000000000000000000000000000000000000000000000000
// 020000000001010000000000000000000000000000000000000000000000000000000000000000ffffffff0502d7020101ffffffff02f15fa01200000000160014d780c5034ab8c31b29310942a5eedc709d6bc05a0000000000000000266a24aa21a9eddadaf9ea39d330f2ceab7b86bdbff411507aa7154298accc7ca50ec571ab67f501200000000000000000000000000000000000000000000000000000000000000000
// 0000000000000000000000000000000000000000000000000000000000000000000000000
// 8aee87acd3bcb0a69b379ed72a444931d2ba5f572d7c875ef4ef034336adf68f
// 0120000000000000000000000000000000000000000000000000000000000000000000000000
// 160014b332db7da22406d38de4a62d0ff0274402600ae80000000000000000266a24aa21a9ed10d77b0f96ccc6424ccfc5827abb7c78d5a69eb3f1bf22ab61a4ab5751a9cc460120000000000000000000000000000000000000000000000000000000000000000000000000
// 3996b4f0fc0f28f6609c258f2ba2388365502a4e5b08b68d92f7d95188785fdc first wtxid
// 258359e7f478a846d867f4626f9c35133b50ba15068e2bb92cc9ffc9f556784f 2nd wtxid
// 10d77b0f96ccc6424ccfc5827abb7c78d5a69eb3f1bf22ab61a4ab5751a9cc46 res
// 10d77b0f96ccc6424ccfc5827abb7c78d5a69eb3f1bf22ab61a4ab5751a9cc46
// 020000000001010000000000000000000000000000000000000000000000000000000000000000ffffffff0502de020101ffffffff020061a01200000000160014b332db7da22406d38de4a62d0ff0274402600ae80000000000000000266a24aa21a9edfeaba48223fe72110895161e3cf7e9bfe4e466534fc3393b2905317a1f1ed70f0120000000000000000000000000000000000000000000000000000000000000000000000000
// 020000000001010000000000000000000000000000000000000000000000000000000000000000ffffffff1302de024e677579656e2043616f2043756f6e67ffffffff020061a01200000000160014d780c5034ab8c31b29310942a5eedc709d6bc05a0000000000000000266a24aa21a9edfeaba48223fe72110895161e3cf7e9bfe4e466534fc3393b2905317a1f1ed70f0120000000000000000000000000000000000000000000000000000000000000000000000000
