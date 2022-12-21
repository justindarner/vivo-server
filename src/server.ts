import express from "express";
import cors from "cors";
import * as http from "http";

const io = require("socket.io")({
  serveClient: false,
  cors: {
    origin: "*",
  },
});

interface Message<T, P> {
  type: T;
  payload: P;
}

type JoinGroupMessage = Message<"JoinGroup", { groupId: string }>;
type LeaveGroupMessage = Message<"LeaveGroup", undefined>;
type GroupMessage = Message<"GroupMessage", { groupId: string }>;

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
  const message = req.body as GroupMessage['payload'];
  const count = onGroupMessage({}, {
    type: 'GroupMessage',
    payload: {
      ...message,
      groupId,
    }
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

const groups = {} as Record<string, unknown[] | undefined>;

const joinGroup = (socket: unknown, m: JoinGroupMessage) => {
  if (!groups[m.payload.groupId]) {
    groups[m.payload.groupId] = [];
  }

  const group = groups[m.payload.groupId]!;
  group.push(socket);
};

const leaveGroup = (socket: unknown) => {
  for (const [key, group] of Object.entries(groups)) {
    let filteredGroup = group?.filter((_socket) => _socket === socket) || [];
    if (filteredGroup.length === 0) {
      delete groups[key];
    } else {
      groups[key] = filteredGroup;
    }
  }
};

const onGroupMessage = (socket: unknown, m: GroupMessage): number => {
  const sockets = groups[m.payload.groupId] || [];
  let count = 0;
  sockets.forEach((peer: any) => {
    if (socket !== peer) {
      peer.send(m);
      count += 1;
    }
  });
  return count;
};

const server = http.createServer(app);
io.attach(server);

server.listen(process.env.PORT || 3000, () => {
  io.on("connect", (socket: any) => {
    socket.on("message", (m: Messages) => {
      switch (m.type) {
        case "JoinGroup":
          leaveGroup(socket);
          joinGroup(socket, m);
          break;
        case "LeaveGroup":
          leaveGroup(socket);
          break;
        case "GroupMessage":
          onGroupMessage(socket, m);
          break;
      }
    });

    socket.on("disconnect", (t: any) => {
      leaveGroup(t);
    });
  });
});
