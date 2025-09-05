import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GamePhase, type Player, type Question, type GameState, type PlayerAnswer } from './types';
import { GAME_SETTINGS, SHAPES, SHAPE_COLORS, COLORS } from './constants';
// fetchQuizQuestions is no longer needed on the client, as the server will handle it.
// import { fetchQuizQuestions } from './services/geminiService';
import Spinner from './components/Spinner';
import ProgressBar from './components/ProgressBar';

// The generateGameCode function is now only used on the Host side initially.
const generateGameCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};


// --- NEW: WebSocket Communication Hook (Replaces all localStorage logic) ---
const useWebSocketGame = (gameCode: string | null) => {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const socketRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!gameCode) return;

        // Construct the WebSocket URL to connect to our Cloudflare Worker
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/api/game/${gameCode}`;
        
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
            console.log("WebSocket connected!");
            // The client can send an initial message to request the current state
            sendMessage('request_state', {});
        };

        socket.onmessage = (event) => {
            const receivedState = JSON.parse(event.data);
            setGameState(receivedState);
        };

        socket.onclose = () => console.log("WebSocket disconnected.");
        socket.onerror = (error) => console.error("WebSocket error:", error);

        // Cleanup on component unmount
        return () => {
            socket.close();
        };
    }, [gameCode]);

    // Function to send messages to the server (Durable Object)
    const sendMessage = (type: string, payload: any) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type, payload }));
        } else {
            console.error("Cannot send message, WebSocket is not open.");
        }
    };

    return { gameState, sendMessage };
};


// --- Player Component ---
const PlayerExperience: React.FC<{ gameCode: string }> = ({ gameCode }) => {
    // REPLACED: useGameSync is replaced with our new WebSocket hook
    const { gameState, sendMessage } = useWebSocketGame(gameCode);
    const [playerName, setPlayerName] = useState<string>('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    
    const hasJoined = useMemo(() => {
        return !!gameState?.players.find(p => p.name === playerName);
    }, [gameState?.players, playerName]);

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!playerName.trim()) {
            setError('Please enter a name.');
            return;
        }
        // Instead of writing to localStorage, we send a 'join' message to the server
        sendMessage('join', { name: playerName });
        setSubmitted(true);
    };

    // This effect handles the "Game not found" error.
    // If we are submitted but the game state never loads, it means the game doesn't exist.
    useEffect(() => {
        if (submitted && !hasJoined) {
            const timer = setTimeout(() => {
                if (!gameState) {
                     setError('Game not found. Check the code and try again.');
                     setSubmitted(false); // Allow the user to try again
                }
            }, 3000); // Wait 3 seconds for a response
            return () => clearTimeout(timer);
        }
    }, [submitted, gameState, hasJoined]);


    if (!submitted || !hasJoined) {
        return (
            <main className={`min-h-screen ${COLORS.purple} text-white flex flex-col items-center justify-center p-4`}>
                <form onSubmit={handleJoin} className="w-full max-w-sm bg-gray-700 p-8 rounded-lg shadow-2xl">
                    <h2 className="text-3xl font-bold mb-6 text-center text-white">Join Game: {gameCode}</h2>
                     <div className="mb-6">
                        <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="nickname">
                            Nickname
                        </label>
                        <input
                            id="nickname"
                            type="text"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-3 px-4 bg-gray-800 text-white leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="Your Name"
                        />
                    </div>
                    {error && <p className="text-red-400 text-xs italic mb-4">{error}</p>}
                    <button type="submit" className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg focus:outline-none focus:shadow-outline w-full text-lg">
                        Enter
                    </button>
                </form>
            </main>
        );
    }
    
    if (!gameState) return <main className={`min-h-screen ${COLORS.purple} text-white flex flex-col items-center justify-center p-4`}><Spinner/> Loading game...</main>;

    const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
    const playerAnswersForQuestion = gameState.answers[gameState.currentQuestionIndex] || [];
    const myAnswer = playerAnswersForQuestion.find(a => a.playerName === playerName);
    const myPlayer = gameState.players.find(p => p.name === playerName);
    
    const handleAnswerSelect = (answerIndex: number) => {
        if (myAnswer) return;
        // REPLACED: submitPlayerAnswer is now a 'answer' message to the server
        sendMessage('answer', { answerIndex, playerName });
    };
    
    const renderContent = () => {
        // ... (The rest of the rendering logic inside PlayerExperience remains largely the same)
        switch (gameState.gamePhase) {
            case GamePhase.LOBBY:
                return <h2 className="text-3xl font-bold text-white">Welcome, {playerName}! Waiting for host to start...</h2>;
            case GamePhase.LOADING_QUESTIONS:
                return <h2 className="text-3xl font-bold text-white animate-pulse">Host is preparing the quiz...</h2>;
            case GamePhase.QUESTION_INTRO:
                return (
                    <div className="text-center">
                         <h1 className="text-5xl font-bold my-8 leading-tight text-white">{currentQuestion?.question}</h1>
                         <h2 className="text-3xl font-bold text-white">Get ready!</h2>
                    </div>
                );
            case GamePhase.QUESTION_ACTIVE:
            case GamePhase.QUESTION_RESULT:
                 if (!currentQuestion) return <div>Waiting for question...</div>
                 return (
                    <div className="w-full max-w-4xl flex flex-col items-center">
                        <h2 className="text-xl text-center mb-4 text-gray-300">{currentQuestion.question}</h2>
                        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentQuestion.options.map((_, index) => {
                                const isSelected = myAnswer?.answerIndex === index;
                                const isCorrect = currentQuestion.correctAnswerIndex === index;
                                let buttonClass = SHAPE_COLORS[index];
                                if (myAnswer) {
                                    if (isCorrect) buttonClass = 'bg-green-500';
                                    else if (isSelected) buttonClass = 'bg-red-700';
                                    else buttonClass = 'bg-gray-600 opacity-50';
                                }

                                return (
                                <button
                                    key={index}
                                    onClick={() => handleAnswerSelect(index)}
                                    disabled={!!myAnswer}
                                    className={`flex items-center p-4 rounded-lg text-white font-bold text-xl transition-all duration-300 transform ${buttonClass} ${!myAnswer ? 'hover:scale-105' : ''}`}
                                >
                                    <div className="w-12 h-12 bg-white bg-opacity-20 flex items-center justify-center rounded-md mr-4 fill-current">
                                        {SHAPES[index]}
                                    </div>
                                </button>
                                );
                            })}
                        </div>
                        <div className="mt-6 text-2xl font-bold">
                            {myAnswer && (myAnswer.answerIndex === currentQuestion.correctAnswerIndex ? 'Correct!' : 'Incorrect')}
                        </div>
                    </div>
                 );
            case GamePhase.LEADERBOARD:
                 return (
                    <div className="text-center">
                        <h2 className="text-3xl font-bold text-yellow-300 mb-4">Your Score: {myPlayer?.score}</h2>
                        {myPlayer?.lastScoreGained && myPlayer.lastScoreGained > 0 && 
                            <p className="text-green-400 text-2xl">+{myPlayer.lastScoreGained}</p>}
                    </div>
                 );
            case GamePhase.FINAL_RESULT:
                 const rank = [...gameState.players].sort((a,b)=>b.score - a.score).findIndex(p => p.name === playerName) + 1;
                 return (
                    <div className="text-center">
                        <h1 className="text-5xl font-bold text-yellow-300 mb-4">Game Over!</h1>
                        <h2 className="text-3xl text-white">You placed #{rank}!</h2>
                        <p className="text-2xl mt-2">Final Score: {myPlayer?.score}</p>
                    </div>
                 );
            default:
                return <h2 className="text-3xl font-bold text-white">Connecting...</h2>;
        }
    };
    
    return <main className={`min-h-screen ${COLORS.purple} text-white flex flex-col items-center justify-center p-4`}>{renderContent()}</main>;
};


// --- Host Component ---
const HostExperience: React.FC = () => {
    // Host now uses the state to manage the game code
    const [gameCode, setGameCode] = useState<string | null>(null);
    // REPLACED: useGameSync is replaced with our new WebSocket hook
    const { gameState, sendMessage } = useWebSocketGame(gameCode);

    // LOGIC MOVED: All timer and game phase progression logic (useEffect) has been removed.
    // The server (Durable Object) is now the single source of truth for the game state
    // and is responsible for all timers and advancing the game phase.

    const sortedPlayers = useMemo(() => {
        if (!gameState?.players) return [];
        return [...gameState.players].sort((a, b) => b.score - a.score);
    }, [gameState?.players]);

    const handleCreateGame = () => {
        const newGameCode = generateGameCode();
        setGameCode(newGameCode);
        // The act of connecting to the WebSocket with this new code will "create" the game room.
        // We can send an initial message to set up the game.
        sendMessage('create', { gameCode: newGameCode });
    };

    const handleStartGame = async () => {
        // REPLACED: updateGameState is now a 'start' message to the server
        sendMessage('start', {});
    };

    const renderHome = () => (
        <div className="text-center">
            <h1 className="text-6xl font-bold mb-4 text-yellow-300">Quiz Quest</h1>
            <p className="text-xl mb-8 text-gray-300">The ultimate trivia challenge!</p>
            <button
                onClick={handleCreateGame}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-10 rounded-lg text-2xl transition-transform transform hover:scale-105"
            >
                Create Game
            </button>
        </div>
    );
    
    const renderLobby = () => {
        if (!gameCode) return null;
        const joinUrl = `${window.location.origin}${window.location.pathname}?gameCode=${gameCode}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`;

        return (
            <div className="w-full max-w-4xl text-center">
                <h2 className="text-3xl text-gray-300 mb-4">Join the Game!</h2>
                <div className="bg-white p-4 inline-block rounded-lg mb-4">
                    <img src={qrUrl} alt="Join Game QR Code" />
                </div>
                <p className="text-7xl font-bold text-white tracking-widest my-6 bg-gray-900 bg-opacity-50 py-4 px-8 rounded-lg inline-block">{gameCode}</p>
                <h3 className="text-2xl mb-4">Players ({gameState?.players.length ?? 0}):</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8 min-h-[6rem]">
                    {gameState?.players.map(p => (
                        <div key={p.name} className="bg-gray-700 p-4 rounded-lg shadow-lg">
                            <span className="text-lg text-white font-semibold">{p.name}</span>
                        </div>
                    ))}
                </div>
                <button 
                    onClick={handleStartGame} 
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-10 rounded-lg text-2xl disabled:bg-gray-500 disabled:cursor-not-allowed"
                    disabled={!gameState?.players || gameState.players.length === 0}
                >
                    Start Game!
                </button>
            </div>
        )
    };
    
    // ... The rest of the HostExperience rendering logic is largely the same,
    // as it just renders the state received from the server.
    const renderLoading = () => (
        <div className="text-center">
            <Spinner className="w-24 h-24 mx-auto mb-6" />
            <h2 className="text-3xl text-white font-bold animate-pulse">Generating your quiz...</h2>
        </div>
    );
    
    const currentQuestion = gameState?.questions[gameState.currentQuestionIndex];
    
    const renderQuestionIntro = () => (
        <div className="text-center text-white">
            <p className="text-2xl">Question {gameState!.currentQuestionIndex + 1}</p>
            <h1 className="text-5xl font-bold my-8 leading-tight">{currentQuestion?.question}</h1>
        </div>
    );

    const renderQuestion = () => {
        if (!currentQuestion) return null;
        const answersForQuestion = gameState?.answers[gameState.currentQuestionIndex] || [];

        return (
             <div className="w-full max-w-4xl flex flex-col items-center">
                <div className="w-full bg-gray-700 p-6 rounded-lg shadow-2xl mb-6 text-center">
                    <h2 className="text-3xl font-bold text-white leading-tight">{currentQuestion.question}</h2>
                </div>
                <div className="w-full flex justify-between items-center mb-4">
                     <div className="text-3xl font-bold bg-white text-gray-900 rounded-full w-16 h-16 flex items-center justify-center shadow-lg">{/* Timer is now managed by server */}</div>
                     <div className="flex-grow mx-4">
                        <ProgressBar progress={100} /> {/* Progress bar can be driven by server state */}
                     </div>
                     <div className="text-lg text-white">{answersForQuestion.length} / {gameState?.players.length} Answered</div>
                </div>
                <div className="w-full grid grid-cols-2 gap-4">
                    {currentQuestion.options.map((option, index) => {
                        const isCorrect = currentQuestion.correctAnswerIndex === index;
                         let buttonClass = SHAPE_COLORS[index];
                        if (gameState?.gamePhase === GamePhase.QUESTION_RESULT) {
                             if (!isCorrect) buttonClass += ' opacity-40';
                        }

                        return (
                            <div key={index} className={`flex items-center p-4 rounded-lg text-white font-bold text-xl transition-all duration-300 ${buttonClass}`}>
                                <div className="w-12 h-12 bg-white bg-opacity-20 flex items-center justify-center rounded-md mr-4 fill-current">
                                    {SHAPES[index]}
                                </div>
                                <span className="text-left flex-1">{option}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderLeaderboard = () => (
        <div className="w-full max-w-md">
            <h2 className="text-4xl font-bold text-center text-yellow-300 mb-6">Leaderboard</h2>
            <div className="space-y-3">
                {sortedPlayers.map((p, index) => (
                    <div key={p.name} className="flex items-center justify-between bg-gray-700 p-3 rounded-lg text-white text-xl">
                        <div className="flex items-center">
                            <span className="font-bold w-8">{index + 1}.</span>
                            <span>{p.name}</span>
                        </div>
                        <div className="flex items-center">
                           <span className="font-bold">{p.score}</span>
                           {p.lastScoreGained !== undefined && p.lastScoreGained > 0 && 
                               <span className="text-green-400 text-sm ml-2">+{p.lastScoreGained}</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderFinalResult = () => (
         <div className="w-full max-w-lg text-center">
            <h1 className="text-5xl font-bold text-yellow-300 mb-4">Final Results!</h1>
            <div className="flex justify-center items-end space-x-4 mt-8">
                {sortedPlayers[1] && (
                    <div className="flex flex-col items-center">
                        <div className="text-2xl font-bold text-gray-300">{sortedPlayers[1].name}</div>
                        <div className="bg-gray-400 text-gray-800 w-32 h-24 flex flex-col justify-center items-center rounded-t-lg shadow-lg">
                            <div className="text-4xl font-bold">2</div>
                            <div className="font-semibold">{sortedPlayers[1].score}</div>
                        </div>
                    </div>
                )}
                {sortedPlayers[0] && (
                     <div className="flex flex-col items-center">
                        <div className="text-3xl font-bold text-yellow-300">{sortedPlayers[0].name}</div>
                        <div className="bg-yellow-400 text-yellow-900 w-40 h-32 flex flex-col justify-center items-center rounded-t-lg shadow-2xl">
                            <div className="text-5xl font-bold">1</div>
                            <div className="font-semibold">{sortedPlayers[0].score}</div>
                        </div>
                    </div>
                )}
                {sortedPlayers[2] && (
                    <div className="flex flex-col items-center">
                        <div className="text-xl font-bold text-orange-400">{sortedPlayers[2].name}</div>
                        <div className="bg-orange-500 text-orange-900 w-28 h-20 flex flex-col justify-center items-center rounded-t-lg shadow-md">
                            <div className="text-3xl font-bold">3</div>
                            <div className="font-semibold">{sortedPlayers[2].score}</div>
                        </div>
                    </div>
                )}
            </div>
            <button onClick={handleCreateGame} className="mt-12 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-xl">
                Play Again
            </button>
        </div>
    );

    const renderContent = () => {
        // If there's a gameCode but no gameState yet, we are connecting.
        if (gameCode && !gameState) {
             return <main className={`min-h-screen ${COLORS.purple} text-white flex flex-col items-center justify-center p-4`}><Spinner/> Connecting...</main>;
        }
        if (!gameState) return renderHome();
        
        switch(gameState.gamePhase) {
            case GamePhase.LOBBY: return renderLobby();
            case GamePhase.LOADING_QUESTIONS: return renderLoading();
            case GamePhase.QUESTION_INTRO: return renderQuestionIntro();
            case GamePhase.QUESTION_ACTIVE: return renderQuestion();
            case GamePhase.QUESTION_RESULT: return renderQuestion();
            case GamePhase.LEADERBOARD: return renderLeaderboard();
            case GamePhase.FINAL_RESULT: return renderFinalResult();
            default: return renderHome();
        }
    };
    
     return (
        <main className={`min-h-screen ${COLORS.purple} text-white flex flex-col items-center justify-center p-4`}>
            {renderContent()}
        </main>
    );
}

// --- App Router (No changes needed here) ---
export default function App() {
    const [mode, setMode] = useState<'loading' | 'host' | 'player'>('loading');
    const [gameCode, setGameCode] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('gameCode');
        if (code) {
            setGameCode(code.toUpperCase());
            setMode('player');
        } else {
            setMode('host');
        }
    }, []);

    if (mode === 'loading') {
        return <main className={`min-h-screen ${COLORS.purple} text-white flex items-center justify-center`}><Spinner/></main>;
    }

    return mode === 'player'
        ? <PlayerExperience gameCode={gameCode!} />
        : <HostExperience />;
}