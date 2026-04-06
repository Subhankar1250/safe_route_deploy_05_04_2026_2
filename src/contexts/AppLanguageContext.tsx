"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export type AppLanguage = "en" | "bn";

type Dict = Record<string, string>;

const EN: Dict = {
  "lang.english": "English",
  "lang.bengali": "বাংলা",
  "role.driver": "Driver",
  "role.guardian": "Guardian",
  "role.driverSubtitle": "Driver app",
  "role.guardianSubtitle": "Parent app",
  "guardian.markAbsent": "Mark Absent (Today)",
  "guardian.undoAbsent": "Undo absent (Today)",
  "guardian.absentHint": "If marked absent, the driver list will gray out this stop for today.",
  "guardian.absentFailTitle": "Could not update absent",
  "guardian.absentTryAgain": "Try again",
  "guardian.markedAbsent": "Marked absent",
  "guardian.markedPresent": "Marked present",
  "guardian.driverWillSeeAbsent": "Driver will see this student as absent today.",
  "guardian.driverWillSeePresent": "Driver will see this student as present today.",
  "guardian.proximityTitle": "Alert",
  "guardian.proximityMsg": "ড্রাইভার ৫০০ মিটারের মধ্যে চলে এসেছে, আপনি বাচ্চাকে নিয়ে প্রস্তুত থাকুন।",
  "driver.startTrip": "Start Trip",
  "driver.endTrip": "End Trip",
  "driver.pickup": "Pick Up",
  "driver.dropoff": "Drop Off",
  "common.loading": "Loading…",
  "common.searchStudents": "Search students...",
  "driver.studentChecklist": "Student Check-in/out",
  "driver.loadingStudents": "Loading students...",
  "driver.noStudentsMatch": "No students found matching your search.",
  "driver.noStudentsAssigned": "No students assigned to this bus.",
  "driver.grade": "Grade",
  "driver.absentToday": "Absent today",
  "driver.pickupPoint": "Pickup",
  "driver.photo": "Photo",
  "driver.pickedUp": "Picked Up ✓",
  "driver.onBus": "On Bus",
  "driver.drop": "Drop",
  "driver.pickUp": "Pick Up",
  "driver.checkIn": "Check In",
  "driver.checkOut": "Check Out",
  "driver.notBoarded": "Not boarded",
  "driver.boardedAt": "Boarded at",
  "driver.leftAt": "left at",
  "voice.title": "Voice Announcements",
  "voice.enable": "Enable Voice Announcements",
  "voice.voiceType": "Voice Type",
  "voice.speed": "Speech Speed",
  "voice.language": "Language",
  "voice.test": "Test Voice",
  "guardian.notificationCenter": "Notification Center",
  "guardian.noNotifications": "No notifications yet.",
  "guardian.notificationOptions": "Notification options",
  "guardian.notificationOptionsHint": "Choose which automatic driver activity alerts you want to receive.",
  "guardian.notif.studentPickup": "Student picked up",
  "guardian.notif.reachSchool": "Reached school",
  "guardian.notif.leaveSchool": "Left school for home",
  "guardian.notif.studentDrop": "Dropped at home",
  "guardian.etaStaleBadge": "Last live update is stale",
  "guardian.etaStaleHint": "Driver location is old. ETA will appear after fresh live tracking resumes.",
  "guardian.nav.notices": "Notices",
  "guardian.nav.child": "Child",
  "guardian.nav.driver": "Driver & bus",
  "guardian.nav.live": "Live status",
  "guardian.nav.eta": "ETA",
  "guardian.nav.map": "Map",
  "guardian.nav.history": "Pickup / drop",
  "guardian.nav.feedback": "Feedback",
  "guardian.nav.voice": "Voice",
  "guardian.nav.location": "My location",
  "driver.nav.notices": "Notices & calendar",
  "driver.nav.quick": "Quick status",
  "driver.nav.summary": "Summary",
  "driver.nav.map": "Map",
  "driver.nav.trips": "Trips & journey",
  "driver.nav.safety": "Safety & alerts",
  "driver.nav.students": "Students",
};

