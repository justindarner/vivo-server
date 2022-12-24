import express from "express";
import cors from "cors";
import * as http from "http";

const io = require("socket.io")({
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
  const count = onGroupMessage({}, {
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

const groups = {} as Record<string, unknown[] | undefined>;

const joinGroup = (socket: unknown, m: JoinGroupMessage) => {
  if (!groups[m.groupId]) {
    groups[m.groupId] = [];
  }

  const group = groups[m.groupId]!;
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
  const sockets = groups[m.groupId] || [];
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
