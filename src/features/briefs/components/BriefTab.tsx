import React, { useState, useEffect } from 'react';
import { Section } from '@/shared/ui/Section';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input, Textarea, CurrencyInput } from '@/shared/ui/Input';
import { useBrief } from '@/features/briefs';
import type { ProjectWithClient } from '@/shared/types';
import { Calendar, User, FileText, IndianRupee } from 'lucide-react';

interface BriefTabProps {
  project: ProjectWithClient;
  workspaceId: string;
  profileId: string;
  brief: any | null;
  addToast: (type: 'success' | 'info' | 'warning' | 'error', message: string, desc?: string) => void;
}

export const BriefTab: React.FC<BriefTabProps> = ({
  project,
  workspaceId,
  profileId,
  brief: initialBrief,
  addToast,
}) => {
  const { brief: liveBrief, saveBrief, isSaving } = useBrief(workspaceId, project.id, profileId);

  const [description, setDescription] = useState('');
  const [goals, setGoals] = useState('');
  const [deadline, setDeadline] = useState('');
  const [budget, setBudget] = useState('0');
  const [references, setReferences] = useState('');

  useEffect(() => {
    const b = liveBrief || initialBrief;
    if (b) {
      setDescription(b.description || '');
      setGoals(b.goals || '');
      setDeadline(b.deadline || project.timeline_end || '');
      setBudget(String(b.budget || project.budget || '0'));
      setReferences(b.references || '');
    } else {
      setDeadline(project.timeline_end || '');
      setBudget(String(project.budget || '0'));
    }
  }, [liveBrief, initialBrief, project]);

  const handleSaveBrief = async () => {
    if (!description.trim() || !goals.trim()) {
      addToast('warning', 'Validation Warning', 'Description and goals are required fields.');
      return;
    }

    try {
      const payload: {
        description: string;
        goals: string;
        deadline?: string;
        budget?: number;
        references?: string;
      } = { description, goals };

      if (deadline) payload.deadline = deadline;
      const parsedBudget = parseFloat(budget);
      if (!isNaN(parsedBudget) && parsedBudget > 0) payload.budget = parsedBudget;
      if (references) payload.references = references;

      await saveBrief(payload);
      addToast('success', 'Brief Saved Successfully', 'The project brief details have been updated.');
    } catch (e: any) {
      addToast('error', 'Failed to save brief', e.message);
    }
  };

  const briefData = liveBrief || initialBrief;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
      {/* Read-only metadata summary card */}
      <div className="space-y-4">
        <Section title="Project Metadata" description="Current active reference limits">
          <div className="border border-border bg-card rounded-lg p-4.5 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <IndianRupee className="h-4.5 w-4.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Budget</span>
                <p className="text-small font-semibold text-foreground mt-0.5 m-0">₹{project.budget?.toLocaleString('en-IN') || 0}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-4.5 w-4.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deadline</span>
                <p className="text-small font-semibold text-foreground mt-0.5 m-0">
                  {project.timeline_end
                    ? new Date(project.timeline_end).toLocaleDateString('en-IN')
                    : 'No deadline specified'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-4.5 w-4.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Linked Client</span>
                <p className="text-small font-semibold text-foreground mt-0.5 m-0">
                  {project.clients?.name || 'Unknown Client'}
                </p>
              </div>
            </div>

            {briefData?.submitted_at && (
              <div className="flex items-start gap-3">
                <FileText className="h-4.5 w-4.5 text-muted-foreground/60 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Last Submitted</span>
                  <p className="text-small font-semibold text-foreground mt-0.5 m-0">
                    {new Date(briefData.submitted_at).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Brief Form Workspace */}
      <div className="lg:col-span-2">
        <Card className="p-5.5 space-y-4">
          <div className="border-b border-border-subtle pb-3.5">
            <h3 className="text-small font-bold text-foreground m-0">
              {briefData ? 'Edit Project Brief Outline' : 'Outline Project Brief'}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1 m-0">
              The project brief is shared passwordless with the client. Establish specifications and alignments.
            </p>
          </div>

          <div className="space-y-4">
            <Textarea
              label="Project Description & Scope"
              placeholder="Describe deliverables, features, design files required, and constraints..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
            />
            <Textarea
              label="Key Objectives & Goals"
              placeholder="What targets does the client expect to achieve with this project?"
              value={goals}
              onChange={e => setGoals(e.target.value)}
              rows={3}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Timeline Date Limit"
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
              />
              <CurrencyInput
                label="Project Value (INR)"
                value={budget}
                onChange={e => setBudget(e.target.value)}
              />
            </div>
            <Textarea
              label="References & Inspo Links"
              placeholder="Competitor URLs, brand folders, moodboard pins..."
              value={references}
              onChange={e => setReferences(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4 mt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveBrief}
              loading={isSaving}
            >
              {briefData ? 'Update Brief' : 'Save Brief'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default BriefTab;