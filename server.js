const express = require('express');
const app = express();
const http = require('http');
const { Server } = require("socket.io");
const path = require('path'); // For serving static files
const port = 3001;

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // Your React app's origin
        methods: ["GET", "POST"]
    }
});

// Middleware to parse URL-encoded bodies (as sent by HTML forms or similar client configurations)
app.use(express.urlencoded({ extended: true }));
// Middleware to parse JSON bodies
app.use(express.json());
// In-memory store for games
let games = [];
let nextGameId = games.length > 0 ? Math.max(...games.map(g => parseInt(g.id, 10))) + 1 : 1;
let nextUserId = 1; // Simple way to assign unique IDs to users joining

// --- API Routes ---

// API: Get all active games
app.get('/api/games', (req, res) => {
    const activeGames = games
        .filter(game => game.status === 'active');
        // .map(g => ({ id: g.id, name: g.name })); // Send full game object or just id/name
    if (activeGames.length > 0) {
        res.json(activeGames.map(g => ({ id: g.id, name: g.name }))); // Sending only id and name for the list
    } else {
        res.json([]); // Send an empty array if no games are found
    }
});

// API: Create a new game
app.post('/api/games', (req, res) => {
    const { name, password, estimates, hostName } = req.body;

    if (!name || name.trim() === '') {
        res.status(400).json({ message: 'Game name is required.' });
        return;
    }
    if (!password || password.trim() === '') {
        res.status(400).json({ message: 'Game password is required.' });
        return;
    }
    if (!hostName || hostName.trim() === '') {
        res.status(400).json({ message: 'Host name is required.' });
        return;
    }

    let estimatesArray = [];
    if (estimates && typeof estimates === 'string') {
        estimatesArray = estimates.split(',').map(e => e.trim()).filter(e => e !== '');
    } else if (Array.isArray(estimates)) { // Handle if it's already an array (less likely with current client)
        estimatesArray = estimates.map(e => String(e).trim()).filter(e => e !== '');
    }

    const hostId = `user-${nextUserId++}`;
    const hostParticipant = { id: hostId, name: hostName.trim(), vote: null, hasVoted: false };

    const newGame = {
        id: String(nextGameId++),
        name: name.trim(),
        hostId: hostId,
        password: password, // Store password; ensure this is handled securely in a real app
        participants: [hostParticipant], // Add host as the first participant
        observers: [],
        estimates: estimatesArray, // Store the parsed array of estimates
        tasks: [], // Initialize tasks array
        currentTaskId: null, // No task is initially being voted on
        votesRevealed: false,
        status: 'active' // New games are active by default
    };
    games.push(newGame);
    res.status(201).json({ gameId: newGame.id, host: hostParticipant, message: 'Game created successfully.' });
});

// API: Get details for a specific game
app.get('/api/game/:id', (req, res) => {
    const gameId = req.params.id;
    const game = games.find(g => g.id === gameId);

    if (!game) {
        res.status(404).json({ message: 'Game not found' });
        return;
    }
    // Send a copy of the game object, omitting sensitive data like password
    const { password, ...gameData } = game;
    res.json(gameData);
});

// API: Handle joining a game
app.post('/api/game/:id/join', (req, res) => {
    const gameId = req.params.id;
    const { userName, role, gamePassword } = req.body; // role will be 'participant' or 'observer'

    const game = games.find(g => g.id === gameId);

    if (!game) {
        res.status(404).json({ message: 'Game not found. Cannot join.' });
        return;
    }
    if (!userName || userName.trim() === '') {
        res.status(400).json({ message: 'User name is required.' });
        return;
    }
    // Check password
    if (game.password !== gamePassword) {
        res.status(401).json({ message: 'Incorrect game password.' });
        return;
    }

    const user = { id: `user-${nextUserId++}`, name: userName.trim() };
    const participantDetails = { ...user, vote: null, hasVoted: false }; // Add voting state

    let joined = false;
    let joinedUserDetails = null; // To send back the ID of the joined user

    if (role === 'participant' && !game.participants.find(p => p.name === user.name)) {
        game.participants.push(participantDetails);
        joinedUserDetails = participantDetails;
        joined = true;
    } else if (role === 'observer' && !game.observers.find(o => o.name === user.name)) {
        game.observers.push(user);
        joined = true;
    }

    if (joined) {
        const { password, ...updatedGameData } = game; // Send back updated game data without password
        // Include the ID of the user who just joined if they are a participant
        const responsePayload = { message: `${user.name} joined as ${role}.`, game: updatedGameData };
        if (role === 'participant' && joinedUserDetails) {
            responsePayload.joinedUser = { id: joinedUserDetails.id, name: joinedUserDetails.name };
        }
        res.json(responsePayload);
        // Emit an event to all clients in this game room that the game state has been updated
        io.to(gameId).emit('game_updated', updatedGameData);
    } else {
        res.status(409).json({ message: `${user.name} is already a ${role} in this game or could not join.` });
    }
});

// API: Record a vote for a participant
app.post('/api/game/:gameId/vote', (req, res) => {
    const { gameId } = req.params;
    const { userId, estimate } = req.body;

    const game = games.find(g => g.id === gameId);
    if (!game) {
        return res.status(404).json({ message: 'Game not found.' });
    }

    if (!game.currentTaskId) {
        return res.status(400).json({ message: 'No task is currently selected for voting.' });
    }

    const currentTask = game.tasks.find(t => t.id === game.currentTaskId);
    if (!currentTask) {
        // This should ideally not happen if currentTaskId is valid
        return res.status(404).json({ message: 'Current task not found.' });
    }

    const participant = game.participants.find(p => p.id === userId);
    if (!participant) {
        return res.status(404).json({ message: 'Participant not found in this game.' });
    }

    // Store vote on the main participant object for current round UI
    participant.vote = estimate;
    participant.hasVoted = true;

    // Store/update vote within the task's participantVotes
    const existingVoteIndex = currentTask.participantVotes.findIndex(v => v.userId === userId);
    if (existingVoteIndex > -1) {
        currentTask.participantVotes[existingVoteIndex].vote = estimate;
    } else {
        currentTask.participantVotes.push({ userId: userId, userName: participant.name, vote: estimate });
    }

    res.json({ message: `Vote recorded for ${participant.name}.`, participant });
    const { password, ...gameDataForEmit } = game;
    io.to(gameId).emit('game_updated', gameDataForEmit);
});

