import localforage from "localforage";

export interface Question {
  id: string;
  gradeCategory: "grade_8" | "grade_12";
  specificGrade: number; // 7, 8, 9, 10, 11, 12
  subject: string;
  unit: number;
  chapterTitle?: string;
  question: string;
  choices: string[];
  correctAnswer: number; // Index 0-3
  explanation: string;
  createdAt?: any;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  role: "student" | "admin";
  isPaid: boolean;
  gradeCategory?: "grade_8" | "grade_12";
}

// Initialize localforage databases (guarded for SSR)
let questionsDb: LocalForage | null = null;
let profileDb: LocalForage | null = null;

if (typeof window !== "undefined") {
  questionsDb = localforage.createInstance({
    name: "exam-prep",
    storeName: "questions",
    description: "Store of all fetched exam questions for offline use",
  });

  profileDb = localforage.createInstance({
    name: "exam-prep",
    storeName: "profile",
    description: "Cached user profile and settings",
  });
}

/**
 * Saves an array of questions to the offline IndexedDB store.
 */
export async function saveQuestionsOffline(questions: Question[]): Promise<void> {
  if (!questionsDb) return;
  
  // Clear old cached questions first to avoid stale data
  await questionsDb.clear();
  
  // Save each question individually
  const promises = questions.map((q) => questionsDb!.setItem(q.id, q));
  await Promise.all(promises);
}

/**
 * Retrieves all offline questions from the store, optionally filtered by grade category.
 */
export async function getOfflineQuestions(gradeCategory?: "grade_8" | "grade_12"): Promise<Question[]> {
  if (!questionsDb) return [];
  
  const questions: Question[] = [];
  await questionsDb.iterate((value: Question) => {
    if (!gradeCategory || value.gradeCategory === gradeCategory) {
      questions.push(value);
    }
  });
  
  // Sort questions by specificGrade, subject, unit, and id
  return questions.sort((a, b) => {
    if (a.specificGrade !== b.specificGrade) return a.specificGrade - b.specificGrade;
    if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
    return a.unit - b.unit;
  });
}

/**
 * Saves the student's profile offline.
 */
export async function saveUserProfileOffline(profile: UserProfile): Promise<void> {
  if (!profileDb) return;
  await profileDb.setItem("user_profile", profile);
}

/**
 * Retrieves the cached offline profile.
 */
export async function getOfflineUserProfile(): Promise<UserProfile | null> {
  if (!profileDb) return null;
  return await profileDb.getItem<UserProfile>("user_profile");
}

/**
 * Clears all cached offline data.
 */
export async function clearOfflineCache(): Promise<void> {
  if (questionsDb) await questionsDb.clear();
  if (profileDb) await profileDb.clear();
}
