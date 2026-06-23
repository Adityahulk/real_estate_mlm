import { describe, it, expect } from "vitest";
import { findBfsPlacement, ancestorIncrements, buildSponsorChain, type TreeNode } from "@/lib/engines/tree";
import { nextMemberId } from "@/lib/services/members";

describe("binary tree BFS placement", () => {
  it("first member goes LEFT of root", () => {
    const nodes: TreeNode[] = [{ id: "root", treeParentId: null, treeSide: null }];
    expect(findBfsPlacement(nodes, "root")).toEqual({ parentId: "root", side: "LEFT", level: 1 });
  });

  it("second member goes RIGHT of root", () => {
    const nodes: TreeNode[] = [
      { id: "root", treeParentId: null, treeSide: null },
      { id: "m1", treeParentId: "root", treeSide: "LEFT" },
    ];
    expect(findBfsPlacement(nodes, "root")).toEqual({ parentId: "root", side: "RIGHT", level: 1 });
  });

  it("third member fills the next level left-first", () => {
    const nodes: TreeNode[] = [
      { id: "root", treeParentId: null, treeSide: null },
      { id: "m1", treeParentId: "root", treeSide: "LEFT" },
      { id: "m2", treeParentId: "root", treeSide: "RIGHT" },
    ];
    expect(findBfsPlacement(nodes, "root")).toEqual({ parentId: "m1", side: "LEFT", level: 2 });
  });

  it("places 19 members in one complete left-to-right tree", () => {
    const nodes: TreeNode[] = [{ id: "m1", treeParentId: null, treeSide: null }];
    for (let i = 2; i <= 19; i++) {
      const placement = findBfsPlacement(nodes, "m1");
      nodes.push({ id: `m${i}`, treeParentId: placement.parentId, treeSide: placement.side });
    }
    expect(nodes.filter((node) => node.treeParentId).length).toBe(18);
    expect(nodes.find((node) => node.id === "m19")).toMatchObject({ treeParentId: "m9", treeSide: "RIGHT" });
  });
});

describe("auto-generated member IDs", () => {
  it("starts at SSV000001 and increments predictably", () => {
    expect(nextMemberId()).toBe("SSV000001");
    expect(nextMemberId("SSV000019")).toBe("SSV000020");
  });
});

describe("ancestor team-count increments", () => {
  it("increments the correct side up the whole chain", () => {
    const parentOf = new Map<string, { parentId: string | null; side: "LEFT" | "RIGHT" | null }>([
      ["m3", { parentId: "m1", side: "LEFT" }],
      ["m1", { parentId: "root", side: "LEFT" }],
      ["root", { parentId: null, side: null }],
    ]);
    const incs = ancestorIncrements({ newNodeParentId: "m3", newNodeSide: "RIGHT", parentOf });
    expect(incs).toEqual([
      { ancestorId: "m3", side: "RIGHT" },
      { ancestorId: "m1", side: "LEFT" },
      { ancestorId: "root", side: "LEFT" },
    ]);
  });
});

describe("sponsor chain (separate from tree)", () => {
  it("walks up sponsors to max depth", () => {
    const sponsorOf = new Map<string, string | null>([
      ["a", "b"],
      ["b", "c"],
      ["c", null],
    ]);
    expect(buildSponsorChain({ startSponsorId: "a", sponsorOf, maxDepth: 7 })).toEqual(["a", "b", "c"]);
  });
});
