# Collaborative Code Editor

A real-time collaborative code editing platform built with React, Node.js, and Yjs. Multiple users can edit code simultaneously with live updates, integrated chat, and session management.

## Features

- **Real-time Collaborative Editing**: Multiple users can edit the same code simultaneously with live updates
- **File Tree Management**: Organize and manage project files through an intuitive sidebar
- **Live Chat**: Built-in chat panel for team communication
- **AI Chat Panel**: Integration with AI services for code assistance
- **Session Management**: Create, manage, and join editing sessions
- **Snapshot Control**: Save and restore code snapshots
- **Google OAuth Authentication**: Secure login with Google OAuth
- **Room Tokens**: Generate and manage access tokens for session rooms
- **Monaco Editor Integration**: Professional code editor with syntax highlighting

## Project Structure

```
├── backend/                    # Node.js backend server
│   ├── auth/                   # Authentication modules
│   ├── middleware/             # Express middleware
│   ├── models/                 # Database models
│   ├── routes/                 # API routes
│   ├── server.js               # Main server file
│   └── package.json
│
├── frontend/                   # React frontend application
│   ├── public/                 # Static assets
│   │   ├── index.html
│   │   └── monaco-editor/      # Monaco editor workers
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Page components
│   │   ├── context/            # React context
│   │   ├── hooks/              # Custom hooks
│   │   ├── utils/              # Utility functions
│   │   ├── api/                # API calls
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
│
├── y-server/                   # Yjs collaboration server
│   ├── server.js
│   └── y-server-auth.js
│
├── snapshot-server/            # Snapshot management server
│   ├── server.js
│   └── snapshots/              # Stored snapshots
│
└── README.md
```

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Git

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/PraveenPalkar18/CollabrativeCodeEditor.git
cd CollabrativeCodeEditor
```

### 2. Backend Setup

```bash
cd backend
npm install
# Configure environment variables in .env if needed
node server.js
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm start
```

### 4. Yjs Server Setup (for collaboration)

```bash
cd y-server
npm install
node server.js
```

### 5. Snapshot Server Setup

```bash
cd snapshot-server
npm install
node server.js
```

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
CALLBACK_URL=http://localhost:3001/auth/google/callback
PORT=3001
YJS_SERVER_URL=http://localhost:1234
SNAPSHOT_SERVER_URL=http://localhost:3003
```

## Usage

1. **Start all servers** (backend, frontend, y-server, snapshot-server)
2. **Open your browser** to `http://localhost:3000`
3. **Sign in** with your Google account
4. **Create or join a session** to start collaborating
5. **Invite teammates** by sharing the session URL or room token
6. **Edit code in real-time** with live updates and chat

## API Endpoints

### Authentication
- `GET /auth/google` - Initiate Google OAuth login
- `GET /auth/google/callback` - OAuth callback handler

### Sessions
- `GET /api/sessions` - List all sessions
- `POST /api/sessions` - Create a new session
- `GET /api/sessions/:id` - Get session details
- `PUT /api/sessions/:id` - Update session
- `DELETE /api/sessions/:id` - Delete session

### Room Tokens
- `POST /auth/room-token` - Generate room access token
- `GET /auth/room-token/:token` - Verify room token

## Key Components

### Frontend Components
- **EditorPanel**: Main code editor using Monaco
- **FileTreeSidebar**: File management interface
- **Chatbox**: Real-time messaging
- **AIChatPanel**: AI-powered code assistance
- **TeammatesList**: Display connected collaborators
- **CreateSessionModal**: Session creation dialog
- **InviteModal**: Invite teammates dialog
- **Topbar**: Navigation and controls

### Backend Models
- **User**: User account information
- **Room**: Collaboration room data
- **Message**: Chat messages
- **Session**: Editing session metadata

## Technologies Used

### Frontend
- React
- Monaco Editor
- Yjs (Collaborative editing)
- Socket.io (Real-time communication)
- CSS (Custom styling)

### Backend
- Node.js
- Express.js
- MongoDB (Models)
- Google OAuth 2.0
- Yjs Providers

### Real-time
- Yjs + WebSocket
- Socket.io for chat and events

## Features in Development

- [ ] Code syntax highlighting improvements
- [ ] Extended AI integration
- [ ] Version control integration
- [ ] Code review features
- [ ] Performance optimization
- [ ] Additional authentication providers

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

**Praveen Palkar**
- GitHub: [@PraveenPalkar18](https://github.com/PraveenPalkar18)

## Support

For support, email your-email@example.com or open an issue on GitHub.

## Acknowledgments

- Yjs team for the collaborative editing framework
- Monaco Editor team
- Google for OAuth authentication
- React community for the amazing framework
