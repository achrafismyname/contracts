const nearAPI = require('near-api-js')
const BN = require('bn.js')
const fs = require('fs').promises
const assert = require('assert').strict

function getConfig(env) {
    switch (env) {
        case 'sandbox':
        case 'local':
            return {
                networkId: 'sandbox',
                nodeUrl: 'http://localhost:3030',
                masterAccount: 'test.near',
                contractAccount: 'status-message.test.near',
                keyPath: '/tmp/near-sandbox/validator_key.json',
            }
    }
}

const contractMethods = {
    viewMethods: [
        'nft_token',
        'nft_total_supply',
        'nft_supply_for_owner',
        'nft_tokens',
        'nft_metadata',
        'get_bids',
        'get_bidder_bids',
        'nft_tokens_for_owner',
    ],
    changeMethods: ['init', 'mint', 'bid'],
}
let config
let masterAccount
let masterKey
let pubKey
let keyStore
let near

async function initNear() {
    config = getConfig(process.env.NEAR_ENV || 'sandbox')
    const keyFile = require(config.keyPath)
    masterKey = nearAPI.utils.KeyPair.fromString(
        keyFile.secret_key || keyFile.private_key
    )
    pubKey = masterKey.getPublicKey()
    keyStore = new nearAPI.keyStores.InMemoryKeyStore()
    keyStore.setKey(config.networkId, config.masterAccount, masterKey)
    near = await nearAPI.connect({
        deps: {
            keyStore,
        },
        networkId: config.networkId,
        nodeUrl: config.nodeUrl,
    })
    masterAccount = new nearAPI.Account(near.connection, config.masterAccount)
    console.log('Finish init NEAR')
}

async function createContractUser(
    accountPrefix,
    contractAccountId,
    contractMethods
) {
    let accountId = accountPrefix + '.' + config.masterAccount
    await masterAccount.createAccount(
        accountId,
        pubKey,
        new BN(10).pow(new BN(26))
    )
    keyStore.setKey(config.networkId, accountId, masterKey)
    const account = new nearAPI.Account(near.connection, accountId)
    const accountUseContract = new nearAPI.Contract(
        account,
        contractAccountId,
        contractMethods
    )
    return accountUseContract
}

async function initTest() {
    const contract = await fs.readFile('./build/release/cNFT.wasm')
    await masterAccount.createAndDeployContract(
        config.contractAccount,
        pubKey,
        contract,
        new BN(10).pow(new BN(25))
    )

    const aliceUseContract = await createContractUser(
        'alice',
        config.contractAccount,
        contractMethods
    )

    const bobUseContract = await createContractUser(
        'bob',
        config.contractAccount,
        contractMethods
    )
    console.log('Finish deploy contracts and create test accounts')
    return { aliceUseContract, bobUseContract }
}

// Utils
function randomString(length) {
    let result = ''
    const characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const charactersLength = characters.length
    for (let i = 0; i < length; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * charactersLength)
        )
    }
    return result
}

function randomInt(min = 0, max = 10) {
    return Math.floor(Math.random() * (max - min + 1) + min)
}

// Example data
const CONTRACT_METADATA = {
    spec: 'nft-1.0.0',
    name: 'nftExample',
    symbol: 'NFTEXAMPLE',
    icon: '',
    base_uri: 'https://picsum.photos',
    reference: '',
    reference_hash: '',
    packages_script: '',
    render_script: '',
    style_css: '',
    parameters: '',
}

const TOKEN_ROYALTY = {
    split_between: { 'alice.test.near': 10 },
    percentage: 20,
}

function random_token_metadata() {
    const TOKEN_METADATA = {
        title: randomString(randomInt(0, 100)),
        copies: randomInt(1, 10),
        description: randomString(randomInt(0, 1000)),
        extra: randomString(randomInt(0, 100)),
        media: `https://picsum.photos/seed/${randomString(6)}/300/300`,
        reference: `https://picsum.photos/seed/${randomString(6)}/300/300`,
    }
    return TOKEN_METADATA
}

// Test configs

const TOTAL_MINT = 50

// Gas
const CONTRACT_INIT_GAS = nearAPI.utils.format.parseNearAmount('0.00000000030') // 300 Tgas
const CONTRACT_MINT_GAS = nearAPI.utils.format.parseNearAmount('0.00000000030') // 300 Tgas
const CONTRACT_TOKENS_GAS =
    nearAPI.utils.format.parseNearAmount('0.00000000030') // 1000 Tgas
