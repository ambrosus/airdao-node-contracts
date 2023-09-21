// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IOnBlockListener {
    function onBlock() external;
}

abstract contract OnBlockNotifier {
    uint private constant E404 = type(uint256).max;
    IOnBlockListener[] internal listeners;

    function getBlockListeners() external view returns (IOnBlockListener[] memory) {
        return listeners;
    }

    function _addListener(IOnBlockListener listener) internal {
        uint index = _findIndexByValue(listener);
        require(index == E404, "Already listener");
        listeners.push(listener);
    }

    function _removeListener(IOnBlockListener listener) internal {
        uint index = _findIndexByValue(listener);
        require(index != E404, "Not found");
        listeners[index] = listeners[listeners.length - 1];
        listeners.pop();
    }

    function _notifyAll() internal {
        for (uint i; i < listeners.length; i++)
            try listeners[i].onBlock() {} catch {}
    }

    function _findIndexByValue(IOnBlockListener value) private returns (uint){
        for (uint i; i < listeners.length; i++)
            if (listeners[i] == value)
                return i;
        return E404;
    }
}
