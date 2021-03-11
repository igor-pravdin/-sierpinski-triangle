/***********
 *         *
 *   APP   *
 *         *
 ***********/

function App(state, layers) {
    this.state = State.create('APP', state);
    this.desk = Desk.create(layers);
}

App.constructor.name = 'App';

App.READY_STATUS = 'Ready';
App.START_STATUS = 'Start';
App.PAUSE_STATUS = 'Pause';

App.create = ({topLayer, bottomLayer, counter, counterValue, divider, dividerValue, startBtn, stopBtn, clearBtn}) => {
    // DOM bindings
    App.topLayer = document.querySelector(topLayer);
    App.bottomLayer = document.querySelector(bottomLayer);
    App.counter = document.querySelector(counter);
    App.counterValue = document.querySelector(counterValue);
    App.divider = document.querySelector(divider);
    App.dividerValue = document.querySelector(dividerValue);
    App.startBtn = document.querySelector(startBtn);
    App.stopBtn = document.querySelector(stopBtn);
    App.clearBtn = document.querySelector(clearBtn);
    // Instance
    const app = new App({
        status: 'None',
        n: 3,
        d: 0.5
    }, [
        Layer.create(App.bottomLayer),
        Layer.create(App.topLayer)
    ]);

    Desk.initStartPoints(app.desk.layer(1), app.state.get('n'));

    App.counter.setAttribute('value', app.state.get('n'));
    App.counterValue.innerText = app.state.get('n');
    App.divider.setAttribute('value', app.state.get('d'));
    App.dividerValue.innerText = app.state.get('d');

    App.createDOMListeners(app);
    App.createAppStateListeners(app);

    return app;
};

App.createDOMListeners = app => {
    // Buttons
    App.startBtn.addEventListener('click', () => app.start());
    App.stopBtn.addEventListener('click', () => app.pause());
    App.clearBtn.addEventListener('click', () => app.init());
    // Inputs
    App.counter.addEventListener('input', ({target}) => app.state.set('n', target.value));
    App.divider.addEventListener('input', ({target}) => app.state.set('d', target.value));
    // Mouse
    App.topLayer.addEventListener('mousedown', ({clientX: x, clientY: y}) => {
        const layer = app.desk.layer(1).pickPoint(x, y);
        const point = Layer.getPickedPoint(layer);

        if (point) layer.setInterval(() => layer.clear().drawAllPoints());
    });
    App.topLayer.addEventListener('mouseup', () => {
        app.desk.layer(1).clearInterval().dropPoint();
    });
    App.topLayer.addEventListener('mousemove', ({clientX: x, clientY: y}) => {
        const point = Layer.getPickedPoint(app.desk.layer(1));
        if (point) {
            point.x = x;
            point.y = y;
        }
    });

    return app;
};

App.createAppStateListeners = app => {
    app.state.channel
        .subscribe('statusUpdate', ({status}) => {
            switch (status) {
                // READY
                case App.READY_STATUS:
                    app.desk
                        .clear()
                        .clearInterval()
                        .layer(1)
                        .drawAllPoints();

                    App.stopBtn.style.display = 'none';
                    App.startBtn.style.display = 'inline-block';
                    break;
                // START
                case App.START_STATUS:
                    const points = app.desk.layer(1).points;

                    app.desk
                        .layer(0)
                        .setInterval(((x, y) => layer => {
                            const n = app.state.get('n');
                            const d = app.state.get('d');
                            const i = Math.floor(Math.random() * n) + 1;

                            x = (x + points[i].x) * d;
                            y = (y + points[i].y) * d;

                            layer.drawNewPoint(Point.create(x, y));
                        })(points[0].x, points[0].y));

                    App.startBtn.style.display = 'none';
                    App.stopBtn.style.display = 'inline-block';
                    break;
                // PAUSE
                case App.PAUSE_STATUS:
                    app.desk.layer(0).clearInterval();

                    App.stopBtn.style.display = 'none';
                    App.startBtn.style.display = 'inline-block';
                    break;
            }
        })
        .subscribe('nUpdate', ({n}) => {
            app.pause();
            Desk.initStartPoints(app.desk.layer(1).clear(), n).drawAllPoints();
            App.counterValue.innerText = n;
        })
        .subscribe('dUpdate', ({d}) => App.dividerValue.innerText = d);

    return app;
};

App.prototype.init = function () {
    this.state.set('status', App.READY_STATUS);
    return this;
};

App.prototype.pause = function () {
    if (this.state.get('status') === App.START_STATUS) {
        this.state.set('status', App.PAUSE_STATUS);
    }
    return this;
};

App.prototype.start = function () {
    const status = this.state.get('status');
    if (status === App.READY_STATUS || status === App.PAUSE_STATUS) {
        this.state.set('status', App.START_STATUS);
    }
    return this;
};

/***********
 *         *
 *  Desk   *
 *         *
 ***********/

function Desk(layers) {
    this.layers = layers;
}

State.constructor.name = 'Desk';

Desk.defaultStartX = 590;
Desk.defaultStartY = 369;

