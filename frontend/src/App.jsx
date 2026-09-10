import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Rides from './pages/Rides';
import CreateRide from './pages/CreateRide';
import RideDetail from './pages/RideDetail';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/rides" element={<ProtectedRoute><Rides /></ProtectedRoute>} />
          <Route path="/rides/new" element={<ProtectedRoute><CreateRide /></ProtectedRoute>} />
          <Route path="/rides/:id" element={<ProtectedRoute><RideDetail /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}