const CONTRACT_MINT_PRICE = nearAPI.utils.format.parseNearAmount('1') // 1N

// Test
async function test() {
    /**
     * 1. Creates testing accounts and deploys a contract
     */
    await initNear()
    const { aliceUseContract, bobUseContract } = await initTest()

    /**
     * 2. Initialize the contract metadata
     */
    await aliceUseContract.init({
        args: {
            contract_metadata: CONTRACT_METADATA,
        },
        gas: CONTRACT_INIT_GAS,
    })
    console.log('Init contract by Alice')

    /**
     * 3. Minting tokens
     */

    for (let i = 0; i < TOTAL_MINT / 2; i++) {
        await aliceUseContract.mint({
            args: {
                tokenMetadata: random_token_metadata(),
                token_royalty: TOKEN_ROYALTY,
            },
            gas: CONTRACT_MINT_GAS,
            amount: CONTRACT_MINT_PRICE,
        })
        await bobUseContract.mint({
            args: {
                tokenMetadata: random_token_metadata(),
                token_royalty: TOKEN_ROYALTY,
            },
            gas: CONTRACT_MINT_GAS,
            amount: CONTRACT_MINT_PRICE,
        })
    }
    console.log(
        `Minted ${TOTAL_MINT / 2} NFTs for Alice and ${TOTAL_MINT / 2
        } NFTs for Bob`
    )

    /**
     * 4. Test enumeration methods
     */

    // a. get NFT Total Supply

    const total_supply = await bobUseContract.nft_total_supply()
    assert.equal(parseInt(total_supply), TOTAL_MINT)
    console.log(`"nft_total_supply" returns the right amount: ${TOTAL_MINT}`)

    // b. get NFT Supply for Owner

    const nft_supply_for_alice = await aliceUseContract.nft_supply_for_owner({
        account_id: 'bob.test.near',
    })
    assert.equal(parseInt(nft_supply_for_alice), TOTAL_MINT / 2)
    console.log(
        `"nft_supply_for_owner" returns the right amount ${TOTAL_MINT / 2}`
    )

    // c. get nft tokens

    const tokens = await aliceUseContract.nft_tokens({
        from_index: '0',
        limit: 2,
    })

    console.log(`"nft_tokens" works well`)

    // d. get nft_tokens limit

    for (let i = 1; i < TOTAL_MINT; i++) {
        // trying to find limit
        try {
            await aliceUseContract.nft_tokens({
                from_index: '0',
                limit: i,
            })
        } catch {
            console.log(`limit for "nft_tokens" without gas is ${i - 1}`)
            break
        }
    }

    // e. get nft tokens for owner

    const aliceTokens = await aliceUseContract.nft_tokens_for_owner({
        account_id: "alice.test.near",
        from_index: '0',
        limit: 2,
    })

    console.log(`"nft_tokens_for_owner" works well`)

    // f. get nft_tokens limit

    for (let i = 1; i < TOTAL_MINT; i++) {
        // trying to find limit
        try {
            await aliceUseContract.nft_tokens_for_owner({
                account_id: "alice.test.near",
                from_index: '0',
                limit: i,
            })
        } catch {
            console.log(`limit for "nft_tokens_for_owner" without gas is ${i - 1}`)
            break
        }
    }



    /**
     * 5. Test market methods
     */

    // a. Bob bids on Alice token
    await bobUseContract.bid({
        tokenId: aliceTokens[0].id,
        amount: "1",
    })
    console.log(`"bid" works well`)

    // b. Alice get bids 
    const bids_for_alice = await aliceUseContract.get_bids({
        tokenId: aliceTokens[0].id,
    })
    assert.equal(bids_for_alice[0].amount, "1")
    assert.equal(bids_for_alice[0].bidder, 'bob.test.near')

    console.log('get_bids returns the right data')

    // c. get bids made by Bob
    const bids_by_bob = await bobUseContract.get_bidder_bids({
        accountId: 'bob.test.near',
    })
    assert.equal(bids_by_bob[0].amount, "1")
    assert.equal(bids_by_bob[0].bidder, 'bob.test.near')

    console.log('get_bidder_bids returns the right data')

    // 4. To Be Continued :-)
}

test()
