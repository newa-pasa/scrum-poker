import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import { Container, Navbar, NavbarBrand } from 'reactstrap';
import GamesList from './components/GamesList';
import GameDetail from './components/GameDetail';

function App() {
  return (
    <Router>
      <div className="d-flex flex-column min-vh-100">
        <Navbar color="dark" dark expand="md" className="mb-3 shadow-sm">
          <Container>
            <NavbarBrand tag={Link} to="/" className="fw-bold fs-4">
              Game Lobby
            </NavbarBrand>
            {/* You can add NavbarToggler and Collapse here if you need a responsive navbar */}
          </Container>
        </Navbar>

        <main>
          <Routes>
            <Route path="/" element={<GamesList />} />
            <Route path="/game/:id" element={<GameDetail />} />
          </Routes>
        </main>

        <footer className="bg-light text-center text-lg-start mt-auto">
          <div className="text-center p-3" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
            © {new Date().getFullYear()} Scrum Poker
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;