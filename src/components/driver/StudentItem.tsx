
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Student } from './types';
import { PhotoCapture, PhotoMetadata } from './PhotoCapture';
import { useVoiceAnnouncements } from '@/hooks/useVoiceAnnouncements';
import { useToast } from '@/components/ui/use-toast';
import { Camera } from 'lucide-react';
import { useAppLanguage } from '@/contexts/AppLanguageContext';
interface StudentItemProps {
  student: Student;
  isActive: boolean;
  journeyType?: 'none' | 'pickup' | 'drop';
  onCheckInOut: (studentId: string) => void | Promise<void>;
}

const StudentItem: React.FC<StudentItemProps> = ({ student, isActive, journeyType = 'none', onCheckInOut }) => {
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const { announceStudentPickup, announceStudentDropoff } = useVoiceAnnouncements();
  const { toast } = useToast();
  const { t } = useAppLanguage();

  const getStatusText = (student: Student) => {
    if (student.isOnBoard) {
      return `${t("driver.boardedAt")} ${student.boardedAt}`;
    } else if (student.boardedAt && student.leftAt) {
      return `${t("driver.boardedAt")} ${student.boardedAt}, ${t("driver.leftAt")} ${student.leftAt}`;
    }
    return t("driver.notBoarded");
  };

  const handleCheckInOut = async () => {
    if (journeyType === 'pickup' && !student.isOnBoard) {
      await announceStudentPickup(student.name, 'N/A');
    } else if (journeyType === 'drop' && student.isOnBoard) {
      await announceStudentDropoff(student.name);
    }

    await onCheckInOut(student.id);
  };

  const handlePhotoTaken = (photoData: string, metadata: PhotoMetadata) => {
    // Store photo data (you can implement photo storage service)
    console.log('Photo taken:', { photoData: photoData.substring(0, 50) + '...', metadata });
    setShowPhotoCapture(false);
    
    toast({
      title: "Photo Saved",
      description: `${metadata.action === 'pickup' ? 'Pickup' : 'Drop-off'} photo saved successfully.`
    });
  };

  return (
    <div className="space-y-4">
      <div
        className={[
          "flex items-center justify-between p-2 border rounded-md",
          student.isAbsentToday ? "opacity-55 bg-muted/30" : "hover:bg-muted/50",
        ].join(" ")}
      >
        <div className="flex items-center space-x-2">
          <Checkbox
            id={`student-${student.id}`}
            checked={student.isOnBoard}
            onCheckedChange={handleCheckInOut}
            disabled={!isActive || !!student.isAbsentToday}
          />
          <div>
            <label htmlFor={`student-${student.id}`} className="font-medium cursor-pointer text-foreground">
              {student.name}
            </label>
            <p className="text-sm text-muted-foreground">{t("driver.grade")}: {student.grade}</p>
            {student.isAbsentToday && (
              <p className="text-xs font-medium text-amber-700">{t("driver.absentToday")}</p>
            )}
            {(student.pickupPoint?.trim() ||
              (student.pickup_location_lat != null &&
                student.pickup_location_lng != null &&
                Number.isFinite(Number(student.pickup_location_lat)) &&
                Number.isFinite(Number(student.pickup_location_lng)))) && (
              <p className="text-xs text-muted-foreground">
                {t("driver.pickupPoint")}:{" "}
                {student.pickupPoint?.trim() ||
                  `${Number(student.pickup_location_lat).toFixed(5)}, ${Number(student.pickup_location_lng).toFixed(5)}`}
              </p>
            )}
          </div>
        </div>
        
        <div className="text-right space-x-2">
          {/* Photo Capture Button */}
          {journeyType !== 'none' && isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPhotoCapture(!showPhotoCapture)}
            >
              <Camera className="w-4 h-4 mr-1" />
              {t("driver.photo")}
            </Button>
          )}
          
          <p className={`text-sm ${student.isOnBoard ? 'text-green-600' : 'text-muted-foreground'}`}>
            {getStatusText(student)}
          </p>
          
          {journeyType !== 'none' && (
            <Button
              variant="ghost"
              size="sm"
              disabled={!isActive || !!student.isAbsentToday}
              onClick={handleCheckInOut}
            >
              {journeyType === 'pickup' 
                ? (student.isOnBoard ? t("driver.pickedUp") : t("driver.pickUp")) 
                : (student.isOnBoard ? t("driver.onBus") : t("driver.drop"))
              }
            </Button>
          )}
          
          {journeyType === 'none' && (
            <Button
              variant="ghost"
              size="sm"
              disabled={!isActive || !!student.isAbsentToday}
              onClick={handleCheckInOut}
            >
              {student.isOnBoard ? t("driver.checkOut") : t("driver.checkIn")}
            </Button>
          )}
        </div>
      </div>
      
      {/* Photo Capture Component */}
      {showPhotoCapture && journeyType !== 'none' && (
        <PhotoCapture
          onPhotoTaken={handlePhotoTaken}
          studentName={student.name}
          action={journeyType === 'drop' ? 'dropoff' : journeyType}
        />
      )}
    </div>
  );
};

export default StudentItem;
