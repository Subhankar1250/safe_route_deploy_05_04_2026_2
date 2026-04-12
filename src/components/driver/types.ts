
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
  /** Admin map pin; used for “Open in Maps” when set. */
  pickup_location_lat?: number | null;
  pickup_location_lng?: number | null;
  guardianName?: string;
  guardianMobile?: string;
  /** For FCM push alongside SMS/WhatsApp */
  guardian_profile_id?: string;
}

export interface StudentCheckListProps {
  isActive: boolean;
  journeyType?: 'none' | 'pickup' | 'drop';
}