// API: Reveal votes for a game
app.post('/api/game/:gameId/reveal', (req, res) => {
    const { gameId } = req.params;
    const { userId } = req.body; // ID of the user attempting to reveal

    const game = games.find(g => g.id === gameId);
    if (!game) {
        return res.status(404).json({ message: 'Game not found.' });
    }

    if (game.hostId !== userId) {
        return res.status(403).json({ message: 'Only the host can reveal votes.' });
    }

    const currentTask = game.tasks.find(t => t.id === game.currentTaskId);
    if (!currentTask) {
        return res.status(400).json({ message: 'No task is currently active for revealing votes.' });
    }

    game.votesRevealed = true;
    // The actual votes are already in currentTask.participantVotes
    // No need to change task status here, that happens with agree-estimate

    res.json({ message: `Votes revealed for task: ${currentTask.name}.`, game });
    const { password, ...gameDataForEmit } = game;
    io.to(gameId).emit('game_updated', gameDataForEmit);
});

// API: Host adds a new task to a game
app.post('/api/game/:gameId/tasks', (req, res) => {
    const { gameId } = req.params;
    const { taskName, userId } = req.body; // userId is the host's ID

    const game = games.find(g => g.id === gameId);
    if (!game) {
        return res.status(404).json({ message: 'Game not found.' });
    }

    if (game.hostId !== userId) {
        return res.status(403).json({ message: 'Only the host can add tasks.' });
    }

    if (!taskName || taskName.trim() === '') {
        return res.status(400).json({ message: 'Task name is required.' });
    }

    const newTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, // Simple unique ID
        name: taskName.trim(),
        status: 'pending', // initial status
        participantVotes: [],
        agreedEstimate: null
    };
    game.tasks.push(newTask);
    res.status(201).json({ message: 'Task added successfully.', task: newTask, game });
    const { password, ...gameDataForEmit } = game;
    io.to(gameId).emit('game_updated', gameDataForEmit);
});

// API: Host starts voting for a specific task
app.post('/api/game/:gameId/tasks/:taskId/start-voting', (req, res) => {
    const { gameId, taskId } = req.params;
    const { userId } // Host's ID from request body
 = req.body;

    const game = games.find(g => g.id === gameId);
    if (!game) {
        return res.status(404).json({ message: 'Game not found.' });
    }

    if (game.hostId !== userId) {
        return res.status(403).json({ message: 'Only the host can start estimations.' });
    }

    const taskToStart = game.tasks.find(t => t.id === taskId);
    if (!taskToStart) {
        return res.status(404).json({ message: 'Task not found.' });
    }

    game.currentTaskId = taskId;
    game.votesRevealed = false; // Reset reveal state for the new task voting
    taskToStart.status = 'voting'; // Update task status

    // Reset voting status for all participants for this new round
    game.participants.forEach(p => {
        p.vote = null;
        p.hasVoted = false;
    });

    res.json({ message: `Estimation started for task: ${taskToStart.name}.`, game });
    const { password, ...gameDataForEmit } = game;
    io.to(gameId).emit('game_updated', gameDataForEmit);
});

// API: Host sets the agreed estimate for a task
app.post('/api/game/:gameId/tasks/:taskId/agree-estimate', (req, res) => {
    const { gameId, taskId } = req.params;
    const { userId, agreedEstimate } = req.body;

    const game = games.find(g => g.id === gameId);
    if (!game) {
        return res.status(404).json({ message: 'Game not found.' });
    }

    if (game.hostId !== userId) {
        return res.status(403).json({ message: 'Only the host can set the agreed estimate.' });
    }

    const task = game.tasks.find(t => t.id === taskId);
    if (!task) {
        return res.status(404).json({ message: 'Task not found.' });
    }

    if (agreedEstimate === null || agreedEstimate === undefined || String(agreedEstimate).trim() === '') {
        return res.status(400).json({ message: 'Agreed estimate value is required.' });
    }

    task.agreedEstimate = String(agreedEstimate).trim();
    task.status = 'completed';

    // Clear currentTaskId and votesRevealed to allow estimation of other tasks
    game.currentTaskId = null; 
    game.votesRevealed = false; 

    res.json({ message: `Agreed estimate set for task: ${task.name}.`, game });
    const { password, ...gameDataForEmit } = game;
    io.to(gameId).emit('game_updated', gameDataForEmit);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join_game_room', (gameId) => {
        socket.join(gameId);
        console.log(`User ${socket.id} joined game room ${gameId}`);
        // Optionally, you could emit the current game state to the user who just joined
        // const game = games.find(g => g.id === gameId);
        // if (game) {
        //     const { password, ...gameData } = game;
        //     socket.emit('game_updated', gameData);
        // }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Serve React App (for production)
// This should come after all API routes
app.use(express.static(path.join(__dirname, 'client/build')));

// The "catchall" handler: for any request that doesn't match one above,
// send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

server.listen(port, () => { // Use server.listen instead of app.listen
    console.log(`Server running at http://localhost:${port}`);
    console.log(`API available. Frontend should be served separately in development or from client/build in production.`);
});
