import { useState } from "react";
import AdminGate from "@/components/admin-gate";
import AdminShell, { type AdminSection } from "@/components/admin/admin-shell";
import QuestionBankSection from "@/components/admin/question-bank-section";
import SourcesSection from "@/components/admin/sources-section";
import AccessCodesSection from "@/components/admin/access-codes-section";
import ImportSection from "@/components/admin/import-section";

export default function Admin() {
  const [section, setSection] = useState<AdminSection>("questions");

  return (
    <AdminGate>
      <AdminShell active={section} onNavigate={setSection}>
        {section === "questions" && <QuestionBankSection />}
        {section === "sources" && <SourcesSection />}
        {section === "codes" && <AccessCodesSection />}
        {section === "import" && <ImportSection />}
      </AdminShell>
    </AdminGate>
  );
}