Desk.defaultBasePoints = [
    {x: 441, y: 88},
    {x: 260, y: 589},
    {x: 732, y: 409},
    {x: 471, y: 699},
    {x: 326, y: 403},
    {x: 760, y: 192},
    {x: 361, y: 709},
    {x: 804, y: 329}
];

Desk.create = layers => new Desk(layers);

Desk.initStartPoints = (layer, n) => {
    layer.points = [];
    layer.points.push(Point.createStartPoint(Desk.defaultStartX, Desk.defaultStartY));
    for (let i = 0; i < n; i++) {
        layer.points.push(Point.createBasePoint(Desk.defaultBasePoints[i].x, Desk.defaultBasePoints[i].y, Point.letters[i]));
    }
    return layer;
};

Desk.prototype.layer = function (index) {
    return this.layers[index];
};

Desk.prototype.clear = function () {
    this.layers.forEach(layer => layer.clear());
    return this;
};

Desk.prototype.clearInterval = function () {
    this.layers.forEach(layer => layer.clearInterval());
    return this;
};

/***********
 *         *
 *  LAYER  *
 *         *
 ***********/

function Layer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.points = [];
    this.speed = 25;
    this.intervalId = null;
    this.pickedPointIndex = null;
}

Layer.constructor.name = 'Layer';

Layer.create = canvas => new Layer(canvas);

Layer.getPointIndex = (points, x, y) => points.findIndex(point => {
    const step = point.radius * 2;
    const lx = point.x - step;// left x
    const rx = point.x + step;// right x
    const ty = point.y - step;// top y
    const by = point.y + step;// bottom y
    return x >= lx && x <= rx && y >= ty && y <= by;
});

Layer.getPickedPoint = layer => {
    return layer.points[layer.pickedPointIndex];
};

Layer.prototype.clear = function () {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    return this;
};

Layer.prototype.drawNewPoint = function (point) {
    this.points.push(point.draw(this.ctx));
    return this;
};

Layer.prototype.drawAllPoints = function () {
    this.points.forEach(point => point.draw(this.ctx));
    return this;
};

Layer.prototype.pickPoint = function (x, y) {
    const index = Layer.getPointIndex(this.points, x, y);
    if (index >= 0) {
        this.pickedPointIndex = index;
    }
    return this;
};

Layer.prototype.dropPoint = function () {
    this.pickedPointIndex = null;
    return this;
};

Layer.prototype.setInterval = function (fn) {
    this.clearInterval();
    this.intervalId = setInterval(() => fn(this), this.speed);
    return this;
};

Layer.prototype.clearInterval = function () {
    if (this.intervalId) {
        clearInterval(this.intervalId);
    }
    this.intervalId = null;
    return this;
};

/***********
 *         *
 *  POINT  *
 *         *
 ***********/

function Point({x, y, radius, color, textColor, text}) {
    this.x = x;
    this.y = y;
    this.radius = radius || 2;
    this.color = color || 'green';
    this.textColor = textColor || 'black';
    this.text = text || '';
}

Point.constructor.name = 'Point';

Point.letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

Point.create = (x, y) => new Point({x, y});

Point.createStartPoint = (x, y) => new Point({
    x,
    y,
    radius: 6,
    color: 'red',
    textColor: 'black',
    text: 'StartPoint'
});

Point.createBasePoint = (x, y, text) => new Point({
    x,
    y,
    radius: 6,
    color: 'blue',
    textColor: 'black',
    text: text
});

Point.prototype.draw = function (ctx) {
    ctx.beginPath();
    ctx.fillStyle = this.textColor;
    ctx.font = 'italic 15pt Calibri';
    ctx.textAlign = 'right';
    ctx.fillText(this.text, this.x - 10, this.y);
    ctx.fillStyle = this.color;
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI, true);
    ctx.fill();
    return this;
};

/***********
 *         *
 *  STATE  *
 *         *
 ***********/

function State(name, state) {
    this.name = name;
    this.channel = Event.create(this.name);

    this.get = key => key === undefined ? {...state} : state[key];

    this.set = (key, value) => {
        if (state[key] !== undefined) {
            state[key] = value;
            this.channel.publish(key + 'Update', {...state});
        }
        return {...state};
    };
}

State.constructor.name = 'State';

State.create = (name, state) => new State(name, state);

/************
 *          *
 *  EVENTS  *
 *          *
 ***********/

function Event(group) {
    this.group = group; //events group name
    this.channel = {};
}

Event.constructor.name = 'Event';

Event.channels = {};

Event.create = group => {
    const instance = new Event(group);
    Event.channels[instance.group] = instance.channel;
    return instance;
};

Event.prototype.publish = function (event, payload) {
    console.log('STATE:', this.group, event, payload);
    if (this.channel[event]) {
        this.channel[event].forEach(callback => callback(payload));
    }
    return this;
};

Event.prototype.subscribe = function (event, callback) {
    if (!this.channel[event]) {
        this.channel[event] = [];
    }
    this.channel[event].push(callback);
    return this;
};