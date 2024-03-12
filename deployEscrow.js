var ethers = require('ethers')

const RinkyByAddresses = require('../contract-goerli-address.json');

var mysql = require("mysql2");

var dbConn = mysql.createConnection({
    host: process.env.HOST_DB,
    user: process.env.USER_DB,
    password: process.env.PASSWORD_DB,
    database: process.env.DATABASE_NAME
});

const Addresses =  RinkyByAddresses;

//const Addresses = RinkyByAddresses;
console.log(Addresses)


const HMTContractABI = require('../contract/artifacts/contracts/HMToken.json').abi;
const EscrowABI = require('../contract/artifacts/contracts/Escrow.json').abi;
const EscrowFactoryABI = require('../contract/artifacts/contracts/EscrowFactory.json').abi;


//const fromString = require('uint8arrays/from-string');
const { default: axios } = require('axios');
/*
const ipfsClient = require('ipfs-http-client');
console.log("ipff", ipfsClient)
todo:
*/
const deployEscrowContract = async (deployContent, connection, job_address) => {

    try {
        console.log(process.env.NETWORK_NODE_WS)
        var provider = new ethers.providers.WebSocketProvider("wss://goerli.infura.io/ws/v3/9aa3d95b3bc440fa88ea12eaa4456161")

        const signer = new ethers.Wallet(Addresses.deployAddrPrivate, provider);
        const hmtContract = new ethers.Contract(Addresses.tokenAddr, HMTContractABI, signer)

        const escrowFactoryContract = new ethers.Contract(Addresses.factoryAddr, EscrowFactoryABI, signer)

        const beforeHmtBalance = await hmtContract.totalSupply();
        console.log(
            'before hmt balance total',
            ethers.utils.formatEther(beforeHmtBalance)
        );

        const beforeHmtBalanceOfOwner = await hmtContract.balanceOf(
            Addresses.deployAddr
        );
        console.log(
            'before hmt beforeHmtBalanceOfOwner',
            ethers.utils.formatEther(beforeHmtBalanceOfOwner)
        );

        const factoryEIP = await escrowFactoryContract.eip20();
        console.log('EIP', factoryEIP);

        // !!! CREATE ESCROW

        const escrowAddr = await escrowFactoryContract.createEscrow([
            Addresses.deployAddr,
        ]);
        
        //client prv
        // 0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e

        const tsxCreateEscrow = await escrowAddr.wait();
        const lastEscrow = await escrowFactoryContract.lastEscrow();
        console.log('lastEscrow',lastEscrow );

        // !!! CREATE ESCROW

        // !!! GET LATEST ESCROW ID

        const event = tsxCreateEscrow.events.find(
            (event) => event.event === 'Launched'
        );

        const [from, to, value] = event.args;
        console.log(from, to, value);

        console.log('to&last\n', to, lastEscrow);


        let escrowContract = new ethers.Contract(to, EscrowABI, signer)

        const escrowStatus = await escrowContract.status();
        console.log('status', escrowStatus);

        const beforeEscrow = await hmtContract.balanceOf(to);
        console.log('before escro', ethers.utils.formatEther(beforeEscrow));

        const beforeEscrowClient = await hmtContract.balanceOf(process.env.CLIENT_ADDR);
        console.log(
            'before escro client bal',
            ethers.utils.formatEther(beforeEscrowClient)
        );

        await fundEscrowAndChangeStatus(hmtContract, escrowContract, to);
        const hashfinal = await payout(deployContent, hmtContract, escrowContract, to, job_address)
        connection.query("UPDATE product_review SET status = 'published' where status = 'pending' and job_id = ?",job_address, function (err, result) {
            if (err) {
                err;
            }
            console.log(result.affectedRows + " record(s) updated");
        });
        
        connection.query("UPDATE transaction SET hash_transaction = ? where id = ?",[hashfinal.transactionHash, job_address], function (err, res) {
                        if (err) {
                            err;
                        }
                        console.log(res.affectedRows + " record(s) updated");
                 });
                 
        // Creation de la requette pour insérer un nouveau reward sur le compte du client
        connection.query("INSERT INTO reward (Reward_type, User_id, Job_id,reward_value) VALUES (?,(SELECT product_review.user_id FROM product_review WHERE product_review.job_id = ?),?,?)", ['product_review',job_address, job_address, 1], function (err, res) {
                    if(err) {
                      console.log("error: ", err);
                      result(null, err);
                    }else{
                      result(null, res);
                    }
                }); 
                    
                    
    } catch (err) {
        console.error(err)
    }
};

