import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Doctor {
  id: number;
  user_id: number;
  name: string;
  email: string;
  specialization: string;
  documents: string[];
  photo: string | null;
}

const AdminDashboard: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const navigate = useNavigate();

  const fetchPendingDoctors = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://127.0.0.1:8000/api/auth/admin/pending-doctors', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (response.ok) {
        setDoctors(result.doctors);
      } else {
        setError(result.error || 'Failed to fetch pending doctors');
      }
    } catch (err) {
      setError('Error: Could not connect to the server');
      console.error('Fetch error:', err);
    }
  };

  const handleApprove = async (doctorId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://127.0.0.1:8000/api/auth/admin/approve-doctor/${doctorId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (response.ok) {
        alert(result.message);
        setDoctors(doctors.filter((doctor) => doctor.id !== doctorId));
        setSelectedDoctor(null);
      } else {
        alert(result.error || 'Failed to approve doctor');
      }
    } catch (err) {
      alert('Error: Could not connect to the server');
      console.error('Approve error:', err);
    }
  };

  const handleDecline = async (doctorId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://127.0.0.1:8000/api/auth/admin/decline-doctor/${doctorId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (response.ok) {
        alert(result.message);
        setDoctors(doctors.filter((doctor) => doctor.id !== doctorId));
        setSelectedDoctor(null);
      } else {
        alert(result.error || 'Failed to decline doctor');
      }
    } catch (err) {
      alert('Error: Could not connect to the server');
      console.error('Decline error:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/');
  };

  const openDoctorDetails = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
  };

  const closeDoctorDetails = () => {
    setSelectedDoctor(null);
  };

  useEffect(() => {
    fetchPendingDoctors();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6">
      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
        >
          Logout
        </button>
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <div className="w-full max-w-4xl bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-4">Pending Doctor Requests</h2>
        {doctors.length === 0 ? (
          <p className="text-gray-600">No pending doctor requests.</p>
        ) : (
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-200">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Specialization</th>
                <th className="px-4 py-2">Documents</th>
                <th className="px-4 py-2">Photo</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((doctor) => (
                <tr key={doctor.id} className="border-t">
                  <td className="px-4 py-2">
                    <button
                      onClick={() => openDoctorDetails(doctor)}
                      className="text-blue-600 hover:underline"
                    >
                      {doctor.name}
                    </button>
                  </td>
                  <td className="px-4 py-2">{doctor.email}</td>
                  <td className="px-4 py-2">{doctor.specialization}</td>
                  <td className="px-4 py-2">
                    {doctor.documents.length > 0 ? (
                      <ul>
                        {doctor.documents.map((doc, index) => (
                          <li key={index}>
                            <a
                              href={`http://127.0.0.1:8000/api/auth/uploads/${doc}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {doc}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      'None'
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {doctor.photo ? (
                      <a
                        href={`http://127.0.0.1:8000/api/auth/uploads/${doctor.photo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View Photo
                      </a>
                    ) : (
                      'None'
                    )}
                  </td>
                  <td className="px-4 py-2 flex space-x-2">
                    <button
                      onClick={() => handleApprove(doctor.id)}
                      className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecline(doctor.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700"
                    >
                      Decline
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedDoctor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-2xl font-semibold mb-4">Doctor Details</h2>
            <div className="space-y-2">
              <p><strong>Name:</strong> {selectedDoctor.name}</p>
              <p><strong>Email:</strong> {selectedDoctor.email}</p>
              <p><strong>Specialization:</strong> {selectedDoctor.specialization}</p>
              <p><strong>Documents:</strong></p>
              {selectedDoctor.documents.length > 0 ? (
                <ul className="list-disc pl-5">
                  {selectedDoctor.documents.map((doc, index) => (
                    <li key={index}>
                      <a
                        href={`http://127.0.0.1:8000/api/auth/uploads/${doc}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {doc}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>None</p>
              )}
              <p><strong>Profile Photo:</strong></p>
              {selectedDoctor.photo ? (
                <div>
                  <img
                    src={`http://127.0.0.1:8000/api/auth/uploads/${selectedDoctor.photo}`}
                    alt="Profile"
                    className="w-32 h-32 object-cover rounded-md mb-2"
                  />
                  <a
                    href={`http://127.0.0.1:8000/api/auth/uploads/${selectedDoctor.photo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Download Photo
                  </a>
                </div>
              ) : (
                <p>None</p>
              )}
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => handleApprove(selectedDoctor.id)}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Approve
              </button>
              <button
                onClick={() => handleDecline(selectedDoctor.id)}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Decline
              </button>
              <button
                onClick={closeDoctorDetails}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;