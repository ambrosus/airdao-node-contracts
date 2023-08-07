import * as finance from "./finance";
import * as staking from "./staking";
import * as multisigs from "./multisigs";
import * as consensus from "./consensus";

const Methods = {
  ...multisigs,
  ...finance,
  ...staking,
  ...consensus,
};

export default Methods;
