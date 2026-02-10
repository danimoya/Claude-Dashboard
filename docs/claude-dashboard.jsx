import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Square, FolderOpen, File, Terminal, Mic, MicOff, 
  Settings, Plus, X, ChevronRight, ChevronDown, Save,
  Clock, Activity, Database, Server, GitBranch, Send,
  Code, Workflow, Calendar, Bell, User, Key, Volume2,
  FileText, Package, Cpu, HardDrive, Zap, AlertCircle
} from 'lucide-react';

// Mock API functions
const api = {
  login: async (credentials) => ({ token: 'mock-token', user: { id: '1', username: credentials.username } }),
  getProjects: async () => [
    { id: '1', name: 'E-Commerce API', type: 'claude-code', status: 'active', lastModified: '2 hours ago' },
    { id: '2', name: 'Data Pipeline', type: 'claude-flow', status: 'inactive', lastModified: '1 day ago' },
  ],
  getFiles: async (projectId) => ({
    name: 'root',
    type: 'folder',
    children: [
      { name: 'src', type: 'folder', children: [
        { name: 'index.js', type: 'file', content: '// Main application entry point\nconst app = require("express")();\n\napp.get("/", (req, res) => {\n  res.send("Hello Claude!");\n});\n\napp.listen(3000);' },
        { name: 'utils.js', type: 'file', content: '// Utility functions\nexport const formatDate = (date) => {\n  return new Date(date).toLocaleDateString();\n};' }
      ]},
      { name: 'package.json', type: 'file', content: '{\n  "name": "claude-project",\n  "version": "1.0.0",\n  "dependencies": {\n    "express": "^4.18.0"\n  }\n}' },
      { name: 'README.md', type: 'file', content: '# Claude Project\n\nThis project was created with Claude Code.\n\n## Features\n- AI-assisted development\n- Real-time collaboration\n- Automated testing' }
    ]
  }),
  getSessions: async () => [
    { id: 's1', projectId: '1', status: 'running', startedAt: '10:30 AM', type: 'claude-code' },
    { id: 's2', projectId: '2', status: 'completed', startedAt: '9:15 AM', type: 'claude-flow' }
  ],
  getInfrastructure: async () => [
    { id: 'c1', name: 'api-container', status: 'running', image: 'node:18', cpu: '0.5', memory: '512MB' },
    { id: 'c2', name: 'db-container', status: 'running', image: 'postgres:15', cpu: '1.0', memory: '1GB' }
  ],
  enhancePrompt: async (prompt) => `Enhanced: ${prompt}\n\nDetailed development plan:\n1. Set up project structure\n2. Implement core functionality\n3. Add error handling\n4. Write tests\n5. Document API endpoints`,
  transcribeAudio: async (audio) => 'Create a REST API with authentication and CRUD operations for a task management system'
};

// Login Component
function LoginScreen({ onLogin }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await api.login(credentials);
    onLogin(result);
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-lg shadow-xl w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Claude Dashboard</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            className="w-full p-3 border rounded-lg mb-4"
            value={credentials.username}
            onChange={(e) => setCredentials({...credentials, username: e.target.value})}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 border rounded-lg mb-6"
            value={credentials.password}
            onChange={(e) => setCredentials({...credentials, password: e.target.value})}
          />
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition">
            Sign In
          </button>
        </form>
        <p className="text-sm text-gray-500 mt-4 text-center">Private dashboard - No signup available</p>
      </div>
    </div>
  );
}

// File Tree Component
function FileTree({ files, onSelectFile, level = 0 }) {
  const [expanded, setExpanded] = useState({});
  
  const toggleExpand = (name) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };
  
  return (
    <div style={{ marginLeft: level * 20 }}>
      {files.children?.map(file => (
        <div key={file.name}>
          <div 
            className="flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer"
            onClick={() => file.type === 'folder' ? toggleExpand(file.name) : onSelectFile(file)}
          >
            {file.type === 'folder' ? (
              expanded[file.name] ? <ChevronDown size={16} /> : <ChevronRight size={16} />
            ) : null}
            {file.type === 'folder' ? <FolderOpen size={16} className="mr-2 text-blue-500" /> : <File size={16} className="mr-2 text-gray-500" />}
            <span className="text-sm">{file.name}</span>
          </div>
          {file.type === 'folder' && expanded[file.name] && (
            <FileTree files={file} onSelectFile={onSelectFile} level={level + 1} />
          )}
        </div>
      ))}
    </div>
  );
}

