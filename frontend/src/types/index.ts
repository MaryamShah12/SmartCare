export interface PatientSignupData {
  email: string;
  password: string;
  name: string;
  age: number;
  gender: string;
  medical_history?: string;
}

export interface DoctorSignupData {
  email: string;
  password: string;
  name: string;
  specialization: string;
  documents?: string;
  photo?: string;
}

export interface LoginData {
  email: string;
  password: string;
}