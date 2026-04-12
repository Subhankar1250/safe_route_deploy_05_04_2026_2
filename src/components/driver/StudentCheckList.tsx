
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { useStudentList } from './useStudentList';
import StudentSearch from './StudentSearch';
import StudentItem from './StudentItem';
import { StudentCheckListProps } from './types';
import { useAppLanguage } from '@/contexts/AppLanguageContext';

function openMapsSearch(query: string) {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

const StudentCheckList: React.FC<StudentCheckListProps> = ({ isActive, journeyType = 'none' }) => {
  const { searchTerm, setSearchTerm, filteredStudents, handleCheckInOut, loading, nextMapsTarget } = useStudentList(isActive, journeyType);
  const { t } = useAppLanguage();
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
          <span>{t("driver.studentChecklist")}</span>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {nextMapsTarget ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => openMapsSearch(nextMapsTarget.query)}
              >
                <MapPin className="mr-1.5 h-4 w-4" aria-hidden />
                {t("driver.openNextInMaps")}
              </Button>
            ) : null}
            <StudentSearch searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-500">{t("driver.loadingStudents")}</p>
            </div>
          ) : (
            <>
              {filteredStudents.map(student => (
                <StudentItem 
                  key={student.id}
                  student={student}
                  isActive={isActive}
                  journeyType={journeyType}
                  onCheckInOut={handleCheckInOut}
                />
              ))}
              
              {filteredStudents.length === 0 && (
                <p className="text-center py-4 text-gray-500">
                  {searchTerm ? t("driver.noStudentsMatch") : t("driver.noStudentsAssigned")}
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentCheckList;
