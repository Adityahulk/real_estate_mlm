import { currentMember, downlineTree } from "@/lib/services/queries";
import { Card, CardContent, CardHeader, CardTitle, Stat } from "@/components/ui";
import { BinaryTree } from "@/components/binary-tree";

export default async function TreePage() {
  const me = await currentMember();
  const tree = me.plotId ? await downlineTree(me.id, 7) : undefined;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Left Team" value={me.leftTeamCount} />
        <Stat label="Right Team" value={me.rightTeamCount} />
        <Stat label="Direct Referrals" value={me.directReferralCount} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>My Binary Team</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Paid members expand downward through Left and Right legs. Empty positions show an add-referral shortcut.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="flex min-w-max justify-center py-2">
            <BinaryTree node={tree} maxDepth={7} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
