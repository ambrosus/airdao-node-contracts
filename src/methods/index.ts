import * as finance from "./finance";
import * as staking from "./staking";
import * as multisigs from "./multisigs";
import * as consensus from "./consensus";
import * as apolloDashboard from "./apolloDashboard";

const Methods = {
  ...multisigs,
  ...finance,
  ...staking,
  ...consensus,
  ...apolloDashboard,
};

export default Methods;
