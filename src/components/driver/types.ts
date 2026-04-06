
export interface Student {
  id: string;
  name: string;
  grade: string;
  boardedAt: string | null;
  leftAt: string | null;
  isOnBoard: boolean;
  /** Guardian marked absent for today; hide/disable stop to save time. */
  isAbsentToday?: boolean;
  pickupPoint?: string;
  guardianName?: string;
  guardianMobile?: string;
  /** For FCM push alongside SMS/WhatsApp */
  guardian_profile_id?: string;
}

export interface StudentCheckListProps {
  isActive: boolean;
  journeyType?: 'none' | 'pickup' | 'drop';
}
