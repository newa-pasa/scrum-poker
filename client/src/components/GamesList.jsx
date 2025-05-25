import React, { useState, useEffect } from 'react';
import {
  Container,
  Row,
  Col,
  Button,
  ListGroup,
  ListGroupItem,
  Spinner,
  Alert,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  FormGroup,
  Label,
  Input,
} from 'reactstrap';
import { Link, useNavigate } from 'react-router-dom';

function GamesList() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [newGamePassword, setNewGamePassword] = useState('');
  const [newGameHostName, setNewGameHostName] = useState('');
  const [newGameEstimates, setNewGameEstimates] = useState('0, 1, 2, 3, 5, 8, 13, 21, 34, 55'); // Default estimates
  const [submissionError, setSubmissionError] = useState(null);

  // State for Join Game Modal
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedGameToJoin, setSelectedGameToJoin] = useState(null);
  const [joinUserName, setJoinUserName] = useState('');
  const [joinGamePasswordInput, setJoinGamePasswordInput] = useState(''); // Password input for the join modal
  const [joinRole, setJoinRole] = useState('participant'); // Default role
  const [joinSubmissionError, setJoinSubmissionError] = useState(null);

  const navigate = useNavigate();

  const toggleModal = () => {
    setModalOpen(!modalOpen);
    setNewGameName('');
    setNewGamePassword('');
    setNewGameHostName('');
    setNewGameEstimates('0, 1, 2, 3, 5, 8, 13, 21, 34, 55'); // Reset to default on toggle
    setSubmissionError(null);
  };

  const toggleJoinModal = (game = null) => {
    if (game) {
      // Check if user has already joined this game from this browser
      const existingSessions = JSON.parse(localStorage.getItem('scrumPokerSessions') || '[]');
      const existingSessionForThisGame = existingSessions.find(s => s.gameId === game.id);

      if (existingSessionForThisGame) {
        // User has already joined this game. Set as current user and navigate.
        localStorage.setItem('currentUser', JSON.stringify({
          id: existingSessionForThisGame.userId, // This will be the server-assigned ID for participants
          name: existingSessionForThisGame.userName,
          gameId: game.id
        }));
        navigate(`/game/${game.id}`);
        return; // Don't open the modal
      }
    }

    // If not joined or no game provided (e.g., closing modal), proceed with modal toggle
    setJoinModalOpen(!joinModalOpen);
    setSelectedGameToJoin(game); // Store the game context when opening
    setJoinUserName('');
    setJoinGamePasswordInput(''); // Reset password input
    setJoinRole('participant');
    setJoinSubmissionError(null);
  };

  const updateJoinedSessions = (newSession) => {
    const existingSessions = JSON.parse(localStorage.getItem('scrumPokerSessions') || '[]');
    // Avoid duplicate entries if somehow this is called multiple times for the same join
    if (!existingSessions.find(s => s.gameId === newSession.gameId && s.userName === newSession.userName)) {
      existingSessions.push(newSession);
      localStorage.setItem('scrumPokerSessions', JSON.stringify(existingSessions));
    }
  };

  const fetchGames = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/games');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // alert(JSON.stringify(data)); // Removed alert
      setGames(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const handleNewGameSubmit = async (event) => {
    event.preventDefault();
    setSubmissionError(null);
    if (!newGameName.trim() || !newGamePassword.trim()) {
      setSubmissionError("Game name, password, and your name are required.");
      return;
    }
    if (!newGameHostName.trim()) {
      setSubmissionError("Your name (as host) is required.");
      return;
    }
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGameName, password: newGamePassword, estimates: newGameEstimates, hostName: newGameHostName }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      const hostUserDetails = {
        id: data.host.id,
        name: data.host.name,
        gameId: data.gameId
      };
      localStorage.setItem('currentUser', JSON.stringify(hostUserDetails));
      updateJoinedSessions({ 
        gameId: data.gameId, 
        userId: data.host.id, // Server provides host's ID
        userName: data.host.name, role: 'participant' }); // Host is a participant
      await fetchGames();
      toggleModal();
      navigate(`/game/${data.gameId}`); // Navigate to the new game
    } catch (e) {
      setSubmissionError(e.message);
    }
  };

  const handleJoinGameSubmit = async (event) => {
    event.preventDefault();
    setJoinSubmissionError(null);
    if (!joinUserName.trim()) {
      setJoinSubmissionError("Your name is required.");
      return;
    }
    if (!joinGamePasswordInput.trim()) {
      setJoinSubmissionError("Game password is required.");
      return;
    }
    if (!selectedGameToJoin || !selectedGameToJoin.id) {
      setJoinSubmissionError("No game selected to join. Please try again.");
      return;
    }

    try {
      const response = await fetch(`/api/game/${selectedGameToJoin.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: joinUserName, role: joinRole, gamePassword: joinGamePasswordInput }),
      });
      const data = await response.json(); // Always expect JSON back
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      const currentUserId = data.joinedUser?.id; // Server provides ID for participants
      const currentUserName = joinUserName;
      const currentGameId = selectedGameToJoin.id;

      // Store current user info if they joined as a participant and server returns their details
      // For observers, data.joinedUser might be undefined. We still set currentUser for context.
      localStorage.setItem('currentUser', JSON.stringify({ 
        id: currentUserId, // Will be undefined for observers if server doesn't send it
        name: currentUserName, 
        gameId: currentGameId 
      }));

      if (joinRole === 'participant' || joinRole === 'observer') { // Record session for both
        updateJoinedSessions({ gameId: currentGameId, userId: currentUserId, userName: currentUserName, role: joinRole });
      } else {
        // This case should ideally not happen with the select dropdown
      }
      toggleJoinModal(); // Close modal on success
      navigate(`/game/${selectedGameToJoin.id}`); // Navigate to the game detail page
    } catch (e) {
      setJoinSubmissionError(e.message);
    }
  };

  if (loading) return <Container className="text-center p-5"><Spinner color="primary">Loading...</Spinner></Container>;
  if (error) return <Container><Alert color="danger">Error fetching games: {error}</Alert></Container>;

  return (
    <Container>
      <Row className="mb-3 align-items-center">
        <Col>
          <h1 className="mb-0">Available Games</h1>
        </Col>
        <Col xs="auto">
          <Button color="success" onClick={toggleModal}>Create New Game</Button>
        </Col>
      </Row>
      <ListGroup>
        {games.map((game) => (
          <ListGroupItem key={game.id} className="d-flex justify-content-between align-items-center">
            <div>
              <Link to={`/game/${game.id}`} className="fw-bold text-decoration-none me-2">
                {game.name}
              </Link>
              <small className="text-muted">ID: {game.id}</small>
            </div>
            <Button color="primary" size="sm" onClick={() => toggleJoinModal(game)}>Join</Button>
          </ListGroupItem>
        ))}
        {games.length === 0 && <ListGroupItem>No games available. Create one!</ListGroupItem>}
      </ListGroup>

      <Modal isOpen={modalOpen} toggle={toggleModal}>
        <ModalHeader toggle={toggleModal}>Create New Game</ModalHeader>
        <Form onSubmit={handleNewGameSubmit}>
          <ModalBody>
            {submissionError && <Alert color="danger">{submissionError}</Alert>}
            <FormGroup>
              <Label for="newGameName">Game Name</Label>
              <Input
                type="text"
                name="newGameName"
                id="newGameName"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                placeholder="Enter game name"
              />
            </FormGroup>
            <FormGroup>
              <Label for="newGamePassword">Password</Label>
              <Input type="password" name="newGamePassword" id="newGamePassword" value={newGamePassword} onChange={(e) => setNewGamePassword(e.target.value)} placeholder="Enter a password for the game" />
            </FormGroup>
            <FormGroup>
              <Label for="newGameHostName">Your Name (Host)</Label>
              <Input
                type="text"
                name="newGameHostName"
                id="newGameHostName"
                value={newGameHostName}
                onChange={(e) => setNewGameHostName(e.target.value)}
                placeholder="Enter your name"
              />
            </FormGroup>
            <FormGroup>
              <Label for="newGameEstimates">Estimates (comma-separated)</Label>
              <Input
                type="text"
                name="newGameEstimates"
                id="newGameEstimates"
                value={newGameEstimates}
                onChange={(e) => setNewGameEstimates(e.target.value)}
                placeholder="e.g., 0, 1, 2, 3, 5, 8, 13, 21"
              />
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" type="submit">Create Game</Button>{' '}
            <Button color="secondary" onClick={toggleModal}>Cancel</Button>
          </ModalFooter>
        </Form>
      </Modal>

      {/* Join Game Modal */}
      <Modal isOpen={joinModalOpen} toggle={() => toggleJoinModal()}>
        <ModalHeader toggle={() => toggleJoinModal()}>Join Game: {selectedGameToJoin?.name}</ModalHeader>
        <Form onSubmit={handleJoinGameSubmit}>
          <ModalBody>
            {joinSubmissionError && <Alert color="danger">{joinSubmissionError}</Alert>}
            <FormGroup>
              <Label for="joinUserName">Your Name</Label>
              <Input
                type="text"
                name="joinUserName"
                id="joinUserName"
                value={joinUserName}
                onChange={(e) => setJoinUserName(e.target.value)}
                placeholder="Enter your name"
              />
            </FormGroup>
            <FormGroup>
              <Label for="joinGamePasswordInput">Game Password</Label>
              <Input
                type="password"
                name="joinGamePasswordInput"
                id="joinGamePasswordInput"
                value={joinGamePasswordInput}
                onChange={(e) => setJoinGamePasswordInput(e.target.value)}
                placeholder="Enter game password"
              />
            </FormGroup>
            <FormGroup>
              <Label for="joinRole">Join as</Label>
              <Input type="select" name="joinRole" id="joinRole" value={joinRole} onChange={(e) => setJoinRole(e.target.value)}>
                <option value="participant">Participant</option>
                <option value="observer">Observer</option>
              </Input>
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" type="submit">Join Game</Button>{' '}
            <Button color="secondary" onClick={() => toggleJoinModal()}>Cancel</Button>
          </ModalFooter>
        </Form>
      </Modal>
    </Container>
  );
}

export default GamesList;