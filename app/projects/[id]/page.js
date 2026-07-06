import { notFound, redirect } from 'next/navigation';
import { getProjectDetail, getProjectBom, getProjectPackingLists } from '@/lib/data';
import { getSessionUser, isCustomer, isPM, isHead, headDepartments, canAccessDepartment, roleHome } from '@/lib/auth';
import { DEPARTMENTS } from '@/lib/milestones';
import ProjectHeader from '@/components/ProjectHeader';
import TodayBand from '@/components/TodayBand';
import PortfolioDelayTimeline from '@/components/PortfolioDelayTimeline';
import DepartmentPanel from '@/components/DepartmentPanel';
import ProjectDepartmentTabs from '@/components/ProjectDepartmentTabs';

export const dynamic = 'force-dynamic';

export default async function ProjectDetail({ params }) {
  const user = getSessionUser();
  if (isCustomer(user)) redirect(roleHome(user)); // customers use the portal, not the ops view

  const data = await getProjectDetail(params.id);
  if (!data) notFound();
  const { project, milestones, health, blocker, progress, currentPhase, nextPhase, estDispatch } = data;
  const { bom, pending } = await getProjectBom(params.id);
  const packingLists = await getProjectPackingLists(params.id);

  const pm = isPM(user);
  const head = isHead(user);
  const myDepts = headDepartments(user);

  // Needs-attention is scoped to what this user acts on: a head sees only their department(s).
  const attentionMilestones = head ? milestones.filter(m => myDepts.includes(m.department)) : milestones;

  // Shared data every DepartmentPanel/tab needs.
  const panelData = {
    milestones, head, projectId: project.id, bom, pending, packingLists,
    canUploadBom: canAccessDepartment(user, 'Engineering'),
    canPack: canAccessDepartment(user, 'Dispatch'),
  };

  return (
    <main className="container flex flex-col gap-6 py-8">
      <ProjectHeader
        project={project} health={health} blocker={blocker} progress={progress}
        currentPhase={currentPhase} nextPhase={nextPhase} estDispatch={estDispatch}
      />
      {/* Same Milestone Tracker as the Executive dashboard, scoped to this one project — shown to
          every internal role (heads get the full chain as read-only context). */}
      <PortfolioDelayTimeline projects={[{ ...project, milestones }]} />
      <TodayBand milestones={attentionMilestones} />

      {pm ? (
        // PM/admin: the all-departments tabbed card.
        <ProjectDepartmentTabs departments={DEPARTMENTS} {...panelData} />
      ) : (
        // Functional head: their own department(s), stacked.
        myDepts.map(d => (
          <section key={d} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{d}</h2>
            <DepartmentPanel department={d} {...panelData} />
          </section>
        ))
      )}
    </main>
  );
}