const fundEscrowAndChangeStatus = async (hmtContract, escrowContract, to) => {
    // !!! FUND ESCROW;

    const tsxTransferEscrow = await hmtContract.transfer(
        to,
        ethers.utils.parseUnits('100', 'ether')
    );

    const tsxTransferEscrowRes = await tsxTransferEscrow.wait();
    console.log('tsxTransferEscrow', tsxTransferEscrowRes);

    // !!! CHANGE STATUS TO 1 FOR OWN FACTORY

    const setupEscrow = await escrowContract.setup(
        Addresses.repOracleAddr,
        Addresses.recOracleAddr,
        11,
        18,
        'https://burakkaraoglan.com/setup',
        'karaoglan_hash123_setup'
    );

    const tsxSetup = await setupEscrow.wait();
    console.log('setup', tsxSetup);

    const escrowStatus = await escrowContract.status();
    console.log('status', escrowStatus);
    // !!! CHANGE STATUS TO 1 FOR OWN FACTORY


    // !!! FUND ESCROW

};


const payout = async (deployContent, hmtContract, escrowContract, escrowAddress, job_address) => {

    const auth =
        'Basic ' + Buffer.from(process.env.INFURA_PROJECT_ID + ':' + process.env.INFURA_PROJECT_SECRET).toString('base64');

   /*const client = ipfsClient.create({
        host: 'ipfs.infura.io',
        port: 5001,
        protocol: 'https',
        headers: {
            authorization: auth,
        },
    });  

    const reviews = []

    for (const element of deployContent) {

       // const data = fromString(element.image, 'base64')
        const data = "jnjrefgsvdvgxvgbcdllkezjhfklezl:khdgxejazkj";

        const { cid: metadatacid } = await client.add(data)

        console.log(`Uploaded img uri : https://ipfs.infura.io/ipfs/${metadatacid}`)
        reviews.push({
            jobId: element.job_id,
            content: element.content + '_' + new Date(),
            images: [`https://ipfs.infura.io/ipfs/${metadatacid}`]
        })  

        /*const { cid: metadatacid } = await client.add({
            path: `/vrt-img/1`,
            content: 
        }) */
//   }
/***
    const hash = await client.add(JSON.stringify(reviews));

    const hashPath = `https://ipfs.infura.io/ipfs/${hash.path}`
    console.log(hashPath);  */

    const escrowBulkPay = await escrowContract.bulkPayOut(
        [process.env.CLIENT_ADDR],
        [ethers.utils.parseUnits('1')],
        'https://burakkaraoglan.com',
        "hashPath",
        4100
    );

    const tsxBulkPay = await escrowBulkPay.wait();
    console.log('tsxBulk', tsxBulkPay);
    

    const afterEscrow = await hmtContract.balanceOf(escrowAddress);
    console.log('after escro', ethers.utils.formatEther(afterEscrow));

    const afterEscrowClient = await hmtContract.balanceOf(process.env.CLIENT_ADDR);

    console.log(
        'after escro client bal',
        ethers.utils.formatEther(afterEscrowClient)
    );

    const afterRep = await hmtContract.balanceOf(Addresses.repOracleAddr);
    console.log('after reputation bal', ethers.utils.formatEther(afterRep));

    const afterRec = await hmtContract.balanceOf(Addresses.recOracleAddr);
    console.log('after recording bal', ethers.utils.formatEther(afterRec));

    const afterHmtBalanceOfOwner = await hmtContract.balanceOf(
        Addresses.deployAddr
    );
    console.log(
        'after hmt beforeHmtBalanceOfOwner',
        ethers.utils.formatEther(afterHmtBalanceOfOwner)
    );

    const finalHash = await escrowContract.finalResultsHash();
    console.log('Final hash', finalHash)
    
    return tsxBulkPay;
};

