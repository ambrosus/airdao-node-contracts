// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./Multisig.sol";

contract MasterMultisig is Multisig {
    constructor(
        address[] memory _signers, bool[] memory isInitiatorFlags,
        uint _threshold
    ) Multisig(_signers, isInitiatorFlags, _threshold, address(this)) {
        // address(this) as owner argument means that only this contract can change signers through multisig transaction
        _validateSigners();
    }



    // function to retrieve signers of child multisigs
    function getAllSigners(address[] memory multisigs) public view returns (MultisigSettingsStruct[] memory) {
        MultisigSettingsStruct[] memory result = new MultisigSettingsStruct[](multisigs.length);
        for (uint i=0; i<multisigs.length; i++) {
            (address[] memory signers_, bool[] memory isInitiatorFlags_) = Multisig(multisigs[i]).getSigners();
            uint threshold_ = Multisig(multisigs[i]).threshold();
            result[i] = MultisigSettingsStruct({signers: signers_, isInitiatorFlags: isInitiatorFlags_, threshold: threshold_});
        }
        return result;
    }
    struct MultisigSettingsStruct {
        address[] signers;
        bool[] isInitiatorFlags;
        uint threshold;
    }


    // function to change signers of any child multisig
    function changeSignersMaster(ChangeSignersStruct[] memory changes) public onlyOwner {
        for (uint i=0; i<changes.length; i++) {
            ChangeSignersStruct memory change = changes[i];
            Multisig(change.contract_).changeSigners(change.signersToRemove, change.signersToAdd, change.isInitiatorFlags);
        }
    }
    struct ChangeSignersStruct {
        address contract_;
        address[] signersToRemove;
        address[] signersToAdd;
        bool[] isInitiatorFlags;
    }



    // override and check that here is minimum 2 initiators
    function _validateSigners() internal override {
        super._validateSigners();
        uint initiatorsCount;
        for (uint i=0; i<signers.length; i++)
            if (isInitiator[signers[i]]) initiatorsCount++;

        // todo at least 1
        require(initiatorsCount >= 2, "must be at least 2 initiators");

        // todo
    }

}
