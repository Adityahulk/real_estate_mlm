import Link from "next/link";
import { Plus } from "lucide-react";

export type BinaryTreeNode = {
  id: string;
  memberId: string;
  fullName: string;
  rank: "NONE" | "BRONZE" | "SILVER" | "GOLD";
  leftTeamCount: number;
  rightTeamCount: number;
  left?: BinaryTreeNode;
  right?: BinaryTreeNode;
};

export function BinaryTree({ node, maxDepth = 7 }: { node?: BinaryTreeNode; maxDepth?: number }) {
  if (!node) {
    return <div className="py-8 text-center text-sm text-muted-foreground">No paid members are placed in the binary structure yet.</div>;
  }
  return (
    <div className="min-w-max px-4 py-5">
      <TreeBranch node={node} level={0} maxDepth={maxDepth} />
    </div>
  );
}

function TreeBranch({ node, level, maxDepth }: { node: BinaryTreeNode; level: number; maxDepth: number }) {
  const showChildren = level < maxDepth;
  return (
    <div className="flex flex-col items-center">
      <MemberNode node={node} />
      {showChildren && (
        <>
          <div className="h-5 border-l border-gray-300" />
          <div className="relative grid grid-cols-2 gap-8 pt-5">
            <div className="absolute left-1/4 right-1/4 top-0 border-t border-gray-300" />
            <ChildSlot node={node.left} parentId={node.memberId} side="Left" level={level + 1} maxDepth={maxDepth} />
            <ChildSlot node={node.right} parentId={node.memberId} side="Right" level={level + 1} maxDepth={maxDepth} />
          </div>
        </>
      )}
    </div>
  );
}

function ChildSlot({
  node,
  parentId,
  side,
  level,
  maxDepth,
}: {
  node?: BinaryTreeNode;
  parentId: string;
  side: "Left" | "Right";
  level: number;
  maxDepth: number;
}) {
  return (
    <div className="relative flex min-w-36 justify-center before:absolute before:-top-5 before:h-5 before:border-l before:border-gray-300">
      {node ? <TreeBranch node={node} level={level} maxDepth={maxDepth} /> : <EmptyNode parentId={parentId} side={side} />}
    </div>
  );
}

function MemberNode({ node }: { node: BinaryTreeNode }) {
  const rankClass =
    node.rank === "GOLD"
      ? "border-amber-400 bg-amber-50"
      : node.rank === "SILVER"
        ? "border-gray-400 bg-gray-50"
        : node.rank === "BRONZE"
          ? "border-orange-400 bg-orange-50"
          : "border-gray-300 bg-white";
  return (
    <div className={`min-w-36 rounded-md border px-3 py-2 text-center shadow-sm ${rankClass}`}>
      <div className="text-sm font-bold">{node.memberId}</div>
      <div className="max-w-36 truncate text-xs text-muted-foreground">{node.fullName}</div>
      <div className="mt-1 text-[10px] uppercase text-muted-foreground">{node.rank === "NONE" ? "Member" : node.rank}</div>
      <div className="text-[10px] text-muted-foreground">L {node.leftTeamCount} · R {node.rightTeamCount}</div>
    </div>
  );
}

function EmptyNode({ parentId, side }: { parentId: string; side: "Left" | "Right" }) {
  return (
    <Link
      href={`/register?ref=${encodeURIComponent(parentId)}`}
      className="flex min-w-36 flex-col items-center rounded-md border border-dashed border-gray-300 bg-white px-3 py-3 text-xs text-muted-foreground hover:border-brand hover:text-brand"
      title={`Refer a member for the ${side.toLowerCase()} leg`}
    >
      <Plus className="mb-1 h-4 w-4" />
      Empty {side}
    </Link>
  );
}
