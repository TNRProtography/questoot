
export interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface Player {
  name:string;
  score: number;
  isBot: boolean;
  lastAnswerCorrect?: boolean;
  lastScoreGained?: number;
}

export interface PlayerAnswer {
    playerName: string;
    answerIndex: number;
    timeTaken: number; // seconds
}

export interface GameState {
    gameCode: string;
    gamePhase: GamePhase;
    players: Player[];
    questions: Question[];
    currentQuestionIndex: number;
    phaseStartTime: number; // Timestamp of when the current phase (e.g., question) started
    answers: Record<number, PlayerAnswer[]>; // Question Index -> Answers
}


export enum GamePhase {
  HOME,
  JOIN_SETUP, // Player-side
  LOBBY,
  LOADING_QUESTIONS,
  QUESTION_INTRO,
  QUESTION_ACTIVE,
  QUESTION_RESULT,
  LEADERBOARD,
  FINAL_RESULT,
}
