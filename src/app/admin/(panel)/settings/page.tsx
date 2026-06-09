import { getAllSettings, SETTING_META, type SettingKey } from "@/lib/settings";
import { updateSettingsAction } from "@/server/admin-actions";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select } from "@/components/ui";

export default async function SettingsPage() {
  const settings = await getAllSettings();
  const keys = Object.keys(SETTING_META) as SettingKey[];

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Settings</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Every business figure lives here — change a value and the engines pick it up. New EMI schedules use the updated numbers. Project rules, charges, and system conditions may change as per policy.
        </p>
      </CardHeader>
      <CardContent>
        <form action={updateSettingsAction}>
          <div className="grid gap-3 sm:grid-cols-2">
            {keys.map((k) => {
              const meta = SETTING_META[k];
              return (
                <div key={k}>
                  <label className="mb-1 block text-sm font-medium">{meta.label}</label>
                  {meta.type === "BOOLEAN" ? (
                    <Select name={k} defaultValue={settings[k]}>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </Select>
                  ) : meta.type === "NUMBER" ? (
                    <Input name={k} defaultValue={settings[k]} inputMode="numeric" />
                  ) : (
                    <Input name={k} defaultValue={settings[k]} placeholder="UPI payment link or company payment text" />
                  )}
                </div>
              );
            })}
          </div>
          <Button type="submit" className="mt-4">Save Settings</Button>
        </form>
      </CardContent>
    </Card>
  );
}
