export enum MultisigVersions {
  common = "common",
  ecosystem = "ecosystem",
}

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

  FinanceRevenue = "FinanceRevenue",
  FinanceRevenueMultisig = "FinanceRevenue_Multisig",

  // staking

  RewardsEmitter = "RewardsEmitter",
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

  Treasury = "Treasury",
  TreasuryMultisig = "Treasury_Multisig",

  // funds

  AirBond = "AirBond",

  // projects

  AirDrop = "AirDrop",

  LockKeeper = "LockKeeper",

  Fees = "Fees",
  FeesMultisig = "Fees_Multisig",
  FeesTreasure = "Fees_Treasure",

  // bond marketplace

  Ecosystem_MasterMultisig = "Ecosystem_MasterMultisig",
  Ecosystem_BondMarketplaceMultisig = "Ecosystem_BondMarketplace_Multisig",
  Ecosystem_BondMarketplaceRewardsBank = "Ecosystem_BondMarketplace_RewardsBank",
}

export const MULTISIGS_COMMON = {
  [ContractNames.FinanceMaster]: ContractNames.FinanceMasterMultisig,
  [ContractNames.FinanceRewards]: ContractNames.FinanceRewardsMultisig,
  [ContractNames.FinanceInvestors]: ContractNames.FinanceInvestorsMultisig,
  [ContractNames.FinanceTeam]: ContractNames.FinanceTeamMultisig,
  [ContractNames.FinanceEcosystem]: ContractNames.FinanceEcosystemMultisig,
  [ContractNames.FinanceRevenue]: ContractNames.FinanceRevenueMultisig,

  [ContractNames.ValidatorSet]: ContractNames.ValidatorSetMultisig,
  [ContractNames.BaseNodesManager]: ContractNames.BaseNodesManagerMultisig,
  [ContractNames.LegacyPoolManager]: ContractNames.LegacyPoolManagerMultisig,
  [ContractNames.ServerNodesManager]: ContractNames.ServerNodesManagerMultisig,
  [ContractNames.BaseNodesManagerRewardsBank]: ContractNames.BaseNodesManagerMultisig,
  [ContractNames.LegacyPoolManagerRewardsBank]: ContractNames.LegacyPoolManagerMultisig,
  [ContractNames.ServerNodesManagerRewardsBank]: ContractNames.ServerNodesManagerMultisig,
  [ContractNames.Treasury]: ContractNames.TreasuryMultisig,
  [ContractNames.Fees]: ContractNames.FeesMultisig,
  [ContractNames.FeesTreasure]: ContractNames.FeesMultisig,
};

export const MULTISIGS_ECOSYSTEM = {
  [ContractNames.Ecosystem_BondMarketplaceRewardsBank]: ContractNames.Ecosystem_BondMarketplaceMultisig,
};

export const MULTISIGS =
  process.env.MULTISIGS === "ecosystem"
    ? (MULTISIGS_ECOSYSTEM as Record<keyof typeof MULTISIGS_ECOSYSTEM, ContractNames>)
    : (MULTISIGS_COMMON as Record<keyof typeof MULTISIGS_COMMON, ContractNames>);

export const getMultisigs = (version: MultisigVersions = MultisigVersions.common) => {
  switch (version) {
    case MultisigVersions.ecosystem:
      return MULTISIGS_ECOSYSTEM;
    case MultisigVersions.common:
      return MULTISIGS_COMMON;
    default:
      return MULTISIGS_COMMON;
  }
};

export const getSlavesMultisigsNames = (version: MultisigVersions = MultisigVersions.common) => {
  const sigs = getMultisigs(version);
  return [...new Set(Object.values(sigs))];
};

export const slavesMultisigsNames = getSlavesMultisigsNames(process.env.MULTISIGS as MultisigVersions | undefined);

export const multisigsNames =
  process.env.MULTISIGS === "ecosystem"
    ? [ContractNames.Ecosystem_MasterMultisig, ...slavesMultisigsNames]
    : [ContractNames.MasterMultisig, ...slavesMultisigsNames];

export const getMultisigNames = (version: MultisigVersions = MultisigVersions.common) => {
  const multisigsNames: ContractNames[] = [];
  switch (version) {
    case MultisigVersions.ecosystem:
      multisigsNames.push(ContractNames.Ecosystem_MasterMultisig);
      break;
    case MultisigVersions.common:
      multisigsNames.push(ContractNames.MasterMultisig);
      break;
    default:
      multisigsNames.push(ContractNames.MasterMultisig);
      break;
  }
  const slaves = getSlavesMultisigsNames(version);
  multisigsNames.push(...slaves);
  return multisigsNames;
};
