// One department's slice of a project: its milestones (edit drawer scoped to role) + the department's
// special panel — Engineering → Bill of Materials, Dispatch → Packing. Departments with only
// milestones render just the board.
import MilestoneBoard from './MilestoneBoard';
import BomPanel from './BomPanel';
import PackingPanel from './PackingPanel';

export default function DepartmentPanel({
  department, milestones, head = false,
  projectId, bom = [], pending = [], packingLists = [], canUploadBom = false, canPack = false,
}) {
  const deptMs = milestones.filter(m => m.department === department);

  return (
    <div className="flex flex-col gap-6">
      {department === 'Engineering' && (
        <BomPanel projectId={projectId} bom={bom} pending={pending} canUpload={canUploadBom} />
      )}

      {deptMs.length > 0 && <MilestoneBoard milestones={deptMs} head={head} />}

      {department === 'Dispatch' && (
        <PackingPanel projectId={projectId} pending={pending} packingLists={packingLists} canPack={canPack} />
      )}

      {deptMs.length === 0 && department !== 'Engineering' && department !== 'Dispatch' && (
        <p className="text-sm text-muted-foreground">No {department} milestones on this project.</p>
      )}
    </div>
  );
}
