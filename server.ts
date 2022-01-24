import dgram from "dgram";
import express from "express";
import nodeHttp from "http";
import { Server } from "socket.io";
import WebSocket from "ws";
import { spawn } from "child_process";
import fs from "fs";

const HTTP_PORT = 3333;
const STREAM_PORT = 3001;
console.log(__dirname + "/www/");

const http = nodeHttp.createServer(function (request, response) {
  // Read file from the local directory and serve to user
  // in this case it will be index.html
  fs.readFile(__dirname + "/www/" + request.url, function (err, data) {
    console.log("err: ", err, data);
    if (err) {
      response.writeHead(404);
      response.end(JSON.stringify(err));
      return;
    }
    response.writeHead(200);
    response.end(data);
  });
});

const streamServer = nodeHttp
  .createServer(function (request, response) {
    request.on("data", function (data) {
      (webSocketServer as any).broadcast(data);
    });
  })
  .listen(STREAM_PORT);

const webSocketServer = new WebSocket.Server({
  server: streamServer,
});

(webSocketServer as any).broadcast = function (data: any) {
  webSocketServer.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

const server = new Server();
const io = server.listen(http);

const PORT = 8889;
const HOST = "192.168.10.1";

const drone = dgram.createSocket("udp4");
drone.bind(PORT);

const droneState = dgram.createSocket("udp4");
droneState.bind(8890);

drone.on("message", (message) => {
  console.log(`🤖 : ${message}`);
  io.sockets.emit("status", message);
});

function handleError(err: Error | null) {
  if (err) {
    console.log("ERROR");
    console.log(err);
  }
}

drone.send("command", 0, "command".length, PORT, HOST, handleError);
drone.send("streamon", 0, "streamon".length, PORT, HOST, handleError);
drone.send("battery?", 0, 8, PORT, HOST, handleError);

io.on("connection", (socket) => {
  socket.on("command", (command) => {
    console.log("command Sent from browser");
    console.log(command);
    drone.send(command, 0, command.length, PORT, HOST, handleError);
  });

  socket.emit("status", "CONNECTED");
});

const args = [
  "-i",
  "udp://0.0.0.0:11111",
  "-r",
  "30",
  "-s",
  "960x720",
  "-codec:v",
  "mpeg1video",
  "-b",
  "800k",
  "-f",
  "mpegts",
  "http://127.0.0.1:3001/stream",
];

// Spawn an ffmpeg instance
var streamer = spawn("ffmpeg", args);
// Uncomment if you want to see ffmpeg stream info
// streamer.stderr.pipe(process.stderr);
streamer.on("exit", function (code) {
  console.log("Failure", code);
});

http.listen(HTTP_PORT);
