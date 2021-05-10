import express from "express";
import cors from "cors";
import * as http from "http";
import { Socket } from "socket.io";
import bodyParser from "body-parser";
import socketIo from "socket.io";

interface Message<T, P> {
  type: T;
  groupId: string;
  payload: P;
}

type JoinGroupMessage = Message<"JoinGroup", undefined>;
type GroupMessage = Message<"GroupMessage", unknown>;

type Messages = JoinGroupMessage | GroupMessage;

const app = express();
const server = http.createServer(app);

const io = require("socket.io").listen(server, { origins: "*:*" });

// @ts-ignore
app.options("*", cors());
app.use(cors());

app.get("/", (req, res) => {
  res.send({ ok: true });
});

// @ts-ignore
app.use((err, req, res, next) => {
  const { status, ...body } = err;
  res.status(status || 500).send(body);
});

const groups = {} as Record<string, unknown[] | undefined>;

io.on("connect", (socket: any) => {
  socket.on("message", (m: Messages) => {
    if (m.type === "JoinGroup") {
      if (!groups[m.groupId]) {
        groups[m.groupId] = [];
      }

      const group = groups[m.groupId]!;
      group.push(socket);
    }

    if (m.type === "GroupMessage") {
      const sockets = groups[m.groupId] || [];
      sockets.forEach((peer: any) => {
        if (socket !== peer) {
          peer.send(m);
        }
      });
    }
  });

  socket.on("disconnect", (t: any) => {
    for (const [key, group] of Object.entries(groups)) {
      let filteredGroup = group?.filter((socket) => socket === t) || [];
      if (filteredGroup.length === 0) {
        delete groups[key];
      } else {
        groups[key] = filteredGroup;
      }
    }
  });
});

server.listen(process.env.PORT || 3000);
