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
  BaseNodesManagerRewardsBank = "BaseNodesManager_RewardsBank",

  LegacyPoolManager = "LegacyPoolManager",
  LegacyPoolManagerMultisig = "LegacyPoolManager_Multisig",
  LegacyPoolManagerRewardsBank = "LegacyPoolManager_RewardsBank",

  ServerNodesManager = "ServerNodesManager",
  ServerNodesManagerMultisig = "ServerNodesManager_Multisig",
  ServerNodesManagerRewardsBank = "ServerNodesManager_RewardsBank",

  // funds

  AirBond = "AirBond",

  // projects

  AirDrop = "AirDrop",

  LockKeeper = "LockKeeper",
}

export const MULTISIGS = {
  [ContractNames.FinanceMaster]: ContractNames.FinanceMasterMultisig,
  [ContractNames.FinanceRewards]: ContractNames.FinanceRewardsMultisig,
  [ContractNames.FinanceInvestors]: ContractNames.FinanceInvestorsMultisig,
  [ContractNames.FinanceTeam]: ContractNames.FinanceTeamMultisig,
  [ContractNames.FinanceEcosystem]: ContractNames.FinanceEcosystemMultisig,

  [ContractNames.ValidatorSet]: ContractNames.ValidatorSetMultisig,
  [ContractNames.BaseNodesManager]: ContractNames.BaseNodesManagerMultisig,
  [ContractNames.LegacyPoolManager]: ContractNames.LegacyPoolManagerMultisig,
  [ContractNames.ServerNodesManager]: ContractNames.ServerNodesManagerMultisig,
  [ContractNames.BaseNodesManagerRewardsBank]: ContractNames.BaseNodesManagerMultisig,
  [ContractNames.LegacyPoolManagerRewardsBank]: ContractNames.LegacyPoolManagerMultisig,
  [ContractNames.ServerNodesManagerRewardsBank]: ContractNames.ServerNodesManagerMultisig,
};

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
