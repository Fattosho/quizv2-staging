import { useEffect } from "react";
import QuizDiagnosticoDuda from "./components/QuizDiagnosticoDuda.jsx";
import CrmApp from "./components/CrmApp.jsx";

export default function App() {
  const isCrmRoute = window.location.pathname.startsWith("/crm");

  useEffect(() => {
    document.title = isCrmRoute ? "CRM DUDA FARAGE" : "Diagnostico Duda";
  }, [isCrmRoute]);

  if (isCrmRoute) {
    return <CrmApp />;
  }

  return <QuizDiagnosticoDuda />;
}
