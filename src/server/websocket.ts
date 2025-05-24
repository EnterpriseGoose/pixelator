import { eventHandler } from 'vinxi/http';

interface Peer {
  send: (data: string) => void;
  [i: string]: any;
}

interface Session {
  peer: any;
  x: number;
  y: number;
  lastPing: number;
}

const sessions: { [i: string]: Session } = {};

const chunks: Chunk[] = [];

function getSurroundingChunks(chunkX: number, chunkY: number) {
  const emptyChunkGrid: string[][] = [];
  for (let i = 0; i < 32; i++) {
    emptyChunkGrid.push([]);
    for (let j = 0; j < 32; j++) {
      emptyChunkGrid[i].push('0');
    }
  }
  const returnChunks = [];
  for (let i = chunkX - 2; i < chunkX + 3; i++) {
    for (let j = chunkY - 2; j < chunkY + 3; j++) {
      if (chunks.find((chunk) => chunk.id == i + ',' + j)) {
        returnChunks.push(chunks.find((chunk) => chunk.id == i + ',' + j));
      } else {
        let newChunk = {
          grid: structuredClone(emptyChunkGrid),
          id: i + ',' + j,
          x: i,
          y: j,
        };
        chunks.push(newChunk);
        returnChunks.push(newChunk);
      }
    }
  }

  return returnChunks;
}

function sendPeerCursorUpdate(peerId: string, close: boolean) {
  const peersUpdateMsg: SocketMessage<Updates> = {
    type: 'updates',
    data: [
      {
        type: 'player',
        id: peerId,
        x: sessions[peerId].x,
        y: sessions[peerId].y,
        color: close ? 'CLOSE' : '#000000',
      },
    ],
  };
  Object.entries(sessions).forEach(([id, session]) => {
    if (
      id != peerId &&
      Math.abs(session.x - sessions[peerId].x) < 32 * 3 &&
      Math.abs(session.y - sessions[peerId].y) < 32 * 3
    ) {
      session.peer.send(peersUpdateMsg);
    }
  });
}

function sendSurroundingCursorUpdate(peerId: string) {
  const peersUpdateMsg: SocketMessage<Updates> = {
    type: 'updates',
    data: [],
  };
  Object.entries(sessions).forEach(([id, session]) => {
    if (
      id != peerId &&
      Math.abs(session.x - sessions[peerId].x) < 32 * 3 &&
      Math.abs(session.y - sessions[peerId].y) < 32 * 3
    ) {
      peersUpdateMsg.data.push({
        type: 'player',
        id,
        x: session.x,
        y: session.y,
        color: '#000000',
      });
    }
  });
  sessions[peerId].peer.send(peersUpdateMsg);
}

export default eventHandler({
  handler() {},
  websocket: {
    async open(peer) {
      console.log('open', peer.id);
      if (!sessions[peer.id]) {
        sessions[peer.id] = { peer, x: 0, y: 0, lastPing: Date.now() };
      }

      peer.send(
        JSON.stringify({
          type: 'newChunks',
          data: {
            chunks: getSurroundingChunks(0, 0),
            players: [],
          },
        })
      );
      sendSurroundingCursorUpdate(peer.id);
      sendPeerCursorUpdate(peer.id, false);
    },
    async message(peer, msg) {
      const message: SocketMessage = JSON.parse(msg.text());
      // console.log('msg', peer.id, message);

      if (message.type == 'refresh') {
        peer.send(
          JSON.stringify({
            type: 'newChunks',
            data: {
              chunks: getSurroundingChunks(0, 0),
              players: [],
            },
          })
        );
        sendSurroundingCursorUpdate(peer.id);
      }

      if (message.type == 'updates') {
        const data: Updates = message.data;

        data.forEach((update) => {
          if (update.type == 'move') {
            if (Math.abs(update.changeX) > 1 || Math.abs(update.changeY) > 1)
              return;
            if (
              Math.floor((sessions[peer.id].x + update.changeX) / 32) !=
                Math.floor(sessions[peer.id].x / 32) ||
              Math.floor((sessions[peer.id].y + update.changeY) / 32) !=
                Math.floor(sessions[peer.id].y / 32)
            ) {
              const oldChunks = getSurroundingChunks(
                Math.floor(sessions[peer.id].x / 32),
                Math.floor(sessions[peer.id].y / 32)
              );
              const newChunks = getSurroundingChunks(
                Math.floor((sessions[peer.id].x + update.changeX) / 32),
                Math.floor((sessions[peer.id].y + update.changeY) / 32)
              ).filter((chunk) => !oldChunks.find((ch) => ch?.id == chunk?.id));

              peer.send({
                type: 'newChunks',
                data: {
                  chunks: newChunks,
                  players: [],
                },
              });
            }

            sessions[peer.id].x += update.changeX;
            sessions[peer.id].y += update.changeY;

            sendPeerCursorUpdate(peer.id, false);
          }
          if (update.type == 'draw') {
            let chunk = chunks.find(
              (chunk) => chunk.id == update.chunkX + ',' + update.chunkY
            );
            // console.log(update.x, update.y);
            if (chunk) chunk.grid[update.x][update.y] = update.color;

            const peersUpdateMsg: SocketMessage<Updates> = {
              type: 'updates',
              data: [update],
            };
            Object.entries(sessions).forEach(([id, session]) => {
              if (
                id != peer.id &&
                Math.abs(session.x - (update.chunkX * 32 + update.x)) <
                  32 * 3 &&
                Math.abs(session.y - (update.chunkY * 32 + update.y)) < 32 * 3
              ) {
                session.peer.send(peersUpdateMsg);
              }
            });
          }
        });
      }
    },
    async close(peer, details) {
      console.log('close', peer.id);
      sendPeerCursorUpdate(peer.id, true);
      delete sessions[peer.id];
    },
    async error(peer, error) {
      console.log('error', peer.id, error);
    },
  },
});
