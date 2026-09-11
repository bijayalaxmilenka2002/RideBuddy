import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Rides from './pages/Rides';
import MyRides from './pages/MyRides';
import CreateRide from './pages/CreateRide';
import RideDetail from './pages/RideDetail';
import NotFound from './pages/NotFound';

export default function App() {
  const { pathname } = useLocation();
  // The landing hero sits under the fixed transparent header and supplies its
  // own top spacing; every other page needs the header's height reserved.
  const isLanding = pathname === '/';

  return (
    <>
      <Navbar />
      <main style={isLanding ? undefined : { paddingTop: 'var(--header-height)' }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          {/* The published Rocket site links here; keep those links working. */}
          <Route path="/sign-up-login-screen" element={<Navigate to="/signup" replace />} />
          <Route path="/rides" element={<ProtectedRoute><Rides /></ProtectedRoute>} />
          <Route path="/rides/mine" element={<ProtectedRoute><MyRides /></ProtectedRoute>} />
          <Route path="/rides/new" element={<ProtectedRoute><CreateRide /></ProtectedRoute>} />
          <Route path="/rides/:id" element={<ProtectedRoute><RideDetail /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}
