// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.4.24;

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
    Catalogue public catalogue;

    constructor (Catalogue catalogue_) {
        catalogue = catalogue_;
    }
}

contract Catalogue {
    IPoolsNodesManager public poolsNodesManager;
    constructor (IPoolsNodesManager poolsNodesManager_) {
        poolsNodesManager = poolsNodesManager_;
    }
}
