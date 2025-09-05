
import { GoogleGenAI, Type } from "@google/genai";
import type { Question } from '../types';
import { GAME_SETTINGS } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const fetchQuizQuestions = async (): Promise<Question[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate ${GAME_SETTINGS.questionCount} diverse general knowledge multiple-choice quiz questions. Each question must have exactly 4 options. Indicate the correct answer index from 0 to 3.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: 'The quiz question.'
              },
              options: {
                type: Type.ARRAY,
                description: 'An array of 4 possible answers.',
                items: {
                  type: Type.STRING,
                }
              },
              correctAnswerIndex: {
                type: Type.INTEGER,
                description: 'The index (0-3) of the correct answer in the options array.'
              }
            },
            required: ["question", "options", "correctAnswerIndex"]
          }
        }
      }
    });

    const jsonText = response.text.trim();
    const questions = JSON.parse(jsonText) as Question[];
    
    // Validate data structure
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("Invalid question format received from API.");
    }
    
    return questions.filter(q => 
        q.question && 
        Array.isArray(q.options) && 
        q.options.length === 4 && 
        typeof q.correctAnswerIndex === 'number'
    );

  } catch (error) {
    console.error("Error fetching quiz questions:", error);
    // Fallback to mock questions if API fails
    return [
        { question: "What is the capital of France?", options: ["Berlin", "Madrid", "Paris", "Rome"], correctAnswerIndex: 2 },
        { question: "Which planet is known as the Red Planet?", options: ["Earth", "Mars", "Jupiter", "Venus"], correctAnswerIndex: 1 },
        { question: "Who wrote 'To Kill a Mockingbird'?", options: ["Harper Lee", "Mark Twain", "J.K. Rowling", "F. Scott Fitzgerald"], correctAnswerIndex: 0 },
    ];
  }
};
