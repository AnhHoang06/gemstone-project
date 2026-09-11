import { BrowserRouter, Routes, Route } from "react-router-dom";
import TestCategories from "./pages/TestCategories";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TestCategories />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;