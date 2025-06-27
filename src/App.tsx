import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/firebaseConfig";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/Forgot-Password";
import Dashboard from "@/pages/Dashboard";
import XRayAdmin from "@/pages/admin/XRayAdmin";
import CbcAdmin from "@/pages/admin/CbcAdmin";
import UrinalysisAdmin from "@/pages/admin/UrinalysisAdmin";
import EcgAdmin from "./pages/admin/EcgAdmin";
import XRayUser from "@/pages/user/XRayUser";
import CbcUser from "@/pages/user/CbcUser";
import UrinalysisUser from "@/pages/user/UrinalysisUser";
import EcgUser from "@/pages/user/EcgUser";
import LipidAdmin from "./pages/admin/LipidAdmin";
import MedExamAdmin from "@/pages/admin/MedExamAdmin";
import ChemistryAdmin from "./pages/admin/ChemistryAdmin";
import ReportsAdmin from "./pages/admin/ReportsAdmin";

interface UserData {
  email: string;
  lastname: string;
  firstname: string;
  employeeId: string;
  role: string;
}

// Protected Route Component
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requiredRole?: string;
  userRole?: string;
  isAuthenticated: boolean;
  isLoading: boolean;
}> = ({ children, requiredRole, userRole, isAuthenticated, isLoading }) => {
  if (isLoading) {
    return <div>Loading...</div>; // You can replace this with a proper loading component
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/dashboard" replace />; // Redirect to dashboard if role doesn't match
  }

  return <>{children}</>;
};

function App() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Query the users collection to find the user document by email
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("email", "==", user.email));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            // Get the first matching document
            const userDoc = querySnapshot.docs[0];
            const data = userDoc.data();

            const userData: UserData = {
              email: data.email || user.email || "",
              lastname: data.lastname || "",
              firstname: data.firstname || "",
              employeeId: data.employeeId || "",
              role: data.role || "Employee",
            };

            setUserData(userData);
            setIsAuthenticated(true);
          } else {
            console.error("User document not found");
            // Fallback to auth user data with default role
            setUserData({
              email: user.email || "",
              lastname: "",
              firstname: "",
              employeeId: "",
              role: "Employee",
            });
            setIsAuthenticated(true);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          // Fallback to auth user data with default role
          setUserData({
            email: user.email || "",
            lastname: "",
            firstname: "",
            employeeId: "",
            role: "Employee",
          });
          setIsAuthenticated(true);
        }
      } else {
        setUserData(null);
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Protected Routes - Accessible to all authenticated users */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
          >
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reportsadmin"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
          >
            <ReportsAdmin />
          </ProtectedRoute>
        }
      />

      {/* Admin-only Routes */}
      <Route
        path="/xrayadmin"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            requiredRole="Admin"
            userRole={userData?.role}
          >
            <XRayAdmin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cbcadmin"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            requiredRole="Admin"
            userRole={userData?.role}
          >
            <CbcAdmin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ecgadmin"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            requiredRole="Admin"
            userRole={userData?.role}
          >
            <EcgAdmin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/urinalysisadmin"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            requiredRole="Admin"
            userRole={userData?.role}
          >
            <UrinalysisAdmin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/lipidadmin"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            requiredRole="Admin"
            userRole={userData?.role}
          >
            <LipidAdmin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/medexamadmin"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            requiredRole="Admin"
            userRole={userData?.role}
          >
            <MedExamAdmin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/chemadmin"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            requiredRole="Admin"
            userRole={userData?.role}
          >
            <ChemistryAdmin />
          </ProtectedRoute>
        }
      />

      {/* Employee/User Routes */}
      <Route
        path="/xrayuser"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            requiredRole="Employee"
            userRole={userData?.role}
          >
            <XRayUser />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cbcuser"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            requiredRole="Employee"
            userRole={userData?.role}
          >
            <CbcUser />
          </ProtectedRoute>
        }
      />
      <Route
        path="/urinalysisuser"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            requiredRole="Employee"
            userRole={userData?.role}
          >
            <UrinalysisUser />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ecguser"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            requiredRole="Employee"
            userRole={userData?.role}
          >
            <EcgUser />
          </ProtectedRoute>
        }
      />

      {/* Catch-all route - redirect to login if not authenticated, dashboard if authenticated */}
      <Route
        path="*"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;
