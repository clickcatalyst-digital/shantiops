'use client';

// PM/admin all-departments view: one tab per department, each rendering that department's panel.
// Only mounted for PM (§ user requirement — heads see their own stacked panels instead).
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import DepartmentPanel from './DepartmentPanel';

export default function ProjectDepartmentTabs({ departments, ...panelProps }) {
  if (!departments?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Departments</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={departments[0]} className="gap-4">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            {departments.map(d => (
              <TabsTrigger key={d} value={d}>{d}</TabsTrigger>
            ))}
          </TabsList>
          {departments.map(d => (
            <TabsContent key={d} value={d}>
              <DepartmentPanel department={d} {...panelProps} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