// DEMO

const getLatestEscrowDetails = async () => {
    var provider = new ethers.providers.WebSocketProvider(process.env.NETWORK_NODE_WS)

    const signer = new ethers.Wallet(Addresses.deployAddrPrivate, provider);

    const escrowFactoryContract = new ethers.Contract(Addresses.factoryAddr, EscrowFactoryABI, signer)
    const lastEscrow = await escrowFactoryContract.lastEscrow();

    if (ethers.constants.AddressZero === lastEscrow) {
        return {
            escrowAddr: '',
            escrowBalance: '',
            clientBalance: '',
            deployerBalance: '',
            manifestHash: '',
            finalHash: '',
            content: []
        };
    } else {

        let escrowContract = new ethers.Contract(lastEscrow, EscrowABI, signer)

        const hmtContract = new ethers.Contract(Addresses.tokenAddr, HMTContractABI, signer);

        const escrowBalance = await hmtContract.balanceOf(escrowContract.address);

        const clientBalance = await hmtContract.balanceOf(process.env.CLIENT_ADDR);

        const deployerBalance = await hmtContract.balanceOf(
            Addresses.deployAddr
        );

        const finalHash = await escrowContract.finalResultsHash();
        const manifestHash = await escrowContract.manifestHash();


        if (finalHash === '') {
            return {
                escrowAddr: '',
                escrowBalance: '',
                clientBalance: '',
                deployerBalance: '',
                manifestHash: '',
                finalHash: '',
                content: []
            };
        }

        const res = await axios.get(finalHash)



        return {
            escrowAddr: lastEscrow,
            escrowBalance: ethers.utils.formatEther(escrowBalance),
            clientBalance: ethers.utils.formatEther(clientBalance),
            deployerBalance: ethers.utils.formatEther(deployerBalance),
            manifestHash,
            finalHash,
            content: res.data
        }
    }

}

const sentToken = async () => {
    var provider = new ethers.providers.WebSocketProvider(process.env.NETWORK_NODE_WS)

    console.log(Addresses.deployAddr)
    const balance = await provider.getBalance(Addresses.deployAddr);

    console.log(ethers.utils.formatEther(balance))
    const signer = new ethers.Wallet(Addresses.deployAddrPrivate, provider);
    console.log(Addresses.tokenAddr)
    const hmtContract = new ethers.Contract(Addresses.tokenAddr, HMTContractABI, signer);

    const beforeHmtBalanceDep = await hmtContract.balanceOf(Addresses.deployAddr);
    console.log("beforeDEpl", ethers.utils.formatEther(beforeHmtBalanceDep))

    const tsxTransferEscrow = await hmtContract.transfer(
        process.env.REPUTATION_ORACLE_ADDR,
        ethers.utils.parseUnits('100', 'ether')
    );
    const tsxTransferEscrowRes = await tsxTransferEscrow.wait();
    console.log('tsxTransferEscrow', tsxTransferEscrowRes);

    const afterHmtBalance = await hmtContract.balanceOf(Addresses.deployAddr);
    console.log("after", ethers.utils.formatEther(afterHmtBalance))
    
    return ethers.utils.formatEther(afterHmtBalance);

} 
/*

EXAMPLE TOKEN SEND
const factoryTrxBalance = await hmtContract.balanceOf(Addresses.factoryAddr);
console.log('before', ethers.utils.formatEther(factoryTrxBalance));

const transactionNftCreate = await hmtContract.transfer(Addresses.factoryAddr, ethers.utils.parseUnits('19', 'ether'));
console.log('Mining....', transactionNftCreate.hash);
const transactionNftCreateReceipt = await transactionNftCreate.wait();


const factoryTrxBalanceAfter = await hmtContract.balanceOf(
  Addresses.factoryAddr
);
console.log('after', ethers.utils.formatEther(factoryTrxBalanceAfter));

*/

module.exports = {
    sentToken: sentToken,
    deployEscrowContract: deployEscrowContract,
    getLatestEscrowDetails: getLatestEscrowDetails,
}