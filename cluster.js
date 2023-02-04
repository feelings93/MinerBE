const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const crypto = require('crypto');
const Client = require('bitcoin-core');
const { MerkleTree } = require('merkletreejs');
const SHA256 = require('crypto-js/sha256');
var childProcess = require('child_process');
const serviceAccount = require("./env.json");



const client = new Client({
    host: 'localhost',
//    network: 'testnet',
    username: serviceAccount.login,
    password: serviceAccount.passw,
//    port: 18332
//    port: 18445
	port: 8332
});

let getBlockTemplate;
let versionLE;
let previousblockhashLE = '';
let target= '';
let rootLE;
let timeLE;
let bitsLE;
let txID = [];
let txData = '';
let heatherString = '';
let shaHeatherLE = '';

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);
    // Fork workers.
    for (let i = 1; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
    });
} else {
    console.log(`Worker ${process.pid} started `);
    read_data().then(r => getWork());
}

async function read_data() {
    let fee =0;
    let sigops =0;
    let weight =0;

    let tx0= '';
    getBlockTemplate = await client.getBlockTemplate({"rules": ["segwit"]});
    let sigoplimit = getBlockTemplate.sigoplimit;
    let weightlimit = getBlockTemplate.weightlimit;
    let coinbasevalue = getBlockTemplate.coinbasevalue/100000000;

    versionLE = reverseX(getBlockTemplate.version);
    previousblockhashLE = reverseX(getBlockTemplate.previousblockhash);
    target = getBlockTemplate.target;

    //1
    await client.createRawTransaction ([],
//        {"tb1qlj6r6w7xnez3m8mlzfyc00npsx6srtwd424gwv":coinbasevalue}).then(help => {
        {"bc1qhl2d9f932x4f76vdqgupmy0698767aahmcz95p":coinbasevalue}).then(help => {
        tx0 = '02000000'+                                                       //версия
            '01'+                                                                   //кол входов
            '0000000000000000000000000000000000000000000000000000000000000000'+     //адрес входа
            'ffffffff'+                                                             //адрес выхода
            '13'+                                                                   //байт в coinbase
            '03'+
            byteToString(reverseX(getBlockTemplate.height))+
            '4578787573206c6f7665204c696e61'+                                       //coinbase
            'ffffffff'+                                                             //sequence
            help.slice(10);
        txData = tx0
    });
    //console.log(tx0);

    txID = [];
    await client.decodeRawTransaction(tx0).then(help => {
        txID.push(help.txid);
        weight += help.weight;
    });


    //2
    await getBlockTemplate.transactions.forEach(transactions => {
        if (sigops+transactions.sigops < sigoplimit && weight+transactions.weight < weightlimit) {
            sigops += transactions.sigops;
            weight += transactions.weight;
            fee += transactions.fee;
            txID.push(transactions.txid);
            txData = txData+transactions.data;
        }
    });
//    console.clear();
//    console.log(process.pid+'  Block: '+getBlockTemplate.height+'    '+ new Date(Date.now()));
//    console.log('sigopslimit: '+sigoplimit+'        sigops: '+sigops+'      fee:         '+fee/100000000+'   txLeng: '+txID.length);
//    console.log('weightlimit: '+weightlimit+'      weight: '+weight+'    coinbase:    '+coinbasevalue);

    //3
    const leaves = txID.map(x => Buffer.from(x, 'hex'));
    const tree = new MerkleTree(leaves, SHA256, { isBitcoinTree: true });
    rootLE = reverseX(tree.getRoot().toString('hex'));

    //4 time
    timeLE = reverseX(getBlockTemplate.curtime);

    //5 bits
    bitsLE = reverseX(getBlockTemplate.bits);

}

async function getWork() {
    let count=5000000-Math.random() * 5000000>>>0;

    //6 nonce
    //nonceLE = reverseX('00000000');
    let nonceInt = Math.random() * 0xFFFFFFFF>>>0;

    do {
        if (count === 5000000) {
            await read_data();
            count=0;

        }
        count++;

        let nonceStr = nonceInt.toString(16);
        while (nonceStr.length < 8) nonceStr ='0'+ nonceStr;
        //shaHeather
        let heatherByteLE = versionLE.
        concat(previousblockhashLE).
        concat(rootLE).
        concat(timeLE).
        concat(bitsLE).
        concat(nonceStr);
        heatherString = byteToString(heatherByteLE);

        //sha target
        let shaHeather = reverseX(dblsha(heatherString));

        shaHeatherLE = byteToString(shaHeather);
        if (nonceInt< 0xffffffff) nonceInt ++;
        else nonceInt = 0;
        if (shaHeatherLE.slice(0,8) === '00000000') {
//            console.log(process.pid+'  '+nonceInt);
//            console.log('mask:             1------12--------------------------------------------------------------23--------------------------------------------------------------34------45------56------6');
//            console.log('heatherLE:        '+heatherString);
            console.log(process.pid+'  shaHeatherLE:'+shaHeatherLE+'  nonce:'+nonceInt);
//            console.log('target:           '+target);
            // await submitBlock();
        }
    }
    while (parseInt(shaHeatherLE, 16) > parseInt(target, 16));
    await submitBlock();
    // read_data().then(r => getWork());



    function dblsha (data) {
        let sha2 = crypto.createHash('sha256').update(Buffer.from(data, 'hex')).digest('hex');
        return crypto.createHash('sha256').update(Buffer.from(sha2, 'hex')).digest('hex')
    }

}

async function submitBlock() {
    let info ='';
    let txCount;

    if      (txID.length < 0xFD)                   txCount = byteToString(reverseX(txID.length));
    else if (txID.length <= 0xFFFF)                txCount = 'FD'+byteToString(reverseX(txID.length));
    else if (txID.length <= 0xFFFFFF)              txCount = 'FE'+byteToString(reverseX(txID.length))+'00';
    else if (txID.length <= 0xFFFFFFFF)            txCount = 'FE'+byteToString(reverseX(txID.length));
    else if (txID.length <= 0xFFFFFFFFFF)          txCount = 'FF'+byteToString(reverseX(txID.length))+'000000';
    else if (txID.length <= 0xFFFFFFFFFFFF)        txCount = 'FF'+byteToString(reverseX(txID.length))+'0000';
    else if (txID.length <= 0xFFFFFFFFFFFFFF)      txCount = 'FF'+byteToString(reverseX(txID.length))+'00';
    else if (txID.length <= 0xFFFFFFFFFFFFFFFF)    txCount = 'FF'+byteToString(reverseX(txID.length));
    else console.log('txcount error!');

    console.log('\n\n\n\nResult success!\n\n\n\n');
    let block = heatherString + txCount + txData;
    console.log('block             '+block);
    await client.submitBlock(block).then(x => info = x);
}

function reverseX (data){
    data = data.toString(16);
    if (data.length % 2) data='0'+data;
    return data.match(/.{1,2}/g).reverse();
}

function byteToString(data) {
    let tempStr = '';
    data.forEach(x => tempStr += x);
    return tempStr
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