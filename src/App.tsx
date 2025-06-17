import { Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/Forgot-Password";
import XRayAdmin from "@/pages/admin/XRayAdmin";
import CbcAdmin from "./pages/admin/CbcAdmin";
import UrinalysisAdmin from "./pages/admin/UrinalysisAdmin";
import XRayUser from "./pages/user/XRayUser";
import CbcUser from "./pages/user/CbcUser";
import UrinalysisUser from "./pages/user/UrinalysisUser";
import EcgAdmin from "./pages/admin/EcgAdmin";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/xrayadmin" element={<XRayAdmin />} />
      <Route path="/cbcadmin" element={<CbcAdmin />} />
      <Route path="/ecgadmin" element={<EcgAdmin/>}/>
      <Route path="/urinalysisadmin" element={<UrinalysisAdmin />} />
      <Route path="/xrayuser" element={<XRayUser />} />
      <Route path="/cbcuser" element={<CbcUser />} />
      <Route path="/urinalysisuser" element={<UrinalysisUser />} />
    </Routes>
  );
}

export default App;
