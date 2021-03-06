import { Component, AfterViewInit, ElementRef } from '@angular/core';
import { environment } from './environment';

declare var componentHandler: any;

@Component({
  moduleId: module.id,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.css'],
})

export class AppComponent implements AfterViewInit {
  private _reconnectInterval: number = 5000;
  ws;
  currentSelfieState;
  currentGameState;
  configuration: any = null;
  opacity: number = 85;
  size: number = 0.3;
  isPaused: boolean = false;
  isPlaying: boolean = false;
  authenticated: boolean = false;
  token: string = '';
  socketUrl: string = (environment.production) ? 'ws://gamebus-production.apps-test.redhatkeynote.com/game/admin' : 'ws://localhost:9001/game/admin';
  selfieStates = [
    {
      name: 'open',
      display: 'Open'
    },
    {
      name: 'closed',
      display: 'Closed'
    }
  ];
  gameStates = [
    {
      name: 'title',
      display: 'Title'
    },
    {
      name: 'demo',
      display: 'Demo'
    },
    {
      name: 'play',
      display: 'Start Game'
    },
    {
      name: 'pause',
      display: 'Pause'
    },
    {
      name: 'game-over',
      display: 'Game Over'
    }
  ];

  constructor(private elementRef: ElementRef) {
    this.currentGameState = {
      name: null,
      display: null
    };

    if (this.authenticated) {
      this.connect();
    }
  }

  login() {
    this.connect();
  }

  connect() {
    // Build the URL to gamebus off of the location string, assumes
    // app is deployed in same Openshift project
    if (environment.production) {
      let hostname = location.hostname;
      this.socketUrl = "ws://" + hostname.replace("mobile-app-admin-","gamebus-") + "/game/admin"
    }
    this.ws = new WebSocket(this.socketUrl);
    this.ws.onopen = this.onOpen.bind(this);
    this.ws.onmessage = this.onMessage.bind(this);
    this.ws.onclose = this.onClose.bind(this);
  }

  onOpen(evt) {
    let message = {
      type: 'register',
      token: this.token
    };

    this.ws.send(JSON.stringify(message));
  }

  onClose(evt) {
    let interval;
    let intervalHandler = () => {
      if (this.ws.readyState === WebSocket.CLOSED) {
        this.connect();
        return;
      }

      if (this.ws.readyState === WebSocket.OPEN) {
        clearInterval(interval);
      }
    }

    if (this.authenticated) {
      intervalHandler = intervalHandler.bind(this);
      interval = setInterval(intervalHandler, this._reconnectInterval);
    }
  }

  onMessage(evt) {
    let message = JSON.parse(evt.data);

    if (message.type === 'auth-failed') {
      this.ws.close();
      this.authenticated = false;
      return;
    }

    this.authenticated = true;

    if (message.type === 'state') {
      this.gameStates.forEach(gameState => {
        if (message.state === gameState.name) {
          this.currentGameState = gameState;
        }
      });

      if (message.state === 'play') {
        this.isPaused = false;
        this.isPlaying = true;
      }

      if (message.state === 'pause') {
        this.isPaused = true;
        this.isPlaying = false;
      }
    }

    if (message.type === 'selfie-state') {
      this.currentSelfieState = message.state;
    }

    if (message.type === 'configuration') {
      this.configuration = message.configuration;

      if (this.configuration.bp === null) {
        this.configuration.bp = false;
      }

      setTimeout(() => {
        componentHandler.upgradeDom();
      }, 0);

      const data = {
        message: 'Game Configuration Updated!'
      };

      this.elementRef.nativeElement.querySelector('#toast')
        .MaterialSnackbar.showSnackbar(data);
    }
  }

  ngAfterViewInit() {
    componentHandler.upgradeDom();
  }

  updateOpacity(evt) {
    this.configuration.opacity = evt.target.value;
  }

  updateScale(evt) {
    this.configuration.scale = evt.target.value;
  }

  updateBackground(evt) {
    this.configuration.background = evt.target.value;
  }

  updateSpeed(evt) {
    this.configuration.speed = evt.target.value;
  }

  updatePoints() {}

  updateGoldenSnitch(evt) {
    this.configuration.goldenSnitch = evt.target.checked;
  }

  updateCanary(evt) {
    // this.gameService.setCanary(evt.target.checked);
  }

  updateDemo(evt) {
    // this.gameService.setDemoDevice(evt.target.checked);
  }

  updateBypass(evt) {
    this.configuration.bp = evt.target.checked;
    this.publishConfigurationChange();
  }

  changeState(state) {
    if (state !== 'pause') {
      this.isPaused = false;
    }

    if (state === 'play') {
      this.isPlaying = true;
    } else {
      this.isPlaying = false;
    }

    if (state === 'pause' && !this.isPaused) {
      this.isPaused = true;
    } else if (state === 'pause' && this.isPaused) {
      this.isPaused = false;
      this.isPlaying = true;
      state = 'play';
    }

    this.currentGameState = state;

    const message = {
      type: 'state-change',
      state: state,
      token: this.token
    };

    this.ws.send(JSON.stringify(message));

    if (state === 'start-game') {
      this.configuration.gameId = this.guid();
    }

    this.publishConfigurationChange();
  }

  changeSelfieState(state) {
    const message = {
      type: 'selfie-state-change',
      state: state.name,
      token: this.token
    };

    this.ws.send(JSON.stringify(message));
  }

  publishConfigurationChange() {
    const message = {
      type: 'configuration',
      configuration: this.configuration,
      token: this.token
    };

    this.ws.send(JSON.stringify(message));
  }

  clearLocalStorage() {
    localStorage.clear();
  }

  private guid() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  }
}
