import { notFound, redirect } from 'next/navigation';
import { getProjectDetail, getProjectBom } from '@/lib/data';
import { getSessionUser, isCustomer, isPM, isHead, headDepartments, canAccessDepartment, roleHome } from '@/lib/auth';
import ProjectHeader from '@/components/ProjectHeader';
import TodayBand from '@/components/TodayBand';
import DelayChain from '@/components/DelayChain';
import MilestoneBoard from '@/components/MilestoneBoard';
import BomPanel from '@/components/BomPanel';
import SwimlaneGantt from '@/components/SwimlaneGantt';

export const dynamic = 'force-dynamic';

export default async function ProjectDetail({ params }) {
  const user = getSessionUser();
  if (isCustomer(user)) redirect(roleHome(user)); // customers use the portal, not the ops view

  const data = await getProjectDetail(params.id);
  if (!data) notFound();
  const { project, milestones, health, blocker, progress, currentPhase, nextPhase, estDispatch } = data;
  const { bom, pending } = await getProjectBom(params.id);

  // A functional head only acts on milestones in their own department(s) (§1). The full-project
  // delay chain + swimlane stay visible for context (read-only); the editable board is scoped.
  const head = isHead(user);
  const boardMilestones = head ? milestones.filter(m => headDepartments(user).includes(m.department)) : milestones;

  return (
    <main className="container flex flex-col gap-6 py-8">
      <ProjectHeader
        project={project} health={health} blocker={blocker} progress={progress}
        currentPhase={currentPhase} nextPhase={nextPhase} estDispatch={estDispatch}
      />
      <TodayBand milestones={milestones} />
      <DelayChain milestones={milestones} />
      {/* Wide screens: milestones (2/3) beside the BOM rail (1/3). Stacks on smaller screens. */}
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MilestoneBoard milestones={boardMilestones} head={head} />
        </div>
        <div className="xl:col-span-1">
          <BomPanel projectId={project.id} bom={bom} pending={pending}
            canUpload={isPM(user)} canPack={canAccessDepartment(user, 'Dispatch')} />
        </div>
      </div>
      <SwimlaneGantt milestones={milestones} />
    </main>
  );
}
