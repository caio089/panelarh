import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { DataProvider } from '@/contexts/DataContext'
import { AdminShell } from '@/components/AdminShell'
import { CareersPage } from '@/pages/CareersPage'
import { JobDetailPage } from '@/pages/JobDetailPage'
import { AuthPage } from '@/pages/AuthPage'
import { AdminLoginPage } from '@/pages/AdminLoginPage'
import { ProfileOnboardingPage } from '@/pages/ProfileOnboardingPage'
import { CandidateAreaPage } from '@/pages/CandidateAreaPage'
import { AdminDashboardPage } from '@/pages/AdminDashboardPage'
import { AdminBoardPage } from '@/pages/AdminBoardPage'
import { AdminVagaPage } from '@/pages/AdminVagaPage'
import { AdminVagasListPage, AdminCandidatesPage } from '@/pages/AdminListsPage'
import { AdminUnitsPage } from '@/pages/AdminUnitsPage'
import { AdminSelectionPage } from '@/pages/AdminSelectionPage'
import { CandidateMessagesPage } from '@/pages/CandidateMessagesPage'

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <BrowserRouter>
          <Routes>
            {/* Público — mesmo link para todo mundo */}
            <Route path="/" element={<CareersPage />} />
            <Route path="/vagas/:id" element={<JobDetailPage />} />

            {/* Candidato */}
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/candidato" element={<CandidateAreaPage />} />
            <Route path="/perfil" element={<ProfileOnboardingPage />} />
            <Route path="/mensagens" element={<CandidateMessagesPage />} />

            {/* Admin — link próprio */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminShell />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="quadro" element={<AdminBoardPage />} />
              <Route path="unidades" element={<AdminUnitsPage />} />
              <Route path="vagas" element={<AdminVagasListPage />} />
              <Route path="vagas/:id" element={<AdminVagaPage />} />
              <Route path="candidatos" element={<AdminCandidatesPage />} />
              <Route path="selecao" element={<AdminSelectionPage />} />
              <Route path="mensagens" element={<Navigate to="/admin/selecao" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  )
}
