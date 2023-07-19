export enum ContractNames {
  MasterMultisig = "MasterMultisig",

  // finance + multisig
  FinanceMaster = "FinanceMaster",
  FinanceMasterMultisig = "FinanceMaster_Multisig",

  FinanceRewards = "FinanceRewards",
  FinanceRewardsMultisig = "FinanceRewards_Multisig",

  FinanceInvestors = "FinanceInvestors",
  FinanceInvestorsMultisig = "FinanceInvestors_Multisig",

  FinanceTeam = "FinanceTeam",
  FinanceTeamMultisig = "FinanceTeam_Multisig",

  FinanceEcosystem = "FinanceEcosystem",
  FinanceEcosystemMultisig = "FinanceEcosystem_Multisig",

  // staking

  ValidatorSet = "ValidatorSet",
  ValidatorSetMultisig = "ValidatorSet_Multisig",

  BaseNodesManager = "BaseNodesManager",
  BaseNodesManagerMultisig = "BaseNodesManager_Multisig",

  LegacyPoolManager = "LegacyPoolManager",
  LegacyPoolManagerMultisig = "LegacyPoolManager_Multisig",

  ServerNodesManager = "ServerNodesManager",
  ServerNodesManagerMultisig = "ServerNodesManager_Multisig",

  // funds

  AirBond = "AirBond",

  // projects

  AirDrop = "AirDrop",
}

export const slavesMultisigsNames = [
  ContractNames.FinanceMasterMultisig,
  ContractNames.FinanceRewardsMultisig,
  ContractNames.FinanceInvestorsMultisig,
  ContractNames.FinanceTeamMultisig,
  ContractNames.FinanceEcosystemMultisig,

  ContractNames.ValidatorSetMultisig,
  ContractNames.BaseNodesManagerMultisig,
  ContractNames.LegacyPoolManagerMultisig,
  ContractNames.ServerNodesManagerMultisig,
];

export const multisigsNames = [ContractNames.MasterMultisig, ...slavesMultisigsNames];
