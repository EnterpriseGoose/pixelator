/// <reference types="@solidjs/start/env" />

interface Chunk {
  grid: string[][];
  id: string;
  x: number;
  y: number;
}

interface SocketMessage<dataType = any> {
  type: 'updates' | 'newChunks';
  data: dataType;
}

interface Update {
  type: string;
}

interface MoveUpdate extends Update {
  type: 'move';
  changeX: number;
  changeY: number;
}

interface DrawUpdate extends Update {
  type: 'draw';
  chunkX: number;
  chunkY: number;
  x: number;
  y: number;
  color: string;
}

interface PlayerUpdate extends Update {
  type: 'player';
  id: string;
  x: number;
  y: number;
  color: string;
}

type Updates = (MoveUpdate | DrawUpdate)[];

interface Player {
  id: string;
  x: number;
  y: number;
  color: string;
}
