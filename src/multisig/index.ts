import * as Confirmations from "./confirmations";
import Methods from "./methods";
import * as Permissions from "./permissions";

const Multisig = {
  ...Confirmations,
  ...Methods,
  ...Permissions,
};

export default Multisig;
