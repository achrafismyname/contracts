import { VMContext } from 'near-mock-vm'
import { u128 } from 'near-sdk-as'
import { defaultNFTContractMetadata } from '../models/persistent_nft_contract_metadata'
import { TokenMetadata } from '../models/persistent_tokens_metadata'
import { TokenRoyalty } from '../models/persistent_tokens_royalty'
import {
    nft_total_supply,
    nft_tokens,
    nft_token,
    nft_supply_for_owner,
    nft_tokens_for_owner,
    mint,
    nft_metadata,
    init,
    nft_transfer,
} from '../index'
import { Token } from '../models/persistent_tokens'
import { AccountId } from '../types'
import { nft_payout } from '../royalty_payout'

const mintToken = (accountId: AccountId): Token => {
    VMContext.setSigner_account_id(accountId)

    const token_metadata = new TokenMetadata()
    token_metadata.media = 'media'
    token_metadata.extra = 'extra'

    const token_royalty = new TokenRoyalty()
    token_royalty.percentage = 2500
    token_royalty.split_between.set('address', 2500)

    const token = mint(token_metadata, token_royalty)
    return token
}

const initContract = (): void => {
    const nft_contract_metadata = defaultNFTContractMetadata()

    init(nft_contract_metadata)
}

describe('- CONTRACT -', () => {
    it('xxx returns token lenght', () => {
        const nftTotalSupply = nft_total_supply()

        log(nftTotalSupply)
    })

    it('xxx returns persistent token', () => {
        const token = mintToken('prova.testnet')
        const nftToken = nft_token(token.id)

        log(nftToken)
    })

    it('xxx mints token', () => {
        const token = mintToken('prova.testnet')

        log(token)
    })

    it('xxx returns supply for owner', () => {
        mintToken('prova.testnet')
        mintToken('prova.testnet')

        const nftSupplyForOwner = nft_supply_for_owner('prova.testnet')

        log(nftSupplyForOwner)
    })

    it('xxx returns range of tokens', () => {
        mintToken('prova.testnet')
        mintToken('hello.testnet')
        mintToken('yellow.testnet')
        const nfttokens = nft_tokens('0', 3)
        expect(nfttokens.length).toStrictEqual(3)

        log(nfttokens)
    })

    it('xxx returns range of tokens for owner', () => {
        mintToken('hello.testnet')
        mintToken('hello.testnet')
        mintToken('hello.testnet')
        mintToken('hello.testnet')
        const nfttokensforowner = nft_tokens_for_owner('hello.testnet', '0', 3)
        expect(nfttokensforowner.length).toStrictEqual(3)

        log(nfttokensforowner)
    })

    it('xxx returns token payout', () => {
        const token = mintToken('hello.testnet')
        const tokenPayout = nft_payout(token.id, u128.from('10000000000'))
        log(tokenPayout)
    })

    it('xxx returns nft contract metadata', () => {
        initContract()

        const nftContractMetadata = nft_metadata()

        log(nftContractMetadata)
    })

    it('transfer tokens from xxx', () => {
        const token = mintToken('hello.testnet')

        nft_transfer(token.id, 'yellow.testnet')

        let tokens = nft_token(token.id)

        log(tokens)
    })
})
