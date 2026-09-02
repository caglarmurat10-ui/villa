import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { useOnline } from "./lib/useOnline";
import { BottomNav } from "./components/BottomNav";
import { LoginScreen } from "./screens/LoginScreen";
import { LockScreen } from "./screens/LockScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { ReservationsScreen } from "./screens/ReservationsScreen";
import { ReservationDetailScreen } from "./screens/ReservationDetailScreen";
import { NewReservationScreen } from "./screens/NewReservationScreen";
import { EditReservationScreen } from "./screens/EditReservationScreen";
import { CalendarScreen } from "./screens/CalendarScreen";
import { MessagesScreen } from "./screens/MessagesScreen";
import { SocialScreen } from "./screens/SocialScreen";
import { VillasScreen } from "./screens/VillasScreen";
import { GoogleVisibilityScreen } from "./screens/GoogleVisibilityScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { MoreScreen } from "./screens/MoreScreen";

function AuthedShell() {
  const online = useOnline();
  return (
    <div className="app-shell">
      {!online && <div className="offline-banner">Çevrimdışı — gösterilen veri güncel olmayabilir</div>}
      <Routes>
        <Route path="/" element={<DashboardScreen />} />
        <Route path="/rezervasyonlar" element={<ReservationsScreen />} />
        <Route path="/rezervasyonlar/yeni" element={<NewReservationScreen />} />
        <Route path="/rezervasyonlar/:id" element={<ReservationDetailScreen />} />
        <Route path="/rezervasyonlar/:id/duzenle" element={<EditReservationScreen />} />
        <Route path="/takvim" element={<CalendarScreen />} />
        <Route path="/mesajlar" element={<MessagesScreen />} />
        <Route path="/sosyal" element={<SocialScreen />} />
        <Route path="/daha-fazla" element={<MoreScreen />} />
        <Route path="/villalar" element={<VillasScreen />} />
        <Route path="/google-gorunurluk" element={<GoogleVisibilityScreen />} />
        <Route path="/ayarlar" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

function Root() {
  const { status } = useAuth();
  if (status === "loading") return <div className="app-shell" />;
  if (status === "signedOut") return <LoginScreen />;
  if (status === "locked") return <LockScreen />;
  return <AuthedShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Root />
      </HashRouter>
    </AuthProvider>
  );
}
