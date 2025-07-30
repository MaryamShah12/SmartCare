import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AdminDashboard from './components/AdminDashboard';
import DoctorDashboard from './components/DoctorDashboard';
import PatientDashboard from './components/PatientDashboard';
import DoctorProfile from './components/DoctorProfile';
import socketService from './services/socketService';


interface ProtectedRouteProps {
  allowedRole: string;
  children: React.ReactElement;
}
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRole, children }) => {
  const role = localStorage.getItem('role');
  return role === allowedRole ? children : <Navigate to="/" replace />;
};



const AppContent: React.FC = () => {
  const location = useLocation(); 

  useEffect(() => {
    const role = localStorage.getItem('role');
    const token = role ? localStorage.getItem(`${role}_token`) : null;

    if (role && token && !socketService.isConnected()) { 
      console.log('🔌 Connecting WebSocket due to location change to:', location.pathname);
      socketService.connect(token);
    }

    return () => {
      
    };
  }, [location]); 

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor"
        element={
          <ProtectedRoute allowedRole="doctor">
            <DoctorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient"
        element={
          <ProtectedRoute allowedRole="patient">
            <PatientDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/doctor-profile/:doctorId" element={<DoctorProfile />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;