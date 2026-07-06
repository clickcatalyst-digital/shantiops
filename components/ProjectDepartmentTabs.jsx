'use client';

// PM/admin all-departments view: an underline tab strip, one tab per department, each rendering
// that department's panel. Only mounted for PM (heads see their own stacked panels instead).
// No wrapper Card — the panels inside are Cards themselves; double-nesting looked heavy.
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { effectiveStatus } from '@/lib/sla';
import DepartmentPanel from './DepartmentPanel';

const ATTENTION = new Set(['overdue', 'blocked']);

export default function ProjectDepartmentTabs({ departments, ...panelProps }) {
  if (!departments?.length) return null;

  // Departments with an overdue/blocked milestone get a red dot on their tab.
  const hot = new Set(
    (panelProps.milestones || [])
      .filter(m => ATTENTION.has(effectiveStatus(m).code))
      .map(m => m.department)
  );

  return (
    // flex-col: the ui component's data-horizontal variant relies on a shadcn CSS import we don't use.
    <Tabs defaultValue={departments[0]} className="flex-col gap-4">
      <div className="overflow-x-auto border-b">
        <TabsList variant="line" className="w-max justify-start px-0">
          {departments.map(d => (
            <TabsTrigger key={d} value={d} className="flex-none gap-1.5 px-3 py-2">
              {d}
              {hot.has(d) && <span className="size-1.5 rounded-full bg-danger" aria-label="needs attention" />}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {departments.map(d => (
        <TabsContent key={d} value={d}>
          <DepartmentPanel department={d} {...panelProps} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
