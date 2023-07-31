import * as finance from "./finance";
import * as staking from "./staking";
import * as multisigs from "./multisigs";

const Methods = {
  ...multisigs,
  ...finance,
  ...staking,
};

export default Methods;
