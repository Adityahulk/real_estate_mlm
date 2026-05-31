export type Side = "LEFT" | "RIGHT";

export interface TreeNode {
  id: string;
  treeParentId: string | null;
  treeSide: Side | null;
}

export interface Placement {
  parentId: string;
  side: Side;
  level: number;
}

// BFS placement: starting from the root, scan level by level, left-to-right, and
// return the first node that has an empty LEFT slot; if none, the first empty
// RIGHT slot. This is the single-tree, auto-fill rule (members can't choose).
export function findBfsPlacement(nodes: TreeNode[], rootId: string): Placement {
  const childrenOf = new Map<string, { LEFT?: string; RIGHT?: string }>();
  const levelOf = new Map<string, number>();
  for (const n of nodes) {
    if (n.treeParentId && n.treeSide) {
      const slot = childrenOf.get(n.treeParentId) ?? {};
      slot[n.treeSide] = n.id;
      childrenOf.set(n.treeParentId, slot);
    }
  }
  levelOf.set(rootId, 0);

  const queue: string[] = [rootId];
  while (queue.length) {
    const cur = queue.shift()!;
    const lvl = levelOf.get(cur) ?? 0;
    const slot = childrenOf.get(cur) ?? {};
    if (!slot.LEFT) return { parentId: cur, side: "LEFT", level: lvl + 1 };
    if (!slot.RIGHT) return { parentId: cur, side: "RIGHT", level: lvl + 1 };
    levelOf.set(slot.LEFT, lvl + 1);
    levelOf.set(slot.RIGHT, lvl + 1);
    queue.push(slot.LEFT, slot.RIGHT);
  }
  // unreachable for a connected tree with a root
  return { parentId: rootId, side: "LEFT", level: 1 };
}

// Given the newly placed node, returns the list of {ancestorId, side} counter
// increments: walk from the new node up to the root; at each step the ancestor's
// count on the side the child sits in is incremented.
export function ancestorIncrements(args: {
  newNodeParentId: string;
  newNodeSide: Side;
  parentOf: Map<string, { parentId: string | null; side: Side | null }>;
}): { ancestorId: string; side: Side }[] {
  const out: { ancestorId: string; side: Side }[] = [];
  let currentId: string | null = args.newNodeParentId;
  let sideFromCurrent: Side = args.newNodeSide;
  while (currentId) {
    out.push({ ancestorId: currentId, side: sideFromCurrent });
    const parent = args.parentOf.get(currentId);
    if (!parent || !parent.parentId || !parent.side) break;
    sideFromCurrent = parent.side;
    currentId = parent.parentId;
  }
  return out;
}

// Walks the sponsor chain up to maxDepth, returning member ids (depth 1 first).
export function buildSponsorChain(args: {
  startSponsorId: string | null;
  sponsorOf: Map<string, string | null>;
  maxDepth: number;
}): string[] {
  const chain: string[] = [];
  let cur = args.startSponsorId;
  while (cur && chain.length < args.maxDepth) {
    chain.push(cur);
    cur = args.sponsorOf.get(cur) ?? null;
  }
  return chain;
}
