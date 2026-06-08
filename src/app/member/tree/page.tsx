import { currentMember, downlineTree } from "@/lib/services/queries";
import { Card, CardContent, CardHeader, CardTitle, Stat } from "@/components/ui";

type Node = Awaited<ReturnType<typeof downlineTree>>;

function TreeNode({ node }: { node: Node }) {
  if (!node) return <div className="rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">empty</div>;
  const color =
    node.rank === "GOLD"
      ? "border-warning bg-warning/10"
      : node.rank === "SILVER"
        ? "border-success bg-success/10"
        : node.rank === "BRONZE"
          ? "border-brand bg-brand/10"
          : node.isActive
            ? "border-success/40 bg-success/5"
            : "border-border";
  return (
    <div className="flex flex-col items-center">
      <div className={`rounded-xl border px-3 py-2 text-center ${color}`}>
        <div className="text-sm font-semibold">{node.memberId}</div>
        <div className="max-w-[8rem] truncate text-xs text-muted-foreground">{node.fullName}</div>
        {node.rank !== "NONE" && <div className="text-[10px] font-semibold text-brand">{node.rank}</div>}
        <div className="text-[10px] text-muted-foreground">L {node.leftTeamCount} · R {node.rightTeamCount}</div>
      </div>
      {(node.left || node.right) && (
        <div className="mt-3 flex gap-4">
          <TreeNode node={node.left as Node} />
          <TreeNode node={node.right as Node} />
        </div>
      )}
    </div>
  );
}

export default async function TreePage() {
  const me = await currentMember();
  const tree = await downlineTree(me.id, 3);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Left Team" value={me.leftTeamCount} />
        <Stat label="Right Team" value={me.rightTeamCount} />
        <Stat label="Direct Referrals" value={me.directReferralCount} />
      </div>
      <Card>
        <CardHeader><CardTitle>My Binary Team (3 levels)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="flex min-w-max justify-center py-2">
            <TreeNode node={tree} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
