import { createEffect, createSignal, For, onMount } from 'solid-js';
import styles from './index.module.scss';
import { createStore, produce } from 'solid-js/store';

const COLORS = [
  '#ffffff',
  '#000000',
  '#fb2929',
  '#fbb129',
  '#fbee29',
  '#43ea34',
  '#34c6ea',
  '#3456ea',
  '#7d34ea',
  '#ea34ea',
];

function hexColorBrightness(hex: string) {
  hex = hex.replace('#', '');
  if (hex.length == 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return (
    (parseInt(hex.substring(0, 2), 16) +
      parseInt(hex.substring(2, 4), 16) * 2 +
      parseInt(hex.substring(4, 6), 16)) /
    10.2
  );
}

export default function Index() {
  const [grid, setGrid] = createStore<Chunk[]>([]);
  const [loadedCenter, setLoadedCenter] = createSignal([0, 0]);
  const [x, setX] = createSignal(0);
  const [y, setY] = createSignal(0);
  const [selectedColor, setSelectedColor] = createSignal('#000000');
  const [keysPressed, setKeysPressed] = createStore({
    w: false,
    a: false,
    s: false,
    d: false,
  });
  const [spacePressed, setSpacePressed] = createSignal(false);
  const [moving, setMoving] = createSignal(false);
  const [socket, setSocket] = createSignal<WebSocket>();
  const [otherPlayers, setOtherPlayers] = createStore<Player[]>([]);

  const setSpace = (x: number, y: number, value: string) => {
    setGrid(
      (chunk) =>
        chunk.x === Math.floor(x / 32) && chunk.y === Math.floor(y / 32),
      'grid',
      [x % 32 == 0 ? 0 : x >= 0 ? x % 32 : 32 + (x % 32)],
      [y % 32 == 0 ? 0 : y >= 0 ? y % 32 : 32 + (y % 32)],
      value
    );
  };

  let lastMove = 0;

  const move = () => {
    if (Date.now() - lastMove < 50) return;
    const updates: Updates = [];
    let moveUpdate: MoveUpdate = { type: 'move', changeX: 0, changeY: 0 };
    if (keysPressed.w) {
      setY((py) => py + 1);
      moveUpdate.changeY += 1;
    }
    if (keysPressed.s) {
      setY((py) => py - 1);
      moveUpdate.changeY -= 1;
    }
    if (keysPressed.a) {
      setX((px) => px - 1);
      moveUpdate.changeX -= 1;
    }
    if (keysPressed.d) {
      setX((px) => px + 1);
      moveUpdate.changeX += 1;
    }
    if (keysPressed.w || keysPressed.s || keysPressed.a || keysPressed.d) {
      updates.push(moveUpdate);
    }

    if (spacePressed()) {
      setSpace(x(), y(), selectedColor());
      updates.push({
        type: 'draw',
        chunkX: Math.floor(x() / 32),
        chunkY: Math.floor(y() / 32),
        x: (x() % 32 < 0 ? 32 : 0) + (x() % 32),
        y: (y() % 32 < 0 ? 32 : 0) + (y() % 32),
        color: selectedColor(),
      });
    }

    console.log(Date.now() - lastMove);

    socket()?.send(JSON.stringify({ type: 'updates', data: updates }));
    lastMove = Date.now();
  };

  onMount(() => {
    document.onkeydown = (e: KeyboardEvent) => {
      const keyPressed = e.key.toLowerCase();
      if (
        keyPressed == 'w' ||
        keyPressed == 's' ||
        keyPressed == 'a' ||
        keyPressed == 'd'
      )
        setKeysPressed(keyPressed, true);
      if (keyPressed == ' ') {
        setSpacePressed(true);
        setSpace(x(), y(), selectedColor());
        socket()?.send(
          JSON.stringify({
            type: 'updates',
            data: [
              {
                type: 'draw',
                chunkX: Math.floor(x() / 32),
                chunkY: Math.floor(y() / 32),
                x: (x() % 32 < 0 ? 32 : 0) + (x() % 32),
                y: (y() % 32 < 0 ? 32 : 0) + (y() % 32),
                color: selectedColor(),
              },
            ],
          })
        );
      }

      if (keyPressed == 'q' && COLORS.indexOf(selectedColor()) > 0)
        setSelectedColor((color) => COLORS[COLORS.indexOf(color) - 1]);
      if (
        keyPressed == 'e' &&
        COLORS.indexOf(selectedColor()) < COLORS.length - 1
      )
        setSelectedColor((color) => COLORS[COLORS.indexOf(color) + 1]);
    };
    document.onkeyup = (e: KeyboardEvent) => {
      const keyPressed = e.key.toLowerCase();
      if (
        keyPressed == 'w' ||
        keyPressed == 's' ||
        keyPressed == 'a' ||
        keyPressed == 'd'
      )
        setKeysPressed(keyPressed, false);
      if (keyPressed == ' ') {
        setSpacePressed(false);
      }
    };

    const ws = new WebSocket('ws://localhost:3100/game');
    ws.onopen = () => {
      console.log('socket open');
    };
    ws.onmessage = async (e: MessageEvent) => {
      const messageTime = Date.now();
      console.log('socket got message');
      const msg = JSON.parse(e.data) as SocketMessage;
      console.log(msg);
      console.log('Message time', Date.now() - messageTime);
      if (msg.type == 'newChunks') {
        console.log('setting chunks...');
        console.log('Message time', Date.now() - messageTime);
        let tempChunks = grid
          .concat(msg.data.chunks)
          .filter(
            (chunk) =>
              Math.abs(chunk.x - Math.floor(x() / 32)) <= 2 &&
              Math.abs(chunk.y - Math.floor(y() / 32)) <= 2
          );
        console.log('Message time', Date.now() - messageTime);
        setGrid(tempChunks);
        console.log('Message time', Date.now() - messageTime);
        setLoadedCenter([Math.floor(x() / 32), Math.floor(y() / 32)]);
        console.log('Message time', Date.now() - messageTime);
        console.log(grid);
        console.log(loadedCenter());
        console.log('Message time', Date.now() - messageTime);
      }
      if (msg.type == 'updates') {
        const updates = msg.data as Updates;
        updates.forEach((update) => {
          if (update.type == 'draw') {
            setSpace(
              update.chunkX * 32 + update.x,
              update.chunkY * 32 + update.y,
              update.color
            );
          }
        });
      }
    };
    setSocket(ws);
  });

  createEffect(() => {
    if (Object.values(keysPressed).includes(true) && !moving()) {
      setMoving(true);
      setTimeout(() => {
        if (!moving()) return;
        move();
        setTimeout(() => {
          if (!moving()) return;
          let intervalID = setInterval(() => {
            if (moving()) move();
            else {
              clearInterval(intervalID);
            }
          }, 100);
        }, 50);
      }, 10);
    } else if (!Object.values(keysPressed).includes(true) && moving()) {
      setMoving(false);
    }
  });

  // createEffect(() => {
  //   if (loadedCenter()[0] > Math.floor(x() / 32)) {
  //     console.log('too far left');
  //   }
  //   if (loadedCenter()[0] < Math.floor(x() / 32)) {
  //     console.log('too far right');
  //   }
  //   if (loadedCenter()[1] > Math.floor(y() / 32)) {
  //     console.log('too far down');
  //   }
  //   if (loadedCenter()[1] < Math.floor(y() / 32)) {
  //     console.log('too far up');
  //   }
  // });

  return (
    <div class={styles.main}>
      <div class={styles.hud}>
        <div class={styles.fps}>{}</div>
        <div class={styles.colorSelect}>
          <div
            class={`${styles.left} ${styles.arrow} ${
              COLORS.indexOf(selectedColor()) > 0 &&
              hexColorBrightness(COLORS[COLORS.indexOf(selectedColor()) - 1]) <
                50
                ? styles.lightText
                : ''
            }`}
          >
            <p>q</p>
          </div>
          <div
            class={`${styles.space} ${styles.arrow} ${
              hexColorBrightness(selectedColor()) < 50 ? styles.lightText : ''
            }`}
          >
            <p>␣</p>
          </div>
          <div
            class={styles.colors}
            style={{
              translate:
                'calc(60px - ' + COLORS.indexOf(selectedColor()) * 60 + 'px)',
            }}
          >
            <For each={COLORS}>
              {(color, i) => (
                <div
                  id={i().toString()}
                  style={{ 'background-color': color }}
                ></div>
              )}
            </For>
          </div>
          <div
            class={`${styles.right} ${styles.arrow} ${
              COLORS.indexOf(selectedColor()) < COLORS.length - 1 &&
              hexColorBrightness(COLORS[COLORS.indexOf(selectedColor()) + 1]) <
                50
                ? styles.lightText
                : ''
            }`}
          >
            <p>e</p>
          </div>
        </div>
      </div>
      <div
        class={styles.grid}
        style={{
          translate:
            'calc(-50% + 310px - ' +
            (x() * 21 - loadedCenter()[0] * 32 * 21) +
            'px) calc(-50% - 310px + ' +
            (y() * 21 - loadedCenter()[1] * 32 * 21) +
            'px)',
        }}
      >
        <For each={grid}>
          {(chunk) => (
            <div
              class={styles.chunk}
              style={{
                'grid-column': 4 + (chunk.x - loadedCenter()[0]),
                'grid-row': 4 - (chunk.y - loadedCenter()[1]),
              }}
              id={chunk.x + ' ' + chunk.y}
            >
              <For each={chunk.grid}>
                {(col, i) => (
                  <For each={col}>
                    {(space, j) => (
                      <div
                        class={`${styles.space} ${
                          i() + chunk.x * 32 == x() && j() + chunk.y * 32 == y()
                            ? styles.cursor
                            : ''
                        }`}
                        style={{
                          'grid-column': i() + 1,
                          'grid-row': 32 - j(),
                          'background-color': space,
                        }}
                      >
                        {/* {i() == 0 && j() == 0 ? chunk.x : ''}
                        {i() == 1 && j() == 0 ? chunk.y : ''} */}
                      </div>
                    )}
                  </For>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
