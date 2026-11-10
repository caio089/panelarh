import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { DataProvider } from '@/contexts/DataContext'
import { AdminShell } from '@/components/AdminShell'
import { CareersPage } from '@/pages/CareersPage'
import { JobDetailPage } from '@/pages/JobDetailPage'
import { PublicApplyPage } from '@/pages/PublicApplyPage'
import { AdminLoginPage } from '@/pages/AdminLoginPage'
import { AdminDashboardPage } from '@/pages/AdminDashboardPage'
import { AdminBoardPage } from '@/pages/AdminBoardPage'
import { AdminVagaPage } from '@/pages/AdminVagaPage'
import { AdminVagasListPage, AdminCandidatesPage } from '@/pages/AdminListsPage'
import { AdminUnitsPage } from '@/pages/AdminUnitsPage'
import { AdminSelectionPage } from '@/pages/AdminSelectionPage'
import { RhAccessPage } from '@/pages/RhAccessPage'
import { OwnerDashboardPage } from '@/pages/OwnerDashboardPage'
import { ManagersPage } from '@/pages/ManagersPage'
import { UnitLayout } from '@/pages/unit/UnitLayout'
import { UnitOverviewTab } from '@/pages/unit/UnitOverviewTab'
import { UnitCollaboratorsTab } from '@/pages/unit/UnitCollaboratorsTab'
import { UnitScheduleTab } from '@/pages/unit/UnitScheduleTab'
import { GestaoStoreProvider } from '@/features/gestao/GestaoStoreProvider'
import { TvCompetitionPage } from '@/pages/TvCompetitionPage'
import { PeopleOpsPage } from '@/pages/PeopleOpsPage'
import { CollaboratorsPage } from '@/pages/CollaboratorsPage'

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <GestaoStoreProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<CareersPage />} />
              <Route path="/vagas/:id" element={<JobDetailPage />} />
              <Route path="/vagas/:id/candidatar" element={<PublicApplyPage />} />
              <Route path="/tv/competicao" element={<TvCompetitionPage />} />
              <Route path="/tv/:unit" element={<TvCompetitionPage />} />
              <Route path="/dirceu" element={<TvCompetitionPage />} />
              <Route path="/promorar" element={<TvCompetitionPage />} />
              <Route path="/mocambinho" element={<TvCompetitionPage />} />

              {/* Legado candidato → site público */}
              <Route path="/auth" element={<Navigate to="/" replace />} />
              <Route path="/candidato" element={<Navigate to="/" replace />} />
              <Route path="/perfil" element={<Navigate to="/" replace />} />
              <Route path="/mensagens" element={<Navigate to="/" replace />} />

              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin" element={<AdminShell />}>
                <Route index element={<OwnerDashboardPage />} />
                <Route path="unidade/:unitId" element={<UnitLayout />}>
                  <Route index element={<UnitOverviewTab />} />
                  <Route path="colaboradores" element={<UnitCollaboratorsTab />} />
                  <Route path="escala" element={<UnitScheduleTab />} />
                </Route>
                <Route path="ponto" element={<Navigate to="/admin" replace />} />
                <Route path="gerentes" element={<ManagersPage />} />
                <Route path="rh" element={<AdminDashboardPage />} />
                <Route path="pessoas" element={<PeopleOpsPage />} />
                <Route path="colaboradores" element={<CollaboratorsPage />} />
                <Route path="quadro" element={<AdminBoardPage />} />
                <Route path="unidades" element={<AdminUnitsPage />} />
                <Route path="vagas" element={<AdminVagasListPage />} />
                <Route path="vagas/:id" element={<AdminVagaPage />} />
                <Route path="candidatos" element={<AdminCandidatesPage />} />
                <Route path="selecao" element={<AdminSelectionPage />} />
                <Route path="acesso" element={<RhAccessPage />} />
                <Route path="mensagens" element={<Navigate to="/admin/selecao" replace />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </GestaoStoreProvider>
      </DataProvider>
    </AuthProvider>
  )
}
