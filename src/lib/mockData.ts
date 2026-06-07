import { Question } from "./offlineDb";

export const MOCK_QUESTIONS: Question[] = [
  // Grade 8 Category (Grades 7-8)
  {
    id: "mock-q1",
    gradeCategory: "grade_8",
    specificGrade: 7,
    subject: "Biology",
    unit: 1,
    chapterTitle: "Introduction to Biology",
    question: "What is the basic unit of life in all living organisms?",
    choices: ["Cell", "Tissue", "Organ", "System"],
    correctAnswer: 0,
    explanation: "The cell is the basic structural, functional, and biological unit of all known organisms. It is often referred to as the building block of life."
  },
  {
    id: "mock-q2",
    gradeCategory: "grade_8",
    specificGrade: 7,
    subject: "Biology",
    unit: 1,
    chapterTitle: "Introduction to Biology",
    question: "Which organelle is known as the powerhouse of the cell?",
    choices: ["Nucleus", "Ribosome", "Mitochondria", "Chloroplast"],
    correctAnswer: 2,
    explanation: "Mitochondria are double-membrane-bound organelles responsible for generating adenosine triphosphate (ATP), the primary energy currency of the cell."
  },
  {
    id: "mock-q3",
    gradeCategory: "grade_8",
    specificGrade: 8,
    subject: "Mathematics",
    unit: 1,
    chapterTitle: "Linear Equations",
    question: "Solve the equation: 3x - 7 = 8. What is the value of x?",
    choices: ["x = 3", "x = 5", "x = 15", "x = -5"],
    correctAnswer: 1,
    explanation: "Add 7 to both sides: 3x = 15. Then, divide both sides by 3: x = 5."
  },
  {
    id: "mock-q4",
    gradeCategory: "grade_8",
    specificGrade: 8,
    subject: "Physics",
    unit: 1,
    chapterTitle: "Force and Newton's Laws",
    question: "Which of Newton's Laws states that 'For every action, there is an equal and opposite reaction'?",
    choices: ["First Law", "Second Law", "Third Law", "Law of Gravitation"],
    correctAnswer: 2,
    explanation: "Newton's Third Law of Motion describes action and reaction forces: whenever one object exerts a force on a second object, the second object exerts an equal and opposite force on the first."
  },
  // Grade 8 Unit 2 (LOCKED for Free tier)
  {
    id: "mock-q5",
    gradeCategory: "grade_8",
    specificGrade: 8,
    subject: "Biology",
    unit: 2,
    chapterTitle: "Human Physiology",
    question: "Which gas do humans inhale for cellular respiration?",
    choices: ["Carbon Dioxide", "Oxygen", "Nitrogen", "Argon"],
    correctAnswer: 1,
    explanation: "Humans inhale oxygen, which is transported via red blood cells to tissues for aerobic cellular respiration, releasing energy."
  },

  // Grade 12 Category (Grades 9-12)
  {
    id: "mock-q6",
    gradeCategory: "grade_12",
    specificGrade: 9,
    subject: "Chemistry",
    unit: 1,
    chapterTitle: "Structure of the Atom",
    question: "Who discovered the electron using the cathode ray tube experiment?",
    choices: ["John Dalton", "J.J. Thomson", "Ernest Rutherford", "Niels Bohr"],
    correctAnswer: 1,
    explanation: "J.J. Thomson discovered the electron in 1897, showing that cathode rays were composed of previously unknown negatively charged particles."
  },
  {
    id: "mock-q7",
    gradeCategory: "grade_12",
    specificGrade: 10,
    subject: "English",
    unit: 1,
    chapterTitle: "Tenses & Vocabulary",
    question: "Identify the correct tense: 'By next year, I will have graduated from high school.'",
    choices: ["Future Perfect", "Future Continuous", "Present Perfect", "Past Perfect"],
    correctAnswer: 0,
    explanation: "The Future Perfect tense describes an action that will be completed between now and a specific point in the future. Formed with 'will have' + past participle."
  },
  {
    id: "mock-q8",
    gradeCategory: "grade_12",
    specificGrade: 12,
    subject: "Biology",
    unit: 1,
    chapterTitle: "Enzymes & Metabolism",
    question: "What is the primary function of an enzyme in chemical reactions?",
    choices: ["Raise the temperature", "Increase activation energy", "Lower activation energy", "React with products"],
    correctAnswer: 2,
    explanation: "Enzymes act as biological catalysts. They speed up chemical reactions by lowering the activation energy barrier needed for the reaction to proceed."
  },
  // Grade 12 Unit 2 (LOCKED for Free tier)
  {
    id: "mock-q9",
    gradeCategory: "grade_12",
    specificGrade: 12,
    subject: "Mathematics",
    unit: 2,
    chapterTitle: "Differential Calculus",
    question: "What is the derivative of f(x) = 3x^2 + 5x - 9 with respect to x?",
    choices: ["f'(x) = 6x + 5", "f'(x) = 3x + 5", "f'(x) = 6x", "f'(x) = 6x^2 + 5"],
    correctAnswer: 0,
    explanation: "Using the power rule, the derivative of 3x^2 is 6x, the derivative of 5x is 5, and the derivative of the constant -9 is 0. Thus, f'(x) = 6x + 5."
  }
];

export const MOCK_USERS = [
  {
    uid: "student-1",
    displayName: "Abebe Kebede",
    email: "abebe@gmail.com",
    phoneNumber: "+251911223344",
    role: "student",
    isPaid: false
  },
  {
    uid: "student-2",
    displayName: "Chaltu Gemechu",
    email: "chaltu@gmail.com",
    phoneNumber: "+251912445566",
    role: "student",
    isPaid: true
  },
  {
    uid: "student-3",
    displayName: "Aster Tolosa",
    email: "aster@yahoo.com",
    phoneNumber: "+251920887799",
    role: "student",
    isPaid: false
  }
];

export const MOCK_PAYMENTS = [
  {
    id: "pay-1",
    userId: "student-1",
    userName: "Abebe Kebede",
    userPhone: "+251911223344",
    method: "e-Birr",
    transactionId: "TXN847291B",
    amount: 150,
    status: "pending",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 3600 } // 1 hour ago
  },
  {
    id: "pay-2",
    userId: "student-2",
    userName: "Chaltu Gemechu",
    userPhone: "+251912445566",
    method: "Commercial Bank of Ethiopia (CBE)",
    transactionId: "FT26105GH8",
    amount: 150,
    status: "approved",
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 86400 } // 1 day ago
  }
];

export const MOCK_METHODS = [
  {
    id: "m-1",
    name: "e-Birr",
    accountNumber: "*847*2*1*912345678*150#",
    accountHolder: "Exam Store Education",
    instructions: "Dial *847# on your mobile, select Merchant Payment, enter Merchant ID 912345678, specify the amount, or dial the quick code shown above.",
    isActive: true
  },
  {
    id: "m-2",
    name: "Commercial Bank of Ethiopia (CBE)",
    accountNumber: "1000492837261",
    accountHolder: "Exam Store Corp.",
    instructions: "Transfer the amount via CBE Birr mobile app or bank transfer to the account number above. Keep the Transaction Reference ID.",
    isActive: true
  }
];
