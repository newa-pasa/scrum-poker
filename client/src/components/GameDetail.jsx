import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import io from 'socket.io-client';
import axios from 'axios';
import {
  Container,
  Card,
  CardBody,
  CardTitle,
  CardText,
  Button,
  Spinner,
  Alert,
  Row,
  Col,
  ListGroup, ListGroupItem,
  InputGroup, // For combining input and button
  Input, // For new task input
  Accordion,
  AccordionBody,
  AccordionHeader,
  AccordionItem,
  Badge,
  Modal as ReactstrapModal,
  ModalHeader as ReactstrapModalHeader,
  ModalBody as ReactstrapModalBody,
  ModalFooter as ReactstrapModalFooter,
  FormGroup, Label
} from 'reactstrap';
import './GameDetail.css'; // Import the new CSS

ChartJS.register(ArcElement, Tooltip, Legend);
const SOCKET_SERVER_URL = "http://localhost:3001"; // Your backend server URL

function GameDetail() {
  const { id: gameId } = useParams(); // Get game ID from URL
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [openAccordion, setOpenAccordion] = useState('1'); // Default to observers open
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [finalEstimateForModal, setFinalEstimateForModal] = useState('');

  useEffect(() => {
    // Load current user from localStorage
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // Ensure the stored user is for the current game
        if (parsedUser.gameId === gameId) {
          setCurrentUser(parsedUser);
        } else {
          localStorage.removeItem('currentUser'); // Stale user data
        }
      } catch (e) {
        localStorage.removeItem('currentUser'); // Invalid JSON
      }
    }

    // Fetch initial game details via HTTP
    const fetchGameDetails = async () => {
      setLoading(true);
      setError(null);
      if (gameId === 'new') {
        setLoading(false);
        setError("This page is for viewing existing games. To create a new game, go to the lobby.");
        setGame(null);
        return;
      }
      try {
        const response = await axios.get(`/api/game/${gameId}`);
        if (response.data && response.data.id) {
          setGame(response.data);
        } else {
          setError('Received invalid game data from server.');
          setGame(null);
        }
      } catch (err) {
        if (err.response) {
          if (err.response.data && err.response.data.message) {
            setError(err.response.data.message);
          } else {
            setError(`Error: ${err.response.status} - ${err.response.statusText}`);
          }
        } else if (err.request) {
          setError('No response from server. Please check your connection.');
        } else {
          setError(`Error: ${err.message}`);
        }
        setGame(null);
      } finally {
        setLoading(false);
      }
    };

    fetchGameDetails();

    // Setup Socket.IO connection
    const socket = io(SOCKET_SERVER_URL);

    // Join the specific game room
    if (gameId && gameId !== 'new') {
      socket.emit('join_game_room', gameId);
    }

    // Listen for game updates from the server
    socket.on('game_updated', (updatedGameData) => {
      console.log('Game updated via WebSocket:', updatedGameData);
      // Ensure the update is for the current game being viewed
      if (updatedGameData.id === gameId) {
        setGame(updatedGameData);
        // If the current user's vote was reset (e.g. new round), clear their selection
        const updatedCurrentUser = updatedGameData.participants.find(p => p.id === currentUser?.id);
        if (updatedCurrentUser && !updatedCurrentUser.hasVoted) {
          setSelectedEstimate(null);
        }
      }
    });

    // Cleanup on component unmount
    return () => {
      socket.disconnect();
    };
  }, [gameId, currentUser?.id]); // Added currentUser?.id to re-evaluate if user changes (though less likely here)

  if (loading) return <Container fluid className="text-center p-5"><Spinner color="primary">Loading Game...</Spinner></Container>;
  // Display error more prominently if it exists
  if (error && !game) return <Container fluid><Alert color="danger">{error}</Alert><Button tag={Link} to="/" color="primary" className="mt-2">Back to Lobby</Button></Container>;
  // If no game and no error (e.g., initial state or after 'new' gameId)
  if (!game) return <Container fluid><Alert color="info">Select a game from the lobby.</Alert><Button tag={Link} to="/" color="primary">Back to Lobby</Button></Container>;

  const visualTableRadius = 120; // Radius of the visual round table element
  const participantCardSize = 60; // Diameter of participant card (the circle)
  // Approximate height for the name label + margin, used for positioning wrapper
  const nameLabelHeightEstimate = 25;

  const getParticipantPosition = (index, totalParticipants) => {
    if (totalParticipants === 0) return {};

    // Radius for placing the center of participant representations
    const placementRadius = visualTableRadius + participantCardSize / 2 + 30; // 30px offset from table edge

    // Calculate the center of the participant wrapper
    const wrapperWidth = participantCardSize;
    const wrapperHeight = participantCardSize + nameLabelHeightEstimate;

    const angle = (index / totalParticipants) * 2 * Math.PI; // Angle in radians
    const x = visualTableRadius + placementRadius * Math.cos(angle) - (wrapperWidth / 2);
    const y = visualTableRadius + placementRadius * Math.sin(angle) - (wrapperHeight / 2);
    return {
      top: `${y}px`,
      left: `${x}px`,
    };
  };

  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleVote = async (estimateValue) => {
    if (!currentUser || !currentUser.id) {
      setError("Cannot vote. User information is missing. Please try re-joining.");
      return;
    }
    if (selectedEstimate === estimateValue) { // Deselect if clicking the same card
      setSelectedEstimate(null);
      // Optionally, send a "clear vote" request to server or handle locally
      return;
    }

    if (!game || !game.currentTaskId) {
      setError("No task is currently selected for voting. The host needs to start estimation for a task.");
      return;
    }
    setSelectedEstimate(estimateValue);
    try {
      await axios.post(`/api/game/${gameId}/vote`, {
        userId: currentUser.id,
        estimate: estimateValue,
      });
      // Optimistic UI update for the current user's selection
      // The server will broadcast the full game state update via WebSocket,
      // which will then update the `hasVoted` status for everyone.
      // We still update the local `game` state for the current user's `hasVoted`
      // to provide immediate feedback before the socket event arrives.
      setGame(prevGame => ({ ...prevGame, participants: prevGame.participants.map(p => p.id === currentUser.id ? { ...p, hasVoted: true, vote: estimateValue } : p) }));

    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to submit vote. Please try again.");
      setSelectedEstimate(null); // Revert selection on error
    }
  };

  const handleRevealVotes = async () => {
    if (!currentUser || currentUser.id !== game?.hostId) {
      setError("Only the host can reveal votes.");
      return;
    }
    try {
      await axios.post(`/api/game/${gameId}/reveal`, { userId: currentUser.id });
      // The server will emit 'game_updated' via WebSocket,
      // which will trigger a re-render with votesRevealed = true.
      // No immediate local state update for game.votesRevealed is strictly necessary here,
      // as the socket event will be the source of truth.
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to reveal votes.");
    }
  };

  const handleAddTask = async () => {
    if (!newTaskName.trim()) {
      setError("Task name cannot be empty.");
      return;
    }
    if (!currentUser || currentUser.id !== game?.hostId) {
      setError("Only the host can add tasks.");
      return;
    }
    try {
      await axios.post(`/api/game/${gameId}/tasks`, {
        taskName: newTaskName,
        userId: currentUser.id
      });
      setNewTaskName(''); // Clear input field
      // Server will emit 'game_updated' via WebSocket
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to add task.");
    }
  };

  const exportTaskReport = () => {
    if (!game || !game.tasks || game.tasks.length === 0) {
      alert("No tasks to export.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Task Name,Agreed Estimate,Status,Votes\n";

    game.tasks.forEach(task => {
      const votesString = task.participantVotes.map(v => `${v.userName}: ${v.vote}`).join('; ');
      csvContent += `"${task.name.replace(/"/g, '""')}","${task.agreedEstimate !== null ? String(task.agreedEstimate).replace(/"/g, '""') : ''}","${task.status}","${votesString.replace(/"/g, '""')}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${game.name.replace(/\s+/g, '_')}_task_report.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
  };

  const toggleAccordion = (id) => {
    setOpenAccordion(openAccordion === id ? '' : id);
  };

  const toggleFinalizeModal = () => {
    setFinalizeModalOpen(!finalizeModalOpen);
    if (finalizeModalOpen) setFinalEstimateForModal(''); // Reset on close
    setError(null); // Clear any previous errors when opening/closing modal
  };

  const handleSaveFinalEstimate = async () => {
    if (!currentUser || currentUser.id !== game?.hostId) {
      setError("Only the host can set the agreed estimate.");
      return;
    }
    const estimateValue = finalEstimateForModal;
    if (estimateValue === null || estimateValue === undefined || String(estimateValue).trim() === '') {
      setError("Please enter an agreed estimate value.");
      return;
    }

    try {
      if (!game || !game.currentTaskId) {
        setError("No active task to finalize."); // Should not happen if modal is open correctly
        return;
      }
      await axios.post(`/api/game/${gameId}/tasks/${game.currentTaskId}/agree-estimate`, {
        userId: currentUser.id,
        agreedEstimate: estimateValue
      });
      toggleFinalizeModal(); // Close modal on success
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to set agreed estimate.");
    }
  };

  const handleStartEstimation = async (taskId) => {
    if (!currentUser || currentUser.id !== game?.hostId) {
      setError("Only the host can start estimations.");
      return;
    }
    try {
      await axios.post(`/api/game/${gameId}/tasks/${taskId}/start-voting`, {
        userId: currentUser.id
      });
      setSelectedEstimate(null); // Clear current user's local selection
      // Server will emit 'game_updated' which will reset participant votes and set currentTaskId
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to start estimation for task.");
    }
  };

  // Prepare data for Pie chart
  const getPieChartData = () => {
    if (!currentVotingTask || !currentVotingTask.participantVotes || currentVotingTask.participantVotes.length === 0) {
      return null;
    }
    const votesCount = currentVotingTask.participantVotes.reduce((acc, vote) => {
      acc[vote.vote] = (acc[vote.vote] || 0) + 1;
      return acc;
    }, {});

    return {
      labels: Object.keys(votesCount),
      datasets: [
        {
          label: '# of Votes',
          data: Object.values(votesCount),
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7BC225'], // Example colors
          borderWidth: 1,
        },
      ],
    };
  };

  // Helper function to check if a string is a valid URL
  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const currentVotingTask = game && game.currentTaskId ? game.tasks.find(t => t.id === game.currentTaskId) : null;

  return (
    <Container fluid>
      <Button tag={Link} to="/" color="secondary" className="mb-3">
        &larr; Back to Lobby
      </Button>
      <h2 className="mb-3">{game.name}</h2>
      {error && <Alert color="warning" className="mb-3">Note: {error}</Alert>}

      <div className="game-room-container">
        <div className="game-area">
          <Row className="g-0 w-100"> {/* g-0 removes gutters, w-100 ensures full width */}
            <Col md="8"> {/* Left Side: Participants and Estimates */}
              <div className="participants-section h-100"> {/* h-100 to fill column height */}

                <div className="game-table-area"> {/* New wrapper for table and participants */}
                  <div className="round-table" style={{ width: `${visualTableRadius * 2}px`, height: `${visualTableRadius * 2}px` }}>
                    {/* Participant wrappers are now children of game-table-area, positioned relative to it */}
                    {game.participants && game.participants.map((p, index) => (
                      <div
                        key={p.id || `${p.name}-${index}`}
                        className="participant-wrapper"
                        style={getParticipantPosition(index, game.participants.length)}
                      >
                        <div
                          className={`participant-card ${p.hasVoted ? 'voted' : ''}`}
                          title={p.name}
                        >
                          {game.votesRevealed && currentVotingTask
                            ? (() => {
                              const taskVote = currentVotingTask.participantVotes.find(v => v.userId === p.id);
                              return taskVote ? taskVote.vote : '❔'; // Show actual vote or question mark if not voted for this task
                            })()
                            : (p.hasVoted
                              ? '✔'
                              : <span className="participant-initials">{getInitials(p.name)}</span>
                            )
                          }
                        </div>
                        <div className="participant-name-label">{p.name}</div>
                      </div>
                    ))}
                    <div className="reveal-button-container">
                      {!game.votesRevealed && currentVotingTask && (
                        <Button
                          color="danger"
                          size="lg"
                          onClick={handleRevealVotes}
                          disabled={!currentUser || currentUser.id !== game?.hostId}>
                          Reveal Votes
                        </Button>
                      )}
                      {game.votesRevealed && currentVotingTask && currentVotingTask.status !== 'completed' && (
                        <Button
                          color="success"
                          size="lg"
                          onClick={toggleFinalizeModal} // This was the missing piece
                          disabled={!currentUser || currentUser.id !== game?.hostId}>
                          Finalize Estimate
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="estimates-bar"> {/* Removed mt-auto, layout handled by flex parent */}
                  {currentVotingTask && game.estimates && game.estimates.length > 0 ? (
                    game.estimates.map((estimate, index) => (
                      <Button
                        key={`${estimate}-${index}`}
                        outline
                        color="secondary"
                        className={`estimate-card ${selectedEstimate === estimate ? 'active' : ''}`}
                        onClick={() => handleVote(estimate)}
                      >
                        {estimate}
                      </Button>
                    ))
                  ) : (
                    <p className="text-muted">{currentVotingTask ? "Estimates for voting." : "No task selected for estimation."}</p>
                  )}
                </div>
              </div>
            </Col>
            <Col md="4"> {/* Right Side: Observers and Tasks */}
              <div className="observers-section h-100"> {/* h-100 to fill column height */}
                <Accordion open={openAccordion} toggle={toggleAccordion} flush>
                  <AccordionItem>
                    <AccordionHeader targetId="1">
                      Observers ({game.observers ? game.observers.length : 0})
                    </AccordionHeader>
                    <AccordionBody accordionId="1">
                      {game.observers && game.observers.length > 0 ? (
                        <ListGroup flush>
                          {game.observers.map((o, index) => (
                            <ListGroupItem key={o.id || `${o.name}-${index}`} className="observer-item">
                              {o.name}
                            </ListGroupItem>
                          ))}
                        </ListGroup>
                      ) : (
                        <p className="text-muted">No observers in this game.</p>
                      )}
                    </AccordionBody>
                  </AccordionItem>
                  <AccordionItem>
                    <AccordionHeader targetId="2">
                      <div className="d-flex justify-content-between align-items-center w-100">
                        <span>Tasks ({game.tasks ? game.tasks.length : 0})</span>
                        {game && game.tasks && game.tasks.length > 0 && (
                          <Button color="outline-secondary" size="sm" onClick={exportTaskReport} className="ms-auto me-2">
                            Export Report
                          </Button>
                        )}
                      </div>
                    </AccordionHeader>
                    <AccordionBody accordionId="2">
                      {/* Host: Add Task Section - Moved here */}
                      {currentUser && game && currentUser.id === game.hostId && (
                        <div className="add-task-section mb-3"> {/* Adjusted margin */}
                          {/* <h6>Add New Task</h6>  Optional: smaller heading if needed */}
                          <InputGroup>
                            <Input
                              type="text"
                              value={newTaskName}
                              onChange={(e) => setNewTaskName(e.target.value)}
                              placeholder="Enter task description"
                              onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                              bsSize="sm" // Smaller input
                            />
                            <Button color="success" onClick={handleAddTask} size="sm"> {/* Smaller button */}
                              Add
                            </Button>
                          </InputGroup>
                        </div>
                      )}

                      {game.tasks && game.tasks.length > 0 ? (
                        <ListGroup flush>
                          {game.tasks.map((task) => (
                            <ListGroupItem key={task.id} className="task-item d-flex justify-content-between align-items-center">
                              <div>
                                {isValidUrl(task.name) ? (
                                  <a 
                                    href={task.name} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className={`task-name ${task.status === 'completed' ? 'text-decoration-line-through' : ''}`}
                                  >
                                    {task.name}
                                  </a>
                                ) : (
                                  <span className={`task-name ${task.status === 'completed' ? 'text-decoration-line-through' : ''}`}>
                                    {task.name}
                                  </span>
                                )}
                                {task.id === game.currentTaskId && <Badge color="info" className="ms-2">Voting Active</Badge>}
                                {task.status === 'completed' && <Badge color="success" className="ms-2">Completed</Badge>}
                                {task.agreedEstimate !== null && (
                                  <small className="text-muted ms-2"> (Agreed: {task.agreedEstimate})</small>
                                )}
                              </div>
                              {/* "Start Estimation" button logic */}
                              {currentUser && game && currentUser.id === game.hostId && task.status === 'pending' && !game.currentTaskId && (
                                <Button
                                  color="primary"
                                  size="sm"
                                  onClick={() => handleStartEstimation(task.id)}
                                >
                                  Start Estimation
                                </Button>
                              )}
                              {currentUser && game && currentUser.id === game.hostId && task.id === game.currentTaskId && !game.votesRevealed && (
                                <Button color="warning" size="sm" disabled>Voting in Progress...</Button>
                              )}
                            </ListGroupItem>
                          ))}
                        </ListGroup>
                      ) : (
                        <p className="text-muted">No tasks added yet.</p>
                      )}
                    </AccordionBody>
                  </AccordionItem>
                </Accordion>
              </div>
            </Col>
          </Row>
        </div>
      </div>
      <ReactstrapModal isOpen={finalizeModalOpen} toggle={toggleFinalizeModal} centered>
        <ReactstrapModalHeader toggle={toggleFinalizeModal}>
          Finalize Estimate for: {currentVotingTask?.name}
        </ReactstrapModalHeader>
        <ReactstrapModalBody>
          {currentVotingTask && currentVotingTask.participantVotes && currentVotingTask.participantVotes.length > 0 && getPieChartData() ? (
            <div style={{ maxWidth: '300px', margin: '0 auto 20px auto' }}>
              <Pie data={getPieChartData()} />
            </div>
          ) : (
            <p className="text-center text-muted">No votes recorded or data unavailable for chart.</p>
          )}
          <FormGroup>
            <Label for="finalEstimateInput">Final Agreed Estimate</Label>
            <Input
              type="text"
              id="finalEstimateInput"
              value={finalEstimateForModal}
              onChange={(e) => setFinalEstimateForModal(e.target.value)}
              placeholder="Enter final estimate"
            />
          </FormGroup>
          {error && <Alert color="danger" className="mt-2">{error}</Alert>} {/* Show errors within modal */}
        </ReactstrapModalBody>
        <ReactstrapModalFooter>
          <Button color="primary" onClick={handleSaveFinalEstimate}>Save Final Estimate</Button>{' '}
          <Button color="secondary" onClick={toggleFinalizeModal}>Cancel</Button>
        </ReactstrapModalFooter>
      </ReactstrapModal>
    </Container>
  );
}

export default GameDetail;