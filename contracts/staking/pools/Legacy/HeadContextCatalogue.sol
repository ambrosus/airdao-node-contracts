// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.4.24;

// this file is used only for providing ABI in tests and deploy (migration) scripts

import "./IPoolsNodesManager.sol";


contract Head {
    address public owner;
    Context public context;
    constructor () {}

    function setContext(Context context_) public {
        context = context_;
    }
}

contract Context {
    mapping (address => bool) public trustedAddresses;
    Catalogue public catalogue;
    StorageCatalogue public storageCatalogue;
    string public versionTag;

    constructor(address[] memory _trustedAddresses, Catalogue _catalogue, StorageCatalogue _storageCatalogue, string memory _versionTag) public {
        require(_trustedAddresses.length > 0);
        require(_catalogue != address(0));
        require(_storageCatalogue != address(0));

        for (uint i = 0; i < _trustedAddresses.length; i++) {
            trustedAddresses[_trustedAddresses[i]] = true;
        }
        catalogue = _catalogue;
        storageCatalogue = _storageCatalogue;
        versionTag = _versionTag;
    }

    function setTrustedAddress(address _address, bool _trusted) public {
    }

    function isInternalToContext(address contractAddress) view public returns (bool) {
        return trustedAddresses[contractAddress];
    }
}


contract Catalogue {
    address public kycWhitelist;
    address public roles;
    address public fees;
    address public challenges;
    address public payouts;
    address public shelteringTransfers;
    address public sheltering;
    address public uploads;
    address public config;
    address public validatorProxy;
    address public time;
    IPoolsNodesManager public poolsNodesManager;

    constructor(
        address _kycWhitelist,
        address _roles,
        address _fees,
        address _time,
        address _challenges,
        address _payouts,
        address _shelteringTransfers,
        address _sheltering,
        address _uploads,
        address _config,
        address _validatorProxy,
        IPoolsNodesManager _poolsNodesManager
    ) public {
        kycWhitelist = _kycWhitelist;
        roles = _roles;
        fees = _fees;
        time = _time;
        challenges = _challenges;
        payouts = _payouts;
        shelteringTransfers = _shelteringTransfers;
        sheltering = _sheltering;
        uploads = _uploads;
        config = _config;
        validatorProxy = _validatorProxy;
        poolsNodesManager = _poolsNodesManager;
    }

    function change(address _from, address _to) public {

    }
}

contract StorageCatalogue {
    address public apolloDepositStore;
    address public atlasStakeStore;
    address public bundleStore;
    address public challengesStore;
    address public kycWhitelistStore;
    address public payoutsStore;
    address public rolesStore;
    address public shelteringTransfersStore;
    address public rolesEventEmitter;
    address public transfersEventEmitter;
    address public challengesEventEmitter;
    address public rewardsEventEmitter;
    address public poolsStore;
    address public poolEventsEmitter;
    address public nodeAddressesStore;
    address public rolesPrivilagesStore;

    constructor(
        address _apolloDepositStore,
        address _atlasStakeStore,
        address _bundleStore,
        address _challengesStore,
        address _kycWhitelistStore,
        address _payoutsStore,
        address _rolesStore,
        address _shelteringTransfersStore,
        address _rolesEventEmitter,
        address _transfersEventEmitter,
        address _challengesEventEmitter,
        address _rewardsEventEmitter,
        address _poolsStore,
        address _poolEventsEmitter,
        address _nodeAddressesStore,
        address _rolesPrivilagesStore
    ) public {
        apolloDepositStore = _apolloDepositStore;
        atlasStakeStore = _atlasStakeStore;
        bundleStore = _bundleStore;
        challengesStore = _challengesStore;
        kycWhitelistStore = _kycWhitelistStore;
        payoutsStore = _payoutsStore;
        rolesStore = _rolesStore;
        shelteringTransfersStore = _shelteringTransfersStore;
        rolesEventEmitter = _rolesEventEmitter;
        transfersEventEmitter = _transfersEventEmitter;
        challengesEventEmitter = _challengesEventEmitter;
        rewardsEventEmitter = _rewardsEventEmitter;
        poolsStore = _poolsStore;
        poolEventsEmitter = _poolEventsEmitter;
        nodeAddressesStore = _nodeAddressesStore;
        rolesPrivilagesStore = _rolesPrivilagesStore;
    }
}

contract Roles {
    function transferApollo(address apollo, address to) public {

    }
}
