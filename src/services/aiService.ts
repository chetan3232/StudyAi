import { GoogleGenAI, Type } from "@google/genai";
import { Subject, StudyLog } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function withRetry<T>(fn: () => Promise<T>, retries = 5, delay = 3000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const isQuotaError = errorMessage.includes('429') || error?.status === 'RESOURCE_EXHAUSTED';
    const isRpcError = errorMessage.includes('500') || errorMessage.includes('Rpc failed') || errorMessage.includes('xhr error');
    
    if (retries > 0 && (isQuotaError || isRpcError)) {
      const backoffDelay = isQuotaError ? delay * 2 : delay;
      console.warn(`AI Request failed (${isQuotaError ? 'Quota' : 'RPC'}). Retrying in ${backoffDelay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return withRetry(fn, retries - 1, backoffDelay * 1.5);
    }
    throw error;
  }
}

export interface AIRecommendation {
  weakSubjects: string[];
  suggestions: string[];
  motivationQuote: string;
  performanceForecast: string;
  burnoutRisk: 'Low' | 'Medium' | 'High';
  bestStudyTime: string;
  revisionNeeded: string[];
  mistakePattern: string;
  isFallback?: boolean;
}

export async function getStudyRecommendations(subjects: Subject[], logs: StudyLog[]): Promise<AIRecommendation> {
  const prompt = `
    Analyze the following study data for a comprehensive performance audit.
    Subjects: ${JSON.stringify(subjects)}
    Recent Logs: ${JSON.stringify(logs.slice(-50))}
    
    Provide:
    1. Weak subjects (high difficulty but low study time).
    2. 3 actionable daily suggestions.
    3. A short motivational quote.
    4. Performance Forecast: Predict the student's readiness for exams based on consistency.
    5. Burnout Risk: Assess if the student is overworking or inconsistent (Low/Medium/High).
    6. Productivity DNA: Identify the best time of day they seem to study based on log timestamps.
    7. Smart Revision: List subjects that haven't been studied in over 3 days (Spaced Repetition).
    8. Mistake Pattern: Analyze if they are avoiding hard subjects or studying at inconsistent times.
  `;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            weakSubjects: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            motivationQuote: { type: Type.STRING },
            performanceForecast: { type: Type.STRING, description: "A brief forecast of exam readiness." },
            burnoutRisk: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
            bestStudyTime: { type: Type.STRING, description: "e.g., Early Morning, Late Night" },
            revisionNeeded: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Subjects needing revision." },
            mistakePattern: { type: Type.STRING, description: "Analysis of study habits and gaps." }
          },
          required: ["weakSubjects", "suggestions", "motivationQuote", "performanceForecast", "burnoutRisk", "bestStudyTime", "revisionNeeded", "mistakePattern"]
        }
      }
    }));

    return { ...JSON.parse(response.text), isFallback: false };
  } catch (error) {
    console.error("AI Recommendation Error:", error);
    return {
      weakSubjects: [],
      suggestions: ["Keep consistent with your schedule.", "Focus on high-priority subjects first."],
      motivationQuote: "The secret of getting ahead is getting started.",
      performanceForecast: "Data insufficient for accurate forecast.",
      burnoutRisk: "Low",
      bestStudyTime: "Morning",
      revisionNeeded: [],
      mistakePattern: "No patterns detected yet.",
      isFallback: true
    };
  }
}

export interface WeakAreaAnalysis {
  concepts: { name: string, description: string, resources: string[] }[];
  targetedExercises: string[];
  overallStrategy: string;
}

export async function getDeepWeakAreaAnalysis(subjects: Subject[], logs: StudyLog[]): Promise<WeakAreaAnalysis> {
  const prompt = `
    Perform a deep neural analysis of the student's weak areas based on their study habits and subject data.
    Subjects: ${JSON.stringify(subjects)}
    Recent Logs: ${JSON.stringify(logs.slice(-50))}
    
    Identify:
    1. Specific concepts or topics they are likely struggling with (based on high difficulty subjects with low progress or inconsistent logs).
    2. Targeted resources (e.g., specific types of videos, articles, or books).
    3. Targeted exercises to improve these areas.
    4. An overall strategy for improvement.
  `;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            concepts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  resources: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["name", "description", "resources"]
              }
            },
            targetedExercises: { type: Type.ARRAY, items: { type: Type.STRING } },
            overallStrategy: { type: Type.STRING }
          },
          required: ["concepts", "targetedExercises", "overallStrategy"]
        }
      }
    }));

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Weak Area Analysis Error:", error);
    return {
      concepts: [
        { 
          name: "System Busy", 
          description: "The AI engine is currently under high load. Please try again in a few minutes for a deep audit.", 
          resources: ["Review your recent study logs manually."] 
        }
      ],
      targetedExercises: ["Continue with your current study plan."],
      overallStrategy: "Maintain consistency while the AI system recalibrates."
    };
  }
}

export async function getMentorResponse(message: string, context: { subjects: Subject[], logs: StudyLog[], notes?: string, targetExam?: string }) {
  let prompt = `
    You are the AI Mentor. A student is asking for help or strategy.
    Student Message: "${message}"
    
    Context:
    Target Exam / Goal: ${context.targetExam || 'Not specified'}
    Subjects (with any attached notes/materials): ${JSON.stringify(context.subjects.map(s => ({ ...s, notes: s.notes?.replace(/\[PDF_BASE64\][A-Za-z0-9+/=]+/g, '[PDF Attached]') })))}
    Recent Logs: ${JSON.stringify(context.logs.slice(-20))}
    ${context.notes ? `Additional Context: ${context.notes}` : ''}
    
    Provide a helpful, encouraging, and actionable response. Act as a strategic mentor. Keep it concise. Use the provided subject notes or context if relevant to the student's question. If they ask for a plan or review, provide a structured markdown response.
  `;

  // Extract PDF base64 from subjects if present
  const inlineDataArray: any[] = [];
  context.subjects.forEach(s => {
    if (s.notes && s.notes.includes('[PDF_BASE64]')) {
      const matches = s.notes.match(/\[PDF_BASE64\]([A-Za-z0-9+/=]+)/g);
      if (matches) {
        matches.forEach(match => {
          const base64 = match.replace('[PDF_BASE64]', '');
          inlineDataArray.push({
            data: base64,
            mimeType: "application/pdf"
          });
        });
      }
    }
  });

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: inlineDataArray.length > 0 ? [...inlineDataArray, prompt] : prompt
    }));
    return response.text;
  } catch (error) {
    return "I'm having trouble connecting to my brain right now. Let's try again in a moment!";
  }
}

export async function analyzeContent(content: string, type: 'pdf' | 'video' | 'text'): Promise<{ summary: string, keyPoints: string[], quiz: { question: string, options: string[], answer: string }[] }> {
  let prompt = '';
  let inlineData: any = undefined;

  if (type === 'pdf' && content.startsWith('[PDF_BASE64]')) {
    const base64 = content.replace('[PDF_BASE64]', '');
    prompt = `Analyze the attached PDF document. Provide a concise summary, 5 key learning points, and a 3-question multiple choice quiz.`;
    inlineData = {
      data: base64,
      mimeType: "application/pdf"
    };
  } else if (type === 'video') {
    prompt = `Analyze the following video link: ${content}. If you can access its transcript or metadata, provide a concise summary, 5 key learning points, and a 3-question multiple choice quiz. If you cannot access it directly, provide a general summary of what a video with this URL typically covers based on its ID, or ask the user to provide the transcript instead.`;
  } else {
    prompt = `
      Analyze the following text content:
      "${content.slice(0, 10000)}"
      
      Provide:
      1. A concise summary.
      2. 5 key learning points.
      3. A 3-question multiple choice quiz for self-testing.
    `;
  }

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: inlineData ? [inlineData, prompt] : prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            quiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  answer: { type: Type.STRING }
                },
                required: ["question", "options", "answer"]
              }
            }
          },
          required: ["summary", "keyPoints", "quiz"]
        }
      }
    }));

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Content Analysis Error:", error);
    throw error;
  }
}

export async function generateExam(subject: string, difficulty: string): Promise<{ questions: { id: string, text: string, options: string[], correct: string }[] }> {
  const prompt = `
    Generate a ${difficulty} level exam for the subject: ${subject}.
    Provide 5 multiple choice questions.
  `;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  text: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correct: { type: Type.STRING }
                },
                required: ["id", "text", "options", "correct"]
              }
            }
          },
          required: ["questions"]
        }
      }
    }));

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Exam Generation Error:", error);
    throw error;
  }
}

export interface CoachPlan {
  dailySchedule: { time: string, activity: string, subject: string }[];
  priorityFocus: string[];
  recommendations: string[];
  masteryAnalysis: string;
}

export async function getAICoachPlan(subjects: Subject[], logs: StudyLog[]): Promise<CoachPlan> {
  const prompt = `
    You are an expert AI Study Coach. Analyze the student's data and provide a personalized study plan.
    Subjects (with difficulty and mastery): ${JSON.stringify(subjects.map(s => ({ name: s.name, difficulty: s.difficulty, mastery: s.masteryScore })))}
    Recent Study Logs: ${JSON.stringify(logs.slice(-30))}
    
    Provide:
    1. A daily schedule (time, activity, subject).
    2. Priority focus areas (subjects that need most attention based on low mastery and high difficulty).
    3. Personalized recommendations for improvement.
    4. A deep analysis of their mastery scores across all subjects.
  `;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dailySchedule: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  activity: { type: Type.STRING },
                  subject: { type: Type.STRING }
                },
                required: ["time", "activity", "subject"]
              }
            },
            priorityFocus: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            masteryAnalysis: { type: Type.STRING }
          },
          required: ["dailySchedule", "priorityFocus", "recommendations", "masteryAnalysis"]
        }
      }
    }));

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Coach Plan Error:", error);
    return {
      dailySchedule: [{ time: "08:00", activity: "Morning Review", subject: "General" }],
      priorityFocus: ["Focus on your highest difficulty subjects."],
      recommendations: ["Maintain a consistent study rhythm."],
      masteryAnalysis: "Insufficient data for deep mastery analysis."
    };
  }
}
