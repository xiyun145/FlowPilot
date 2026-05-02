import React from "react";
import { Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import WorkflowEditor from "@/pages/WorkflowEditor";
import ExecutionLogs from "@/pages/ExecutionLogs";
import Credentials from "@/pages/Credentials";

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/workflow/:id" element={<WorkflowEditor />} />
      <Route path="/logs" element={<ExecutionLogs />} />
      <Route path="/credentials" element={<Credentials />} />
    </Routes>
  );
};

export default App;
