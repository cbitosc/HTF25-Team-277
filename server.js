const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const groups = {"grpid1":{}};
wss.on('connection', (ws, req) => {
  try {
    const fullUrl = `http://localhost${req.url}`;
    const urlObj = new URL(fullUrl);
    const grpId = urlObj.searchParams.get('grpId') || 'default';
    const username = urlObj.searchParams.get('username') || `user${Math.floor(Math.random() * 1000)}`;
    if (!groups[grpId]) groups[grpId] = { members: new Set() };
    groups[grpId].members.add(ws);
    ws.grpId = grpId;
    ws.username = username;
    const joinPayload = JSON.stringify({ type: 'presence', action: 'join', username });
    groups[grpId].members.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(joinPayload);
    });
    ws.on('message', raw => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch (e) {
        return;
      }
      const g = groups[ws.grpId];
      if (!g) return;
      if (['offer', 'answer', 'ice-candidate', 'voice-request'].includes(msg.type)) {
        const targetUsername = msg.target;
        g.members.forEach(client => {
          if (client.username === targetUsername && client.readyState === WebSocket.OPEN) {
            const payload = JSON.stringify(Object.assign({ from: ws.username }, msg));
            client.send(payload);
          }
        });
        return;
      }
      const payload = JSON.stringify(Object.assign({ from: ws.username }, msg));
      g.members.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    });
    ws.on('close', () => {
      const g = groups[ws.grpId];
      if (!g) return;
      g.members.delete(ws);
      const leavePayload = JSON.stringify({ type: 'presence', action: 'leave', username: ws.username });
      groups[grpId].members.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(leavePayload);
      });
      if (g.members.size === 0) delete groups[ws.grpId];
    });
    ws.on('error', () => {
      ws.terminate();
    });
  } catch (err) {
    ws.close();
  }
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'board.html'));
});
server.listen(8000,'0.0.0.0', () => {
  console.log('listening 8000');
});