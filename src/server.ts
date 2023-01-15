import express from "express";
import cors from "cors";
import * as http from "http";
import { Server, Socket } from 'socket.io';

const io = new Server({
  serveClient: false,
  cors: {
    origin: "*",
  },
});

interface BaseMessage {
  type: string;
  groupId: string;
}

interface JoinGroupMessage extends BaseMessage  {
  type: "JoinGroup";
}

interface LeaveGroupMessage extends BaseMessage {
  type: "LeaveGroup";
}

interface GroupMessage extends BaseMessage  {
  type: "GroupMessage",
  subtype: string;
  payload: unknown 
}


type Messages = JoinGroupMessage | GroupMessage | LeaveGroupMessage;

const app = express();

// @ts-ignore
app.options("*", cors());
app.use(cors());

app.get("/", (req, res) => {
  res.send({ ok: true });
});

app.post('/groups/:id/message', express.json(), (req, res, next) => {
  const groupId = req.params.id;
  const { subtype, payload } = req.body as Exclude<GroupMessage, 'type'>;
  const count = onGroupMessage({
    type: 'GroupMessage',
    subtype,
    groupId,
    payload,
  });

  res.send({
    sentTo: count
  });

});

// @ts-ignore
app.use((err, req, res, next) => {
  const { status, ...body } = err;
  res.status(status || 500).send(body);
});

const groups = {} as Record<string, string[] | undefined>;

const joinGroup = (socketId: string, m: JoinGroupMessage) => {
  if (!groups[m.groupId]) {
    groups[m.groupId] = [];
  }

  const group = groups[m.groupId]!;
  group.push(socketId);
};

const leaveGroup = (socketId: string) => {
  for (const [key, socketIds] of Object.entries(groups)) {
    let filteredGroup = socketIds?.filter((id) => id === socketId) || [];
    if (filteredGroup.length === 0) {
      delete groups[key];
    } else {
      groups[key] = filteredGroup;
    }
  }
};

const onGroupMessage = (m: GroupMessage, fromSocketId?: string): number => {
  let count = 0;
  const sockets = groups[m.groupId]?.filter(id => id !== fromSocketId) || []
  sockets.forEach( id => {
    io.sockets.sockets.get(id)?.send(m);
    count += 1;
  });
  return count;
};

const server = http.createServer(app);
io.attach(server);

server.listen(process.env.PORT || 3000, () => {
  io.on("connect", (socket) => {
    const socketId = socket.id;
    socket.on("message", (m: Messages) => {
      switch (m.type) {
        case "JoinGroup":
          leaveGroup(socketId);
          joinGroup(socketId, m);
          break;
        case "LeaveGroup":
          leaveGroup(socketId);
          break;
        case "GroupMessage":
          onGroupMessage(m, socketId);
          break;
      }
    });

    socket.on("disconnect", () => {
      leaveGroup(socketId);
    });
  });
});
