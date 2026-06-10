import { currentMember, downlineTree } from "@/lib/services/queries";
import { Card, CardContent, CardHeader, CardTitle, Stat } from "@/components/ui";
import { BinaryTree, type BinaryTreeNode } from "@/components/binary-tree";

export default async function TreePage({ searchParams }: { searchParams: Promise<{ root?: string }> }) {
  const me = await currentMember();
  const { root: requestedRoot } = await searchParams;
  const fullTree = me.plotId ? await downlineTree(me.id, 7) : undefined;
  const tree = requestedRoot ? findNode(fullTree, requestedRoot) : fullTree;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Left Team" value={me.leftTeamCount} />
        <Stat label="Right Team" value={me.rightTeamCount} />
        <Stat label="Direct Referrals" value={me.directReferralCount} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{tree?.memberId ?? me.memberId} Binary Team</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Click any member to open their complete downline. Members fill left to right, top to bottom.</p>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <div className="flex justify-center py-2">
            <BinaryTree node={tree} maxDepth={7} nodeHref={(memberId) => `/member/tree?root=${encodeURIComponent(memberId)}`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function findNode(node: BinaryTreeNode | undefined, memberId: string): BinaryTreeNode | undefined {
  if (!node) return undefined;
  if (node.memberId.toLowerCase() === memberId.toLowerCase()) return node;
  return findNode(node.left, memberId) ?? findNode(node.right, memberId);
}