// Terminal Component
function TerminalEmulator({ sessionId }) {
  const [output, setOutput] = useState([
    '> Claude Code initialized',
    '> Connected to session: ' + sessionId,
    '> Ready for commands...'
  ]);
  const [input, setInput] = useState('');
  
  const handleCommand = (e) => {
    if (e.key === 'Enter') {
      setOutput(prev => [...prev, `$ ${input}`, 'Processing command...']);
      setInput('');
    }
  };
  
  return (
    <div className="bg-black text-green-400 p-4 font-mono text-sm h-full overflow-y-auto">
      {output.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
      <div className="flex items-center mt-2">
        <span className="mr-2">$</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleCommand}
          className="flex-1 bg-transparent outline-none"
          placeholder="Enter command..."
        />
      </div>
    </div>
  );
}

// Voice Input Component
function VoiceInput({ onTranscript }) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef(null);
  
  const toggleRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder.current = new MediaRecorder(stream);
        
        const chunks = [];
        mediaRecorder.current.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.current.onstop = async () => {
          const blob = new Blob(chunks, { type: 'audio/wav' });
          const transcript = await api.transcribeAudio(blob);
          onTranscript(transcript);
        };
        
        mediaRecorder.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Microphone access denied');
      }
    } else {
      mediaRecorder.current?.stop();
      setIsRecording(false);
    }
  };
  
  return (
    <button
      onClick={toggleRecording}
      className={`p-3 rounded-lg transition ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 hover:bg-gray-300'}`}
    >
      {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
    </button>
  );
}

// Project Card Component
function ProjectCard({ project, onOpen }) {
  const Icon = project.type === 'claude-code' ? Code : Workflow;
  const statusColor = project.status === 'active' ? 'bg-green-500' : 'bg-gray-400';
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer" onClick={onOpen}>
      <div className="flex justify-between items-start mb-4">
        <Icon size={32} className="text-blue-600" />
        <div className={`${statusColor} w-3 h-3 rounded-full`}></div>
      </div>
      <h3 className="font-semibold text-lg mb-2">{project.name}</h3>
      <p className="text-sm text-gray-500 mb-4">Type: {project.type}</p>
      <div className="flex items-center text-xs text-gray-400">
        <Clock size={14} className="mr-1" />
        {project.lastModified}
      </div>
    </div>
  );
}

