# Scrum Poker Application

This project is a real-time Scrum Poker application built with a Node.js/Express backend and a React frontend. It uses Socket.IO for real-time communication.

## Features

*   Create and join game rooms.
*   Password protection for game rooms.
*   Real-time updates for participants joining and voting.
*   Host controls for managing tasks and revealing votes.
*   Task-based estimation.
*   Visual representation of votes (Pie Chart).
*   Export task estimation reports.

## Prerequisites

*   [Node.js](https://nodejs.org/) (v14.x or later recommended)
*   [npm](https://www.npmjs.com/) (usually comes with Node.js) or [Yarn](https://yarnpkg.com/)

## Project Structure

```
scrum-poker/
├── client/         # React frontend application
├── server.js       # Node.js/Express backend server
├── package.json    # Backend dependencies
└── README.md
```

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/newa-pasa/scrum-poker
    cd scrum-poker
    ```

2.  **Set up the Server:**
    *   Navigate to the `server` directory:
        ```bash
        cd server
        ```
    *   Install backend dependencies:
        ```bash
        npm install
        # or
        yarn install
        ```
    *   Go back to the project root directory:
        ```bash
        cd ..
        ```

3.  **Set up the Client:**
    *   Navigate to the `client` directory:
        ```bash
        cd client
        ```
    *   Install frontend dependencies:
        ```bash
        npm install
        # or
        yarn install
        ```
    *   Go back to the project root directory:
        ```bash
        cd ..
        ```

## Running the Application

You need to run both the server and the client separately.

1.  **Start the Server:**
    *   In the project root directory (`scrum-poker/`), run:
        ```bash
        node server.js
        # or, if you have nodemon installed for development:
        # nodemon server.js
        ```
    *   The server will typically start on `http://localhost:3001`. Check the console output for the exact URL.

2.  **Start the Client (React App):**
    *   Open a new terminal window/tab.
    *   Navigate to the `client` directory:
        ```bash
        cd client
        ```
    *   Run the React development server:
        ```bash
        npm start
        # or
        yarn start
        ```
    *   The client application will typically open automatically in your browser at `http://localhost:3000`.

3.  **Access the Application:**
    *   Open your web browser and go to `http://localhost:3000`.

## Development Notes

*   The server uses port `3001` by default.
*   The client (React dev server) uses port `3000` by default.
*   CORS is configured on the server to allow requests from `http://localhost:3000`. If you change the client port, you'll need to update the CORS configuration in `server.js`.
*   **Important**: The server currently uses an in-memory store for all game data (games, participants, tasks, votes). This means all data will be lost if the server is restarted. For persistent storage, a database solution would need to be implemented.

## Building for Production (Client)

To create a production build of the React client:

1.  Navigate to the `client` directory:
    ```bash
    cd client
    ```
2.  Run the build command:
    ```bash
    npm run build
    # or
    yarn build
    ```
    This will create an optimized static build in the `client/build` folder. The `server.js` is already configured to serve these static files if it detects a production environment (though this setup might need further refinement for a robust production deployment).

## Running the Application with Docker Compose

This is the recommended way to run the application for a consistent environment, especially for development mimicking production or for deployment.

**Prerequisites:**
*   Docker
*   Docker Compose

**Steps:**

1.  **Ensure Docker images are built and pushed to the registry** specified in `docker-compose.yml` (e.g., `ghcr.io/newa-pasa/scrum-poker/client:latest` and `ghcr.io/newa-pasa/scrum-poker/server:latest`). If you have local Dockerfiles for client and server, you can also build them locally using `docker-compose build`.

2.  **Start the application:**
    *   From the project root directory (`scrum-poker/`), run:
        ```bash
        docker-compose up -d
        ```

3.  **Access the Application:**
    *   Client (Frontend): Open your web browser and go to `http://localhost:8080` (as mapped in `docker-compose.yml`).
    *   Server (Backend API): Accessible via the client proxy. The server container itself is mapped to host port `3000` (e.g., `http://localhost:3000/api/...` if accessed directly, but typically accessed through the client at `http://localhost:8080/api/...`).