const BN: Dict = {
  "lang.english": "English",
  "lang.bengali": "বাংলা",
  "role.driver": "ড্রাইভার",
  "role.guardian": "অভিভাবক",
  "role.driverSubtitle": "ড্রাইভার অ্যাপ",
  "role.guardianSubtitle": "অভিভাবক অ্যাপ",
  "guardian.markAbsent": "আজ অনুপস্থিত দিন",
  "guardian.undoAbsent": "আজ উপস্থিত দিন",
  "guardian.absentHint": "অনুপস্থিত করলে ড্রাইভারের তালিকায় আজকের জন্য এই স্টপ নিষ্ক্রিয় হবে।",
  "guardian.absentFailTitle": "অনুপস্থিত আপডেট করা যায়নি",
  "guardian.absentTryAgain": "আবার চেষ্টা করুন",
  "guardian.markedAbsent": "অনুপস্থিত করা হয়েছে",
  "guardian.markedPresent": "উপস্থিত করা হয়েছে",
  "guardian.driverWillSeeAbsent": "ড্রাইভার আজ এই শিক্ষার্থীকে অনুপস্থিত হিসেবে দেখবে।",
  "guardian.driverWillSeePresent": "ড্রাইভার আজ এই শিক্ষার্থীকে উপস্থিত হিসেবে দেখবে।",
  "guardian.proximityTitle": "সতর্কতা",
  "guardian.proximityMsg": "ড্রাইভার ৫০০ মিটারের মধ্যে চলে এসেছে, আপনি বাচ্চাকে নিয়ে প্রস্তুত থাকুন।",
  "driver.startTrip": "ট্রিপ শুরু",
  "driver.endTrip": "ট্রিপ শেষ",
  "driver.pickup": "পিক আপ",
  "driver.dropoff": "ড্রপ অফ",
  "common.loading": "লোড হচ্ছে…",
  "common.searchStudents": "শিক্ষার্থী খুঁজুন...",
  "driver.studentChecklist": "শিক্ষার্থী চেক-ইন/আউট",
  "driver.loadingStudents": "শিক্ষার্থী তালিকা লোড হচ্ছে...",
  "driver.noStudentsMatch": "আপনার খোঁজ অনুযায়ী শিক্ষার্থী পাওয়া যায়নি।",
  "driver.noStudentsAssigned": "এই বাসে কোনো শিক্ষার্থী বরাদ্দ নেই।",
  "driver.grade": "শ্রেণি",
  "driver.absentToday": "আজ অনুপস্থিত",
  "driver.pickupPoint": "পিক-আপ",
  "driver.photo": "ছবি",
  "driver.pickedUp": "তোলা হয়েছে ✓",
  "driver.onBus": "বাসে আছে",
  "driver.drop": "নামান",
  "driver.pickUp": "তুলুন",
  "driver.checkIn": "চেক-ইন",
  "driver.checkOut": "চেক-আউট",
  "driver.notBoarded": "এখনও ওঠেনি",
  "driver.boardedAt": "ওঠার সময়",
  "driver.leftAt": "নামার সময়",
  "voice.title": "ভয়েস ঘোষণা",
  "voice.enable": "ভয়েস ঘোষণা চালু",
  "voice.voiceType": "ভয়েস ধরন",
  "voice.speed": "বলার গতি",
  "voice.language": "ভাষা",
  "voice.test": "ভয়েস পরীক্ষা",
  "guardian.notificationCenter": "নোটিফিকেশন সেন্টার",
  "guardian.noNotifications": "এখনও কোনো নোটিফিকেশন নেই।",
  "guardian.notificationOptions": "নোটিফিকেশন অপশন",
  "guardian.notificationOptionsHint": "ড্রাইভারের কোন স্বয়ংক্রিয় আপডেট নোটিফিকেশন পাবেন তা বেছে নিন।",
  "guardian.notif.studentPickup": "শিক্ষার্থীকে তোলা হয়েছে",
  "guardian.notif.reachSchool": "স্কুলে পৌঁছেছে",
  "guardian.notif.leaveSchool": "স্কুল থেকে বাড়ির পথে রওনা হয়েছে",
  "guardian.notif.studentDrop": "বাড়িতে নামানো হয়েছে",
  "guardian.etaStaleBadge": "শেষ লাইভ আপডেটটি পুরনো",
  "guardian.etaStaleHint": "ড্রাইভারের লোকেশন পুরনো। নতুন লাইভ ট্র্যাকিং শুরু হলে ETA দেখাবে।",
  "guardian.nav.notices": "নোটিস",
  "guardian.nav.child": "শিক্ষার্থী",
  "guardian.nav.driver": "ড্রাইভার ও বাস",
  "guardian.nav.live": "লাইভ অবস্থা",
  "guardian.nav.eta": "পৌঁছানোর সময়",
  "guardian.nav.map": "ম্যাপ",
  "guardian.nav.history": "পিকআপ / ড্রপ",
  "guardian.nav.feedback": "ফিডব্যাক",
  "guardian.nav.voice": "ভয়েস",
  "guardian.nav.location": "আমার লোকেশন",
  "driver.nav.notices": "নোটিস ও ক্যালেন্ডার",
  "driver.nav.quick": "দ্রুত বার্তা",
  "driver.nav.summary": "সারাংশ",
  "driver.nav.map": "ম্যাপ",
  "driver.nav.trips": "ট্রিপ ও জার্নি",
  "driver.nav.safety": "নিরাপত্তা ও সতর্কতা",
  "driver.nav.students": "শিক্ষার্থী",
};

type Ctx = {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  t: (key: string) => string;
};

const defaultCtx: Ctx = {
  lang: "en",
  setLang: () => {},
  t: (key: string) => EN[key] ?? key,
};

const AppLanguageContext = createContext<Ctx>(defaultCtx);

function loadInitialLang(): AppLanguage {
  if (typeof window === "undefined") return "en";
  const v = localStorage.getItem("app_lang");
  return v === "bn" ? "bn" : "en";
}

export function AppLanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLanguage>(loadInitialLang);
  const setLang = (next: AppLanguage) => {
    setLangState(next);
    if (typeof window !== "undefined") localStorage.setItem("app_lang", next);
  };
  const dict = lang === "bn" ? BN : EN;
  const t = (key: string) => dict[key] ?? EN[key] ?? key;
  const value = useMemo(() => ({ lang, setLang, t }), [lang]);
  return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
}

export function useAppLanguage() {
  const ctx = useContext(AppLanguageContext);
  return ctx;
}

