import net from 'net';

const States = {
  AWAITING_FIRST_LOGIN: 1,
  AWAITING_FIRST_PASSWORD: 2,
  AWAITING_SECOND_LOGIN: 3,
  AWAITING_SECOND_PASSWORD: 4,
  LOGGED_IN: 5,
};

class FakeServerConnection {
  static optionsDefaults() {
    return {
      debug: false,
      messages: [],
      username: "lutron",
      password: "integration",
    };
  }

  constructor(socket, options) {
    this.options = Object.assign({}, FakeServerConnection.optionsDefaults(), options);

    this.state = States.AWAITING_FIRST_LOGIN;
    this.socket = socket;
    this.socket.on("data", (data) => {
      this.receivedData(data);
    });

    // Initial login sequence.
    this.socket.write("login: \r\n");
  }

  receivedData(data) {
    if (this.options.debug) {
      console.log("Server socket received data", data);
    }
    this.options.messages.push({
      receiver: "server_connection",
      data: data.toString()
    });

    // TODO: do we need to worry about partial strings?
    const lines = data.toString().split("\r\n").filter(l => l != "");

    for (let line of lines) {
      switch (this.state) {
        case States.AWAITING_FIRST_LOGIN:
        case States.AWAITING_SECOND_LOGIN:
          this.processUsername(line);
          break;
        case States.AWAITING_FIRST_PASSWORD:
        case States.AWAITING_SECOND_PASSWORD:
          this.processPassword(line);
          break;
        case States.LOGGED_IN:
          this.sendPrompt();
          break;
      }
    }
  }

  processUsername(line) {
    if (line == this.options.username) {
      this.state = (this.state == States.AWAITING_FIRST_LOGIN ? States.AWAITING_FIRST_PASSWORD : States.AWAITING_SECOND_PASSWORD);
      this.socket.write("password: \r\n");
    } else {
      throw new Error(`Fake server expected username ${this.options.username} but received '${line}'`);
    }
  }

  processPassword(line) {
    if (line == this.options.password) {
      if (this.state == States.AWAITING_FIRST_PASSWORD) {
        this.state = States.AWAITING_SECOND_LOGIN;
        this.socket.write("login: \r\n");
      } else {
        this.state = States.LOGGED_IN;
        this.sendPrompt();
      }
    } else {
      throw new Error(`Fake server expected password ${this.options.password} but received '${line}'`);
    }

  }

  sendPrompt() {
    this.socket.write("GNET> \r\n");
  }
}

class FakeServer {
  static optionsDefaults() {
    return {
      debug: false,
      messages: [],
    };
  }

  constructor(options) {
    this.options = Object.assign({}, FakeServer.optionsDefaults(), options);

    this.connectionReceivedPromise = new Promise((resolve) => {
      this.netServer = net.createServer((socket) => {
        const connection = new FakeServerConnection(socket, {
          debug: this.options.debug,
          messages: this.options.messages,
        });
        resolve(connection);
      });
    }).catch((e) => {
      console.error("FakeServer encountered error receiving connection:", e);
    });

    this.listeningPromise = new Promise((resolve) => {
      this.netServer.listen({host: "127.0.0.1", port: 0}, () => {
        resolve(this.netServer.address());
      });
    }).catch((e) => {
      console.error("FakeServer encountered error starting listening:", e);
    });
  }


}

export default FakeServer;
export const FakeServerConnectionStates = States;
