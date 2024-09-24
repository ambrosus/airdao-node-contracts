import {
  AddNodeRequest as AddNodeRequestEvent,
  NodeOnboarded as NodeOnboardedEvent,
  NodeRetired as NodeRetiredEvent
} from "../../generated/LiquidNodesManager/LiquidNodesManager";
import { Node, AddNodeRequest, NodeOnboarded, NodeRetired } from "../../generated/schema";

export function handleAddNodeRequest(event: AddNodeRequestEvent): void {
  const entity = new AddNodeRequest(event.transaction.hash.toHex() + "-" + event.logIndex.toString());
  entity.requestId = event.params.requestId;
  entity.nodeId = event.params.nodeId;
  entity.stake = event.params.stake;
  entity.timestamp = event.block.timestamp;
  entity.save();

  const node = new Node(event.params.nodeId.toString());
  node.nodeId = event.params.nodeId;
  node.stake = event.params.stake;
  node.status = "REQUESTED";
  node.requestId = event.params.requestId;
  node.save();
}

export function handleNodeOnboarded(event: NodeOnboardedEvent): void {
  const entity = new NodeOnboarded(event.transaction.hash.toHex() + "-" + event.logIndex.toString());
  entity.requestId = event.params.requestId;
  entity.timestamp = event.block.timestamp;

  const node = Node.load(event.params.nodeId.toString());
  if (node) {
    node.address = event.params.node;
    node.status = "ONBOARDED";
    node.onboardedAt = event.block.timestamp;
    node.save();

    entity.node = node.id;
  }

  entity.save();
}

export function handleNodeRetired(event: NodeRetiredEvent): void {
  const entity = new NodeRetired(event.transaction.hash.toHex() + "-" + event.logIndex.toString());
  entity.timestamp = event.block.timestamp;

  const node = Node.load(event.params.nodeId.toString());
  if (node) {
    node.status = "RETIRED";
    node.retiredAt = event.block.timestamp;
    node.save();

    entity.node = node.id;
  }

  entity.save();
}
