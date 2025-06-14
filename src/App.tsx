import { Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/Forgot-Password";
import XRay from "@/pages/XRay";
import Cbc from "./pages/Cbc";


function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/xray" element={<XRay />} />
      <Route path="/cbc" element={<Cbc />} />
    </Routes>
  );
}

export default App;
