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

  Ecosystem_StarfleetMultisig = "Ecosystem_Starfleet_Multisig",
  Ecosystem_StarfleetRewardsBank = "Ecosystem_Starfleet_RewardsBank",

  Ecosystem_AstradexMultisig = "Ecosystem_Astradex_Multisig",
  Ecosystem_AstradexTokenSafe = "Ecosystem_Astradex_TokenSafe",
  Ecosystem_AstradexTokenSafeMultisig = "Ecosystem_Astradex_TokenSafe_Multisig",

  Ecosystem_LiquidPool = "Ecosystem_LiquidPool",
  Ecosystem_LiquidPoolStAMB = "Ecosystem_LiquidPool_StAMB",
  Ecosystem_LiquidPoolMultisig = "Ecosystem_LiquidPool_Multisig",
  Ecosystem_LiquidPoolRewardsBank = "Ecosystem_LiquidPool_RewardsBank",
  Ecosystem_LiquidNodesManager = "Ecosystem_LiquidNodesManager",
  Ecosystem_LiquidNodesManagerRewardsBank = "Ecosystem_LiquidNodesManager_RewardsBank",
  Ecosystem_LiquidNodesManagerTreasury = "Ecosystem_LiquidNodesManager_Treasury",
  Ecosystem_LiquidNodesManagerTreasuryFees = "Ecosystem_LiquidNodesManager_TreasuryFees",
  Ecosystem_LiquidPoolStakingTiers = "Ecosystem_LiquidPool_StakingTiers",

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

  [ContractNames.Ecosystem_LiquidPool]: ContractNames.Ecosystem_LiquidPoolMultisig,
  [ContractNames.Ecosystem_LiquidNodesManager]: ContractNames.Ecosystem_LiquidPoolMultisig,
  [ContractNames.Ecosystem_LiquidPoolRewardsBank]: ContractNames.Ecosystem_LiquidPoolMultisig,
  [ContractNames.Ecosystem_LiquidNodesManagerRewardsBank]: ContractNames.Ecosystem_LiquidPoolMultisig,
  [ContractNames.Ecosystem_LiquidNodesManagerTreasury]: ContractNames.Ecosystem_LiquidPoolMultisig,
  [ContractNames.Ecosystem_LiquidNodesManagerTreasuryFees]: ContractNames.Ecosystem_LiquidPoolMultisig,
  [ContractNames.Ecosystem_LiquidPoolStAMB]: ContractNames.Ecosystem_LiquidPoolMultisig,
  [ContractNames.Ecosystem_LiquidPoolStakingTiers]: ContractNames.Ecosystem_LiquidPoolMultisig,
  [ContractNames.Ecosystem_AstradexTokenSafe]: ContractNames.Ecosystem_AstradexTokenSafeMultisig,  // yes, this should be under master multisig
};

export const MULTISIGS_ECOSYSTEM = {
  [ContractNames.Ecosystem_BondMarketplaceRewardsBank]: ContractNames.Ecosystem_BondMarketplaceMultisig,
  [ContractNames.Ecosystem_StarfleetRewardsBank]: ContractNames.Ecosystem_StarfleetMultisig,
};

export const MULTISIGS = {...MULTISIGS_COMMON, ...MULTISIGS_ECOSYSTEM};


export function getEnvironment(version: MultisigVersions = MultisigVersions.common) {
  if (version == MultisigVersions.ecosystem) {
    return {
      master: ContractNames.Ecosystem_MasterMultisig,
      slaves: [
        ...new Set(Object.values(MULTISIGS_ECOSYSTEM)),
        // multisigs below are not listed in the MULTISIGS_ECOSYSTEM, so we add them manually
        ContractNames.Ecosystem_AstradexMultisig,
      ],
    };
  }
  if (version == MultisigVersions.common) {
    return {
      master: ContractNames.MasterMultisig,
      slaves: [...new Set(Object.values(MULTISIGS_COMMON))]
    };
  }
  throw new Error("Unknown environment");
}
