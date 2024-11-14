// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "./Multisig.sol";
import "./MasterMultisig.sol";

address constant Igor = 0x55d46039e187b37a0201068dE189ecB63eaE87d2;
address constant Igor2 = 0x85e5e089782a3cAd89D1672DFBd7A9300d635Aa6;
address constant Aleksandr = 0x125854A4Ce5875ca46d1504ECf08897976022563;
address constant Andrii = 0xb16398c0698149Ae6EC342614830bC0511b83CAf;
address constant Seth = 0x6fA040aD7e94f905a29536Ba786D433638FeD19b;
address constant Valerii = 0x5700F8e0ae3d80964f7718EA625E3a2CB4D2096d;
address constant Oleksii = 0xa5E32D3fB342D9Ed3135fD5cb59a102AC8ED7B85;
address constant Olena = 0xe620e1F969Bc3a24Ac96D527220AD6B6e2d12843;
address constant Alina = 0x787afc1E7a61af49D7B94F8E774aC566D1B60e99;
address constant Alex = 0xe8592B3a9ee54472A0115262871eF43B5F3e8E53;
address constant Sophie = 0xBc2e61822443b18070E387F045CcFAD33E6958d0;
address constant Matthieu = 0x37d6bF7e8875137EefA8286e6AEA2cc4bFAF1247;
address constant Michael = 0xB72aDaffEb3419487C49690Dc68e963F7d7D81AC;

interface IMultisigFactory {
    struct MultisigSettings {
        address[] signers;
        bool[] isInitiatorFlags;
        uint threshold;
        address owner;
    }

    // Events
    event MultisigCreated(address indexed multisig);
    event MultisigRegistered(address indexed multisig);

    function createEcosystemMultisig() external returns (address);
    function createCommonMultisig() external returns (address);
    function registerMultisigs(address[] calldata _multisigs) external;
    function getEcosystemMultisigsCount() external view returns (uint256);
    function getCommonMultisigsCount() external view returns (uint256);
    function getAllMultisigsAddresses() external view returns (address[] memory);
    function getEcosystemMultisigsAddresses() external view returns (address[] memory);
    function getCommonMultisigsAddresses() external view returns (address[] memory);
    

}

