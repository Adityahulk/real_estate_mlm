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

export function BinaryTree({
  node,
  maxDepth = 7,
  nodeHref,
}: {
  node?: BinaryTreeNode;
  maxDepth?: number;
  nodeHref?: (memberId: string) => string;
}) {
  if (!node) {
    return <div className="py-8 text-center text-sm text-muted-foreground">No paid members are placed in the binary structure yet.</div>;
  }
  return (
    <div className="mx-auto w-max px-1 py-2 [zoom:.32] sm:[zoom:.55] lg:[zoom:.72] xl:[zoom:.8]">
      <TreeBranch node={node} level={0} maxDepth={maxDepth} nodeHref={nodeHref} />
    </div>
  );
}

function TreeBranch({
  node,
  level,
  maxDepth,
  nodeHref,
}: {
  node: BinaryTreeNode;
  level: number;
  maxDepth: number;
  nodeHref?: (memberId: string) => string;
}) {
  const showChildren = level < maxDepth;
  return (
    <div className="flex flex-col items-center">
      <MemberNode node={node} href={nodeHref?.(node.memberId)} />
      {showChildren && (
        <>
          <div className="h-3 border-l border-gray-300" />
          <div className="relative grid grid-cols-2 gap-2 pt-3">
            <div className="absolute left-1/4 right-1/4 top-0 border-t border-gray-300" />
            <ChildSlot node={node.left} parentId={node.memberId} side="Left" level={level + 1} maxDepth={maxDepth} nodeHref={nodeHref} />
            <ChildSlot node={node.right} parentId={node.memberId} side="Right" level={level + 1} maxDepth={maxDepth} nodeHref={nodeHref} />
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
  nodeHref,
}: {
  node?: BinaryTreeNode;
  parentId: string;
  side: "Left" | "Right";
  level: number;
  maxDepth: number;
  nodeHref?: (memberId: string) => string;
}) {
  return (
    <div className="relative flex min-w-[4.75rem] justify-center before:absolute before:-top-3 before:h-3 before:border-l before:border-gray-300">
      {node ? <TreeBranch node={node} level={level} maxDepth={maxDepth} nodeHref={nodeHref} /> : <EmptyNode parentId={parentId} side={side} />}
    </div>
  );
}

function MemberNode({ node, href }: { node: BinaryTreeNode; href?: string }) {
  const rankClass =
    node.rank === "GOLD"
      ? "border-amber-400 bg-amber-50"
      : node.rank === "SILVER"
        ? "border-gray-400 bg-gray-50"
        : node.rank === "BRONZE"
          ? "border-orange-400 bg-orange-50"
          : "border-gray-300 bg-white";
  const content = (
    <>
      <div className="truncate text-[10px] font-bold">{node.memberId}</div>
      <div className="max-w-[4.5rem] truncate text-[9px] text-muted-foreground">{node.fullName}</div>
      <div className="text-[8px] text-muted-foreground">L{node.leftTeamCount} · R{node.rightTeamCount}</div>
    </>
  );
  const classes = `block w-[4.75rem] rounded border px-1 py-1 text-center shadow-sm ${rankClass}`;
  return href ? <Link href={href} className={`${classes} hover:border-brand`} title={`Open ${node.fullName}'s full downline`}>{content}</Link> : <div className={classes}>{content}</div>;
}

function EmptyNode({ parentId, side }: { parentId: string; side: "Left" | "Right" }) {
  return (
    <Link
      href={`/register?ref=${encodeURIComponent(parentId)}`}
      className="flex w-[4.75rem] flex-col items-center rounded border border-dashed border-gray-300 bg-white px-1 py-1 text-[8px] text-muted-foreground hover:border-brand hover:text-brand"
      title={`Refer a member for the ${side.toLowerCase()} leg`}
    >
      <Plus className="h-3 w-3" />
      Empty {side}
    </Link>
  );
}
