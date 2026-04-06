
import React from 'react';
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useAppLanguage } from "@/contexts/AppLanguageContext";

interface StudentSearchProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const StudentSearch: React.FC<StudentSearchProps> = ({ searchTerm, setSearchTerm }) => {
  const { t } = useAppLanguage();
  return (
    <div className="relative w-64">
      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={t("common.searchStudents")}
        className="pl-8"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </div>
  );
};

export default StudentSearch;
