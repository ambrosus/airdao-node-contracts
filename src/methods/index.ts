import * as finance from "./finance";
import * as staking from "./staking";
import * as multisigs from "./multisigs";
import * as consensus from "./consensus";
import * as apolloDashboard from "./apolloDashboard";
import * as fees from "./fees";
import * as rewardsBank from "./rewards-bank";
import { submitTransaction } from "./internal";

const Methods = {
  ...multisigs,
  ...finance,
  ...staking,
  ...consensus,
  ...apolloDashboard,
  ...fees,
  ...rewardsBank,
  submitTransaction
};

export default Methods;