// Infrastructure Panel
function InfrastructurePanel() {
  const [containers, setContainers] = useState([]);
  
  useEffect(() => {
    api.getInfrastructure().then(setContainers);
  }, []);
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold text-lg mb-4 flex items-center">
        <Server className="mr-2" /> Infrastructure
      </h3>
      <div className="space-y-3">
        {containers.map(container => (
          <div key={container.id} className="border rounded p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">{container.name}</span>
              <span className={`text-xs px-2 py-1 rounded ${
                container.status === 'running' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {container.status}
              </span>
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex items-center">
                <Package size={12} className="mr-1" /> {container.image}
              </div>
              <div className="flex items-center">
                <Cpu size={12} className="mr-1" /> CPU: {container.cpu}
              </div>
              <div className="flex items-center">
                <HardDrive size={12} className="mr-1" /> Memory: {container.memory}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Prompt Builder
function PromptBuilder() {
  const [prompt, setPrompt] = useState('');
  const [enhanced, setEnhanced] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  const handleEnhance = async () => {
    setIsEnhancing(true);
    const result = await api.enhancePrompt(prompt);
    setEnhanced(result);
    setIsEnhancing(false);
  };
  
  const handleVoiceInput = (transcript) => {
    setPrompt(transcript);
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold text-lg mb-4 flex items-center">
        <Zap className="mr-2" /> Prompt Builder
      </h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Original Prompt</label>
          <div className="flex gap-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1 p-3 border rounded-lg resize-none"
              rows="3"
              placeholder="Describe what you want to build..."
            />
            <VoiceInput onTranscript={handleVoiceInput} />
          </div>
        </div>
        
        <button
          onClick={handleEnhance}
          disabled={!prompt || isEnhancing}
          className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
        >
          {isEnhancing ? 'Enhancing...' : 'Enhance with AI'}
        </button>
        
        {enhanced && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Enhanced Development Plan</label>
            <div className="p-4 bg-blue-50 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm">{enhanced}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Session Manager
function SessionManager() {
  const [sessions, setSessions] = useState([]);
  
  useEffect(() => {
    api.getSessions().then(setSessions);
  }, []);
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold text-lg mb-4 flex items-center">
        <Activity className="mr-2" /> Active Sessions
      </h3>
      <div className="space-y-3">
        {sessions.map(session => (
          <div key={session.id} className="border rounded p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Session {session.id}</span>
              <span className={`text-xs px-2 py-1 rounded ${
                session.status === 'running' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {session.status}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              <div>Type: {session.type}</div>
              <div>Started: {session.startedAt}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main Dashboard
function Dashboard() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [files, setFiles] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeTab, setActiveTab] = useState('workspace');
  
  useEffect(() => {
    if (user) {
      api.getProjects().then(setProjects);
    }
  }, [user]);
  
  useEffect(() => {
    if (selectedProject) {
      api.getFiles(selectedProject.id).then(setFiles);
    }
  }, [selectedProject]);
  
  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }
  
  const handleNewProject = () => {
    const name = prompt('Project name:');
    const type = confirm('Claude Code (OK) or Claude Flow (Cancel)?') ? 'claude-code' : 'claude-flow';
    if (name) {
      const newProject = {
        id: Date.now().toString(),
        name,
        type,
        status: 'active',
        lastModified: 'Just now'
      };
      setProjects([...projects, newProject]);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-800">Claude Dashboard</h1>
            {selectedProject && (
              <span className="text-sm text-gray-500">
                / {selectedProject.name}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2 hover:bg-gray-100 rounded">
              <Bell size={20} />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded">
              <Settings size={20} />
            </button>
            <div className="flex items-center space-x-2">
              <User size={20} />
              <span className="text-sm">{user.user.username}</span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex h-[calc(100vh-60px)]">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r p-4">
          <button
            onClick={handleNewProject}
            className="w-full bg-blue-600 text-white p-2 rounded-lg mb-4 flex items-center justify-center hover:bg-blue-700 transition"
          >
            <Plus size={18} className="mr-2" /> New Project
          </button>
          
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Projects</h3>
            {projects.map(project => (
              <div
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className={`p-2 rounded cursor-pointer flex items-center ${
                  selectedProject?.id === project.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'
                }`}
              >
                {project.type === 'claude-code' ? <Code size={16} className="mr-2" /> : <Workflow size={16} className="mr-2" />}
                <span className="text-sm">{project.name}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Main Area */}
        <div className="flex-1 p-6">
          {!selectedProject ? (
            <div className="grid grid-cols-3 gap-6">
              <h2 className="col-span-3 text-2xl font-bold text-gray-800 mb-4">Your Projects</h2>
              {projects.map(project => (
                <ProjectCard key={project.id} project={project} onOpen={() => setSelectedProject(project)} />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tabs */}
              <div className="flex space-x-4 border-b">
                {['workspace', 'infrastructure', 'prompt', 'sessions'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-2 px-1 capitalize ${
                      activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              
              {/* Tab Content */}
              {activeTab === 'workspace' && (
                <div className="grid grid-cols-3 gap-6 h-[calc(100vh-200px)]">
                  {/* File Browser */}
                  <div className="bg-white rounded-lg shadow p-4 overflow-y-auto">
                    <h3 className="font-semibold mb-4">Files</h3>
                    {files && <FileTree files={files} onSelectFile={setSelectedFile} />}
                  </div>
                  
                  {/* Code Editor */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <h3 className="font-semibold mb-4">
                      {selectedFile ? selectedFile.name : 'Select a file'}
                    </h3>
                    {selectedFile && (
                      <pre className="text-xs bg-gray-50 p-4 rounded overflow-x-auto">
                        <code>{selectedFile.content}</code>
                      </pre>
                    )}
                  </div>
                  
                  {/* Terminal */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <h3 className="font-semibold mb-4">Terminal</h3>
                    <div className="h-[400px] bg-black rounded">
                      <TerminalEmulator sessionId={selectedProject.id} />
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'infrastructure' && <InfrastructurePanel />}
              {activeTab === 'prompt' && <PromptBuilder />}
              {activeTab === 'sessions' && <SessionManager />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;