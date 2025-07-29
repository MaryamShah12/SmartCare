import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AdminDashboard from './components/AdminDashboard';
import DoctorDashboard from './components/DoctorDashboard';
import PatientDashboard from './components/PatientDashboard';
import socketService from './services/socketService'; 


interface ProtectedRouteProps {
  allowedRole: string;
  children: React.ReactElement;
}
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRole, children }) => {
  const role = localStorage.getItem('role');
  return role === allowedRole ? children : <Navigate to="/" replace />;
};


const App: React.FC = () => {
  useEffect(() => {
    
    const role = localStorage.getItem('role');
    const token = role ? localStorage.getItem(`${role}_token`) : null;

    
    if (role && token) {
      socketService.connect(token);
    }

    
    return () => {
      socketService.disconnect();
    };
  }, []); 

  return (
    <Router>
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
      </Routes>
    </Router>
  );
};

export default App;