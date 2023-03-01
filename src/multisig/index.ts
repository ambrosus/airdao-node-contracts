import * as Confirmations from './confirmations'
import * as Methods from './methods'
import * as Permissions from './permissions'

const Multisig = {
  ...Confirmations,
  ...Methods,
  ...Permissions
}

export default Multisig;
