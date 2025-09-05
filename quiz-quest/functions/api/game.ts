import { GamePhase, type GameState, type Question } from '../../types'; // Import our types

// --- Gemini API Logic (This now runs on the server) ---
const fetchQuizQuestions = async (apiKey: string): Promise<Question[]> => {
  const body = {
    contents: [{
      parts: [{
        text: `Generate 10 diverse general knowledge multiple-choice quiz questions. Each question must have exactly 4 options. Indicate the correct answer index from 0 to 3.`
      }]
    }],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            question: { type: "STRING" },
            options: { type: "ARRAY", items: { type: "STRING" } },
            correctAnswerIndex: { type: "INTEGER" }
          },
          required: ["question", "options", "correctAnswerIndex"]
        }
      }
    }
  };

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" + apiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
        throw new Error(`Gemini API failed with status: ${response.status}`);
    }

    const data = await response.json();
    const jsonText = data.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText);

  } catch (error) {
    console.error("Error fetching quiz questions:", error);
    // Fallback to mock questions if the API fails
    return [
        { question: "What is the capital of France?", options: ["Berlin", "Madrid", "Paris", "Rome"], correctAnswerIndex: 2 },
        { question: "Which planet is known as the Red Planet?", options: ["Earth", "Mars", "Jupiter", "Venus"], correctAnswerIndex: 1 },
    ];
  }
};


// --- Durable Object Environment & Class ---

interface Env {
  GAME_ROOM: DurableObjectNamespace;
  GEMINI_API_KEY: string; // This will hold our secret API key
}

export class GameRoom {
  state: DurableObjectState;
  env: Env;
  sessions: WebSocket[] = [];
  gameState: Partial<GameState> = {}; // Use Partial<GameState> as it starts empty

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.state.blockConcurrencyWhile(async () => {
      const storedState = await this.state.storage.get<GameState>("gameState");
      if (storedState) {
        this.gameState = storedState;
      }
    });
  }

  async fetch(request: Request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleSession(socket: WebSocket) {
    this.sessions.push(socket);
    
    // When a new player connects, immediately send them the current game state
    socket.send(JSON.stringify(this.gameState));

    socket.addEventListener("message", async (msg) => {
      try {
        const message = JSON.parse(msg.data as string);
        
        // Handle the 'create' message from the host
        if (message.type === 'create') {
          this.gameState = {
            gameCode: message.payload.gameCode,
            gamePhase: GamePhase.LOBBY,
            players: [],
            questions: [],
            currentQuestionIndex: 0,
            answers: {},
          };
        }

        // Handle a player joining
        if (message.type === 'join') {
          if (!this.gameState.players) this.gameState.players = [];
          if (!this.gameState.players.find(p => p.name === message.payload.name)) {
             this.gameState.players.push({ name: message.payload.name, score: 0, isBot: false });
          }
        }
        
        // Handle the 'start' message from the host
        if (message.type === 'start') {
          this.gameState.gamePhase = GamePhase.LOADING_QUESTIONS;
          this.broadcast(JSON.stringify(this.gameState)); // Show "loading..." screen on clients
          
          const questions = await fetchQuizQuestions(this.env.GEMINI_API_KEY);
          this.gameState.questions = questions;
          this.gameState.currentQuestionIndex = 0;
          this.gameState.gamePhase = GamePhase.QUESTION_INTRO;
          // In a full implementation, you would start the game loop timer here
        }

        // After any state change, save it and broadcast to all clients
        await this.state.storage.put("gameState", this.gameState);
        this.broadcast(JSON.stringify(this.gameState));

      } catch (err) {
        console.error("Invalid message or error:", err);
      }
    });

    socket.addEventListener("close", () => {
      this.sessions = this.sessions.filter((s) => s !== socket);
    });
  }

  broadcast(message: string) {
    // Helper function to send a message to all connected clients
    this.sessions.forEach((session) => {
      try {
        session.send(message);
      } catch (err) { /* Handle cases where a session might be closing */ }
    });
  }
}

// This is the main Worker that Cloudflare first hits.
// Its only job is to get the correct Durable Object instance.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const gameCode = url.pathname.split("/").pop()?.toUpperCase();

    if (!gameCode) {
      return new Response("Game code not provided", { status: 400 });
    }

    const id = env.GAME_ROOM.idFromName(gameCode);
    const stub = env.GAME_ROOM.get(id);

    // Forward the request to the Durable Object
    return stub.fetch(request);
  },
};