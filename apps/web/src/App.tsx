import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useOperatorSession } from './session/OperatorSessionContext';
import { SessionPage } from './pages/SessionPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProposalsPage } from './pages/ProposalsPage';
import { ProposalDetailPage } from './pages/ProposalDetailPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { ApprovalDetailPage } from './pages/ApprovalDetailPage';
import { JournalEntriesPage } from './pages/JournalEntriesPage';
import { JournalEntryDetailPage } from './pages/JournalEntryDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { ScheduleRunDetailPage } from './pages/ScheduleRunDetailPage';
import { AuditHomePage } from './pages/AuditHomePage';
import { AuditTimelinePage } from './pages/AuditTimelinePage';

function RequireSession({ children }: { children: ReactNode }) {
  const { session } = useOperatorSession();
  const location = useLocation();

  if (session === null) {
    return <Navigate to="/session" replace state={{ redirectTo: location.pathname }} />;
  }

  return <>{children}</>;
}

export function App() {
  const { session } = useOperatorSession();
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        path="/session"
        element={
          <SessionPage
            onSaved={() => {
              navigate('/dashboard');
            }}
          />
        }
      />
      <Route
        element={
          <RequireSession>
            <AppShell />
          </RequireSession>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/proposals" element={<ProposalsPage />} />
        <Route path="/proposals/:proposalId" element={<ProposalDetailPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/approvals/:approvalId" element={<ApprovalDetailPage />} />
        <Route path="/ledger/entries" element={<JournalEntriesPage />} />
        <Route path="/ledger/entries/:entryId" element={<JournalEntryDetailPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/schedules" element={<SchedulesPage />} />
        <Route path="/schedules/runs/:runId" element={<ScheduleRunDetailPage />} />
        <Route path="/audit" element={<AuditHomePage />} />
        <Route path="/audit/:entityType/:entityId" element={<AuditTimelinePage />} />
      </Route>
    </Routes>
  );
}
