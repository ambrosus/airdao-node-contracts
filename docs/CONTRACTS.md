## Contracts

## Consensus

#### Validator Set

`ValidatorSet.sol` contract is the hearth of the blockchain.

It used for:
- Store information about all addresses that want to participate in the consensus.   
Nodes can be registered via staking manager contracts, using 
[IValidatorSet](https://github.com/ambrosus/airdao-node-contracts/blob/dev/contracts/consensus/IValidatorSet.sol) interface.
ValidatorSet do not store staked funds, it only stores information about nodes and their stakes.
For each registered node, contract stores the following information:
```
  uint amount;                      // stake amount
  IStakeManager stakingContract;    // address of staking manager that registered this node
  bool isAlwaysTop;                 // if true, this node will always be in the validator set (for base nodes)
```
  

- Manage the set of validators, which are determined by sorting the list of registered nodes by their stake in descending order.  
Each time set of validators is changed, contract emits `InitiateChange` event, that is used by the consensus engine to start the new round of consensus.  
Than, when new round is started, engine calls `finalizeChange` function, that updates the finalized set of validators;   
Read more about openethereum ValidatorSet here [ValidatorSet](https://openethereum.github.io/Validator-Set)
  

- Calculating the reward for the block producer, based on his share of the total stake.  
Each time block is produced, our implementation of the consensus engine will call `process()` function, 
that will calculate the reward for the block producer and distribute it to him (via staking manager that register him).
  

- Call `onBlock` function on each contract that registered in ValidatorSet at the moment of block production. 
See [OnBlockNotifier.sol](https://github.com/ambrosus/airdao-node-contracts/blob/dev/contracts/consensus/OnBlockNotifier.sol)
  
  
## Staking

### StakeManagers

Staking managers are used to register nodes in the ValidatorSet, manage their stakes and distribution of rewards.
All staking managers should implement [IStakeManager](https://github.com/ambrosus/local-network-test/blob/dev/contracts/staking/IStakeManager.sol).
Staking managers are paying rewards from [RewardsBank](https://github.com/ambrosus/local-network-test/blob/aee665dd09235491081d4474f809a9eb1bb9e04d/contracts/funds/RewardsBank.sol) contracts.

#### Base Nodes Staking Manager
`BaseNodes_Manager.sol` - allows to register nodes as a "base" node - a node that is required to run the network.  
Base nodes are nodes that are responsible for the network stability and security and they are owned by the DAO.
Registering and rewarding logic are simple in this manager, without any additional logic.
All nodes in BaseNodes Manager are registered and owned by DAO multisig.


#### Server Nodes Staking Manager
`ServerNodes_Manager.sol` - allows to register nodes as a "server" node - a node that is owned by user and running on user's hardware.
After staking first time in this manager node will wait some time (`onboardingDelay`) before it will be able to participate in the consensus.
Unstaking in this manager is also delayed by `unstakingDelay` time - funds will be locked in the
[LockKeeper](https://github.com/ambrosus/local-network-test/blob/dev/contracts/LockKeeper.sol) contract for this time.
This manager pays reward in native AMB coins and AirBOND tokens, ratio depends on how long node is staked. 
In this manager, stake owner address, node address and rewards receiver address can be different.
Any user can register a node in this manager [here](https://airdao.io/explorer/node-setup/).

#### Pool Nodes Staking Manager
At this time only `LegacyPoolNodes_Manager.sol` is used, to support one legacy pool that we have - ["Hera" pool](https://airdao.io/staking/).
Legacy contracts was deployed from
[ambrosus-node-contracts](https://github.com/ambrosus/ambrosus-node-contracts/tree/master/contracts/Pool) repository and
some code was copy-pasted here for convinience.

This manager allows to register nodes as a "pool" node - a node that is owned by some pool. Pool can own multiple nodes.
Only pool contract can register nodes in this manager. 

This manager pay rewards to the pool contract each time block is produced by node owned by this pool.
Pool contract will distribute rewards to the pool members.

Users are not using this manager directly, they are using pool contract to stake in pool.
Any user can stake in pool in this manager [here](https://airdao.io/staking/)

## Multisig


#### Multisig.sol

Almost all our contracts are owned by some multisig deployed from `Multisig.sol`.
`Multisig.sol` - is enhanced version of the [Gnosis Safe MultiSigWallet](https://github.com/gnosis/MultiSigWallet/blob/master/contracts/MultiSigWallet.sol) contract.
There is some additional logic to support our needs, like:
- To submit a transaction, signer must have `initiator` permission in the multisig. Without this permission, signer can only sign transactions of other initiators. 
- Signers, initiators and threshold can be changed by multisig owner. Owner can be this contract itself or any other multisig.
- `checkBeforeSubmitTransaction` function can be used to check if transaction is valid before submitting it.
- Small improvements to view functions.

#### MasterMultisig.sol

`MasterMultisig.sol` - is used as a master multisig for all other multisigs - it is the owner of all other multisigs (including himself).
It's inherited from `Multisig.sol` and has some additional logic to support our needs, like:
- function for batch editing child multisigs
- function for batch getting info about child multisigs


## Finance

#### Finance.sol
`Finance.sol` - is used for storing and managing funds of the DAO. 
It's only has `withdraw` function, that allows to withdraw funds from the contract.

#### FinanceMaster.sol

`FinanceMaster.sol` - is used for same purpose as `Finance.sol`, but store funds in multiple `Bank.sol` contracts.
On getting funds via `receive()` function, it will distribute them to the banks, storing maximum of `maxBankBalance` in each bank.
`Withdraw` function will withdraw funds from the banks.

#### Treasury.sol
`Treasury.sol` - is for storing fees and managing fee percent.
Inherits from `FinanceMaster.sol` and has additional logic to support our needs, like:
- `setFee` and `calcFee` - functions to set fee percent and calculate fee from amount.


## Funds

#### AirBOND.sol
Token, used as a reward for staking in `ServerNodes_Manager.sol`.

#### RewardsBank.sol
`RewardsBank.sol` - is used for storing and managing rewards. 
Similar to `Finance.sol`, but allows to use both native AMB coins and ERC20 tokens.
