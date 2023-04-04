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

  ValidatorSet = "ValidatorSet",
  ValidatorSetMultisig = "ValidatorSet_Multisig",

  // finds

  AmbBond = "AmbBond",

  // projects

  AirDrop = "AirDrop",
}

export const slavesMultisigsNames = [
  ContractNames.FinanceMasterMultisig,
  ContractNames.FinanceRewardsMultisig,
  ContractNames.FinanceInvestorsMultisig,
  ContractNames.FinanceTeamMultisig,
  ContractNames.FinanceEcosystemMultisig,
];

export const multisigsNames = [ContractNames.MasterMultisig, ...slavesMultisigsNames];
